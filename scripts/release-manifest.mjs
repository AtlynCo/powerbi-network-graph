import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { digest, readArtifact, root, verifyBundledNotices } from "./artifact.mjs";
import { buildInputs, git, hashFiles } from "./provenance.mjs";

assert.equal(git("status", "--porcelain"), "", "Release manifest requires a clean committed worktree");
const artifact = await readArtifact();
await verifyBundledNotices(artifact);
const build = JSON.parse(await readFile(path.join(root, "dist", "build-inputs.json"), "utf8"));
assert.equal(build.sha256, artifact.sha256, "Build provenance belongs to another package");
assert.deepEqual(await buildInputs(), build.inputs, "Committed source differs from packaged build inputs");
for (const filename of ["package-inspection.json", "browser-test-results.json", "release-browser-results.json", "release-benchmark-final.json", "release-profile.json", "certification-preflight.json", "runtime-dependencies.json", "rebuild-verification.json"]) {
    const report = JSON.parse(await readFile(path.join(root, "dist", filename), "utf8"));
    assert.equal(report.sha256, artifact.sha256, `${filename} belongs to another package`);
    if ("passed" in report) assert.equal(report.passed, true, `${filename} did not pass`);
}
const sample = JSON.parse(await readFile(path.join(root, "samples", "release", "sample-validation.json"), "utf8"));
assert.equal(sample.archive.sourceSha256, artifact.sha256, "Authored PBIP contains another package");
assert.equal(sample.archive.embeddedSha256, artifact.sha256);
const model = JSON.parse(await readFile(path.join(root, "dist", "tmdl-validation.json"), "utf8"));
assert.equal(model.passed, true, "Official TOM preflight did not pass");
for (const file of model.sourceFiles) {
    assert.equal(digest(await readFile(path.join(root, file.file))), file.sha256, `Model changed after TOM deserialization: ${file.file}`);
}
const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
const sourceAssets = await hashFiles(tracked);
const evidence = {};
const collect = async folder => {
    for (const entry of await readdir(path.join(root, folder), { withFileTypes: true })) {
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) {
            if (!["inspected", "preliminary-screenshots"].includes(entry.name)) await collect(file);
        } else if (!entry.name.startsWith("release-manifest") && !entry.name.endsWith(".pbiviz")) {
            evidence[file.replaceAll("\\", "/")] = digest(await readFile(path.join(root, file)));
        }
    }
};
await collect("dist");
const sourceCommit = git("rev-parse", "HEAD");
const report = {
    schemaVersion: 1, createdAt: new Date().toISOString(),
    repository: "AtlynCo/powerbi-network-graph", sourceCommit, branch: git("branch", "--show-current"),
    artifact: { file: artifact.filename, sha256: artifact.sha256, bytes: artifact.bytes.length },
    guid: artifact.visual.visual.guid, version: artifact.visual.visual.version, apiVersion: artifact.visual.apiVersion,
    build, sourceAssets, evidence,
    scope: "Private layout quality candidate: offline package, source, sample and local browser/mock evidence. Not native Desktop/service/export/PBIX acceptance, Marketplace submission or Microsoft certification.",
    commercialDecision: "Owner-approved existing Atlyn storefront subscription acquisition; intentionally ungated runtime and free shared viewing. No runtime entitlement integration required. Certification-ref movement, merging and submission remain owner gates.",
    nativeAndApprovalGates: ["Version-matched Desktop PBIP refresh/open/save/cold-reopen and genuine PBIX conversion", "Native identity propagation/bookmarks/format painter/tooltips/context menus", "Service and actual export", "Assistive technology in native hosts", "Owner-approved privacy URL, EULA, support and listing media", "Authorized reviewer access, Partner Center submission and Microsoft review"]
};
const manifest = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(root, "dist", "release-manifest.json"), manifest, { flag: "wx" });
await writeFile(path.join(root, "dist", "release-manifest.sha256"), `${digest(manifest)}  release-manifest.json\n`, { flag: "wx" });
console.log(`Immutable release manifest for ${sourceCommit}\nPackage SHA-256 ${artifact.sha256}\nManifest SHA-256 ${digest(manifest)}`);
