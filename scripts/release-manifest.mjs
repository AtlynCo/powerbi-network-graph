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
const approvals = JSON.parse(await readFile(path.join(root, "docs", "marketplace", "approved-handoff-1.2.json"), "utf8"));
assert.equal(approvals.visualVersion, artifact.config.visual.version);
assert.equal(approvals.packageSha256, artifact.sha256, "Owner-approved handoff belongs to another visual archive");
const nativeBytes = await readFile(path.join(root, approvals.nativePbix.file));
assert.equal(nativeBytes.length, approvals.nativePbix.bytes);
assert.equal(digest(nativeBytes), approvals.nativePbix.sha256, "Approved native PBIX differs");
const native = JSON.parse(await readFile(path.join(root, "dist", "native-pbix-inspection.json"), "utf8"));
assert.equal(native.sha256, artifact.sha256);
assert.equal(native.pbixSha256, approvals.nativePbix.sha256);
assert.equal(native.version, approvals.visualVersion);
assert.equal(native.zipCrcPassed, true);
assert.equal(native.allVisualMembersEqual, true);
assert.equal(native.storedLabelMatchesExpected, true);
assert.equal(native.expectedStoredLabel, approvals.nativePbix.observedStoredLabel);
const cold = JSON.parse(await readFile(path.join(root, "dist", "native-prepublish", "retry-20260925", "cold-reopen-without-refresh.json"), "utf8"));
const coldLaunch = JSON.parse((await readFile(path.join(root, "dist", "native-prepublish", "retry-20260925", "cold-launch.json"), "utf8")).replace(/^\uFEFF/, ""));
assert.equal(cold.packageSha256, artifact.sha256);
assert.equal(coldLaunch.pbixSha256, approvals.nativePbix.sha256);
assert.equal(cold.pid, coldLaunch.pid);
assert.equal(cold.passed, true);
assert.equal(cold.savedViewRestored.passed, true);
assert.equal(cold.phase, "cold-reopen-without-refresh");
assert.deepEqual(cold.pageOrder, native.pages.map(page => page.displayName));
assert.equal(cold.checks.length, 5);
assert(cold.checks.every(check => check.passed));
assert.deepEqual(cold.errors, []);
const mediaApproval = JSON.parse((await readFile(path.join(root, "dist", "listing-native-1.2", "owner-approval.json"), "utf8")).replace(/^\uFEFF/, ""));
assert.equal(mediaApproval.ownerApproved, true);
assert.equal(mediaApproval.pbixSha256, approvals.nativePbix.sha256);
assert.equal(mediaApproval.packageSha256, artifact.sha256);
assert.deepEqual(mediaApproval.images, approvals.approvedMedia, "Approved media selection changed");
for (const image of approvals.approvedMedia) {
    const bytes = await readFile(path.join(root, image.file));
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    assert.equal(bytes.readUInt32BE(16), 1366);
    assert.equal(bytes.readUInt32BE(20), 768);
    assert.equal(bytes.length, image.bytes);
    assert(bytes.length < 1024000);
    assert.equal(digest(bytes), image.sha256, "Approved native listing image changed");
}
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
    nativePbix: approvals.nativePbix, approvedMedia: approvals.approvedMedia, ownerApprovals: approvals,
    nativeEvidence: { inspection: "dist/native-pbix-inspection.json", coldReopen: "dist/native-prepublish/retry-20260925/cold-reopen-without-refresh.json", scope: "Bounded genuine Desktop refresh/render/interaction and PBIX cold-reopen/saved-view evidence; not the full native host matrix." },
    scope: "Private prepublication handoff: exact offline package/source/sample, owner-approved native PBIX classification and two native images, bounded native and local mock evidence. No Partner Center configuration, submission, publication or Microsoft certification.",
    commercialDecision: "Owner-approved existing Atlyn storefront subscription acquisition; intentionally ungated runtime and free shared viewing. No runtime entitlement integration required. Certification-ref movement, merging and submission remain owner gates.",
    nativeAndApprovalGates: ["Remaining full native matrix including Power BI bookmarks, format painter, context menus and conversions", "Service/mobile and actual export", "Assistive technology in native hosts", "Verified Partner Center publisher/account and Network offer identity; authenticated draft configuration", "Microsoft reviewer-process acceptance, authorized submission and Microsoft review"]
};
const manifest = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(root, "dist", "release-manifest.json"), manifest, { flag: "wx" });
await writeFile(path.join(root, "dist", "release-manifest.sha256"), `${digest(manifest)}  release-manifest.json\n`, { flag: "wx" });
console.log(`Immutable release manifest for ${sourceCommit}\nPackage SHA-256 ${artifact.sha256}\nManifest SHA-256 ${digest(manifest)}`);
