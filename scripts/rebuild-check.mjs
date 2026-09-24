import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { digest, readArtifact, root, writeReport } from "./artifact.mjs";
import { buildInputs } from "./provenance.mjs";

const before = await readArtifact();
const inputs = await buildInputs();
execFileSync(process.execPath, [path.join(root, "scripts", "package.mjs"), "--audit"], { cwd: root, stdio: "inherit" });
const after = await readArtifact();
assert.deepEqual(await buildInputs(), inputs, "Source changed during the reproducibility check");
const members = async artifact => Object.fromEntries(await Promise.all(Object.values(artifact.zip.files)
    .filter(entry => !entry.dir).map(async entry => [entry.name, digest(await entry.async("nodebuffer"))])));
const previousMembers = await members(before);
const currentMembers = await members(after);
const passed = JSON.stringify(previousMembers) === JSON.stringify(currentMembers);
await writeReport("rebuild-verification.json", {
    artifact: after.filename, sha256: after.sha256, bytes: after.bytes.length, passed,
    previousSha256: before.sha256, members: currentMembers,
    archiveByteIdentical: before.bytes.equals(after.bytes),
    beforeEntryDates: Object.fromEntries(Object.values(before.zip.files).map(entry => [entry.name, entry.date.toISOString()])),
    afterEntryDates: Object.fromEntries(Object.values(after.zip.files).map(entry => [entry.name, entry.date.toISOString()])),
    scope: "Two official SDK builds with unchanged source: compare every decompressed member. SDK ZIP timestamps are not reproducible; archives are never rewritten or normalized. Freeze and test the exact final archive SHA."
});
assert(passed, "Unchanged source produced different package members");
console.log(`Rebuild preserved every package member; final archive SHA-256 ${after.sha256}. ZIP byte-identical: ${before.bytes.equals(after.bytes)}.`);
