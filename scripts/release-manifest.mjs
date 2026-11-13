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
for (const filename of ["package-inspection.json", "rebuild-verification.json", "browser-test-results.json", "release-browser-results.json", "release-benchmark-final.json", "release-profile.json", "certification-preflight.json", "runtime-dependencies.json"]) {
    const report = JSON.parse(await readFile(path.join(root, "dist", filename), "utf8"));
    assert.equal(report.sha256, artifact.sha256, `${filename} belongs to another package`);
    if ("passed" in report) assert.equal(report.passed, true, `${filename} did not pass`);
}
const sample = JSON.parse(await readFile(path.join(root, "samples", "release", "sample-validation.json"), "utf8"));
assert.equal(sample.archive.sourceSha256, artifact.sha256, "Authored PBIP contains another package");
assert.equal(sample.archive.embeddedSha256, artifact.sha256);
const sampleRoot = path.join(root, "samples", "release");
const sampleFile = relative => {
    const resolved = path.resolve(sampleRoot, relative);
    assert(resolved.startsWith(`${sampleRoot}${path.sep}`), `Sample evidence path escapes sample: ${relative}`);
    return resolved;
};
assert.equal(digest(await readFile(sampleFile(sample.archive.embeddedCopy))), artifact.sha256, "PBIP archive changed after validation");
for (const file of sample.sourceFiles) {
    assert.equal(digest(await readFile(sampleFile(file.path))), file.sha256, `PBIP source changed after validation: ${file.path}`);
}
for (const resource of sample.resources) {
    assert.equal(digest(await readFile(sampleFile(path.join("Network.Report", "CustomVisuals", artifact.visual.visual.guid, resource.path)))),
        resource.sourceSha256, `PBIP resource changed after validation: ${resource.path}`);
}
assert.equal(sample.assemblerSha256, digest(await readFile(path.join(root, "scripts", "sample-package.mjs"))), "Sample validator changed after validation");
const model = JSON.parse(await readFile(path.join(root, "dist", "tmdl-validation.json"), "utf8"));
assert.equal(model.passed, true, "Official TOM preflight did not pass");
assert.equal(model.validationErrors, 0, "Microsoft TOM model validation reported errors");
for (const file of [...model.sourceFiles, ...model.reportFiles]) {
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
    scope: "Offline runtime candidate: package, source, assets and local browser/mock evidence. Not native Desktop/service/export/PBIX or Microsoft certification evidence.",
    commercialDecision: "Owner approved the external storefront subscription and ungated offline runtime model on 2026-09-10. No runtime entitlement implementation is required.",
    nativeAndApprovalGates: ["Desktop PBIP open/save/reopen and PBIX conversion", "Native Desktop, Service, export and accessibility host matrix", "Native 1366x768 AppSource screenshots", "Partner Center publisher verification and upload", "Microsoft certification review"]
};
const manifest = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(root, "dist", "release-manifest.json"), manifest, { flag: "wx" });
await writeFile(path.join(root, "dist", "release-manifest.sha256"), `${digest(manifest)}  release-manifest.json\n`, { flag: "wx" });
console.log(`Immutable release manifest for ${sourceCommit}\nPackage SHA-256 ${artifact.sha256}\nManifest SHA-256 ${digest(manifest)}`);
