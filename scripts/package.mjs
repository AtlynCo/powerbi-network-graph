import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { readArtifact, writeReport } from "./artifact.mjs";
import { canonicalizeZip } from "./canonical-zip.mjs";
import { buildInputs, git, toolVersions } from "./provenance.mjs";

const root = process.cwd();
const startedAt = new Date().toISOString();
const sourceHeadAtBuild = git("rev-parse", "HEAD");
const inputs = await buildInputs();
const pbivizConfig = JSON.parse(readFileSync(path.join(root, "pbiviz.json"), "utf8"));
const artifactFilename = `${pbivizConfig.visual.guid}.${pbivizConfig.visual.version}.pbiviz`;
const artifactPath = path.join(root, "dist", artifactFilename);
const packageMetadataPath = path.join(root, "dist", "package.json");
const buildInputsPath = path.join(root, "dist", "build-inputs.json");
const statisticsPath = path.join(root, "webpack.statistics.prod.html");
const outputPaths = [artifactPath, packageMetadataPath, buildInputsPath, statisticsPath];
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

function snapshotFiles(files) {
    return files.map(file => {
        try {
            return { file, bytes: readFileSync(file) };
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
            return { file, bytes: null };
        }
    });
}

function restoreFiles(snapshot) {
    for (const { file, bytes } of snapshot) {
        if (bytes === null) rmSync(file, { force: true });
        else writeFileSync(file, bytes);
    }
}

async function packageMembersEqual(left, right) {
    const leftFiles = left.zip.files;
    const rightFiles = right.zip.files;
    const leftNames = Object.keys(leftFiles).sort();
    const rightNames = Object.keys(rightFiles).sort();
    if (JSON.stringify(leftNames) !== JSON.stringify(rightNames)) return false;
    for (const name of leftNames) {
        if (leftFiles[name].dir !== rightFiles[name].dir) return false;
        const leftBytes = await leftFiles[name].async("nodebuffer");
        const rightBytes = await rightFiles[name].async("nodebuffer");
        if (!leftBytes.equals(rightBytes)) return false;
    }
    return true;
}

function runPackage({ certificationAudit = false } = {}) {
    run(process.execPath, [
        path.join(tools, "bin", "pbiviz.js"), "package", "--all-locales", "--no-minify",
        ...(certificationAudit ? ["--certification-audit", "--no-stats"] : [])
    ]);
}

const originalOutputs = snapshotFiles(outputPaths);
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
    runPackage();
} catch (error) {
    restoreFiles(originalOutputs);
    for (const file of Object.values(files)) rmSync(file, { force: true });
    throw error;
}

try {
    const sdkArtifact = await readArtifact({ requireCanonical: false });
    const canonicalBytes = await canonicalizeZip(sdkArtifact.bytes);
    writeFileSync(artifactPath, canonicalBytes);
    const productionArtifact = await readArtifact();
    let certificationAudit = null;

    if (process.argv.includes("--audit")) {
        const productionOutputs = snapshotFiles(outputPaths);
        try {
            runPackage({ certificationAudit: true });
            const auditArtifact = await readArtifact({ requireCanonical: false });
            certificationAudit = {
                artifactSha256: auditArtifact.sha256,
                artifactBytes: auditArtifact.bytes.length,
                membersEqualToProduction: await packageMembersEqual(productionArtifact, auditArtifact)
            };
        } finally {
            restoreFiles(productionOutputs);
        }
        const restoredArtifact = await readArtifact();
        assert(restoredArtifact.bytes.equals(productionArtifact.bytes),
            "Certification audit replaced the selected production PBIVIZ");
        certificationAudit.selectedProductionRestored = true;
        if (!certificationAudit.membersEqualToProduction) {
            console.warn("Certification audit output differs from the normal production package; retained the normal production PBIVIZ and webpack statistics.");
        }
    }

    assert.deepEqual(await buildInputs(), inputs, "Build inputs changed while packaging; rebuild a stable source baseline");
    const artifact = await readArtifact();
    assert(artifact.bytes.equals(productionArtifact.bytes), "Selected production PBIVIZ changed after packaging");
    await writeReport("build-inputs.json", {
        artifact: artifact.filename, sha256: artifact.sha256, startedAt, completedAt: new Date().toISOString(),
        sourceHeadAtBuild, inputs, tools: await toolVersions(),
        canonicalZip: {
            entryOrder: "ordinal JavaScript string order",
            timestamp: "1980-01-01T00:00:00.000Z",
            platform: "DOS",
            fileDosPermissions: "0x20",
            directoryDosPermissions: "0x10",
            compression: "DEFLATE level 9",
            javascriptMinification: "disabled with the powerbi-visuals-tools --no-minify option"
        },
        certificationAudit,
        note: "The selected artifact is the canonicalized normal, unminified SDK package. Certification-audit output is transient and never replaces the selected production package or its webpack statistics."
    });
} catch (error) {
    restoreFiles(originalOutputs);
    throw error;
} finally {
    for (const file of Object.values(files)) rmSync(file, { force: true });
}
