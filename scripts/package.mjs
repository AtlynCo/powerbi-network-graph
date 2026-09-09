import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { readArtifact, writeReport } from "./artifact.mjs";
import { buildInputs, git, toolVersions } from "./provenance.mjs";

const root = process.cwd();
const startedAt = new Date().toISOString();
const sourceHeadAtBuild = git("rev-parse", "HEAD");
const inputs = await buildInputs();
const tools = path.join(root, "node_modules", "powerbi-visuals-tools");
const config = JSON.parse(readFileSync(path.join(tools, "config.json"), "utf8"));
const home = path.join(root, ".tool-home");
const certificateFolder = path.join(home, config.server.certificateFolder);
mkdirSync(certificateFolder, { recursive: true });
const files = {
    cert: path.join(certificateFolder, config.server.certificate),
    key: path.join(certificateFolder, config.server.privateKey),
    pfx: path.join(certificateFolder, config.server.pfx),
    pass: path.join(certificateFolder, config.server.passphrase)
};
const temp = path.join(home, "temp");
mkdirSync(temp, { recursive: true });
const env = {
    ...process.env, HOME: home, USERPROFILE: home, TEMP: temp, TMP: temp,
    ATLYN_CERT_PFX: files.pfx, ATLYN_CERT_PASS_FILE: files.pass
};

function run(command, args) {
    const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
}

try {
    // The SDK resolves a dev certificate during package. Pre-provision an isolated one, without a trust/store mutation.
    if (process.platform === "win32") {
        writeFileSync(files.pass, randomBytes(24).toString("hex"), { mode: 0o600 });
        run("pwsh", ["-NoProfile", "-NonInteractive", "-Command", `
            $ErrorActionPreference = 'Stop'
            $rsa = [System.Security.Cryptography.RSA]::Create(2048)
            try {
                $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
                    'CN=localhost', $rsa, [System.Security.Cryptography.HashAlgorithmName]::SHA256,
                    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
                $certificate = $request.CreateSelfSigned([DateTimeOffset]::Now.AddDays(-1), [DateTimeOffset]::Now.AddDays(30))
                try {
                    $pass = [IO.File]::ReadAllText($env:ATLYN_CERT_PASS_FILE)
                    [IO.File]::WriteAllBytes($env:ATLYN_CERT_PFX, $certificate.Export(
                        [System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $pass))
                } finally { $certificate.Dispose() }
            } finally { $rsa.Dispose() }
        `]);
    } else {
        run("openssl", ["req", "-newkey", "rsa:2048", "-nodes", "-x509", "-days", "30",
            "-keyout", files.key, "-out", files.cert, "-subj", "/CN=localhost"]);
    }
    run(process.execPath, [
        path.join(tools, "bin", "pbiviz.js"), "package", "--all-locales",
        ...(process.argv.includes("--audit") ? ["--certification-audit"] : [])
    ]);
} finally {
    for (const file of Object.values(files)) rmSync(file, { force: true });
}
assert.deepEqual(await buildInputs(), inputs, "Build inputs changed while packaging; rebuild a stable source baseline");
const artifact = await readArtifact();
await writeReport("build-inputs.json", {
    artifact: artifact.filename, sha256: artifact.sha256, startedAt, completedAt: new Date().toISOString(),
    sourceHeadAtBuild, inputs, tools: await toolVersions(),
    note: "Source may be uncommitted at build time. Release manifest requires a clean committed tree with exactly these build-input hashes."
});
