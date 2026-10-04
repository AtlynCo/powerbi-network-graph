import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { digest, readArtifact, root, writeReport } from "./artifact.mjs";
import { buildInputs } from "./provenance.mjs";

const before = await readArtifact();
const inputs = await buildInputs();
const outputs = [
    path.join(root, "dist", before.filename),
    path.join(root, "dist", "package.json"),
    path.join(root, "dist", "build-inputs.json"),
    path.join(root, "dist", "rebuild-verification.json"),
    path.join(root, "webpack.statistics.prod.html")
];
const previousOutputs = await Promise.all(outputs.map(async file => {
    try {
        return { file, bytes: await readFile(file) };
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
        return { file, bytes: null };
    }
}));
async function restoreOutputs() {
    for (const { file, bytes } of previousOutputs) {
        if (bytes === null) await rm(file, { force: true });
        else await writeFile(file, bytes);
    }
}
try {
    execFileSync(process.execPath, [path.join(root, "scripts", "package.mjs"), "--audit"], { cwd: root, stdio: "inherit" });
    const after = await readArtifact();
    assert.deepEqual(await buildInputs(), inputs, "Source changed during the reproducibility check");
    const members = async artifact => Object.fromEntries(await Promise.all(Object.values(artifact.zip.files)
        .filter(entry => !entry.dir).map(async entry => [entry.name, digest(await entry.async("nodebuffer"))])));
    const previousMembers = await members(before);
    const currentMembers = await members(after);
    const membersEqual = JSON.stringify(previousMembers) === JSON.stringify(currentMembers);
    const archiveByteIdentical = before.bytes.equals(after.bytes);
    assert(membersEqual, "Unchanged source produced different package members");
    assert(archiveByteIdentical, "Unchanged source produced different canonical PBIVIZ bytes");
    await writeReport("rebuild-verification.json", {
        artifact: after.filename, sha256: after.sha256, bytes: after.bytes.length, passed: true,
        previousSha256: before.sha256, members: currentMembers, archiveByteIdentical,
        beforeEntryDates: Object.fromEntries(Object.values(before.zip.files).map(entry => [entry.name, entry.date.toISOString()])),
        afterEntryDates: Object.fromEntries(Object.values(after.zip.files).map(entry => [entry.name, entry.date.toISOString()])),
        scope: "Two canonical, unminified SDK production archives with unchanged inputs: exact archive-byte equality, decompressed member equality, and CRC validation. Transient certification-audit output never replaces the selected production PBIVIZ."
    });
    console.log(`Rebuild reproduced the complete PBIVIZ (${after.bytes.length} bytes); SHA-256 ${after.sha256}.`);
} catch (error) {
    await restoreOutputs();
    throw error;
}
