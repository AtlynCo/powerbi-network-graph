import { writeFile } from "node:fs/promises";
import path from "node:path";
import { digest, extractArtifact, readArtifact, root, verifyBundledNotices, writeReport } from "./artifact.mjs";

const artifact = await readArtifact();
const bundledNotices = await verifyBundledNotices(artifact);
await extractArtifact(artifact);
const report = {
    artifact: artifact.filename,
    sha256: artifact.sha256,
    bytes: artifact.bytes.length,
    guid: artifact.visual.visual.guid,
    version: artifact.visual.visual.version,
    apiVersion: artifact.visual.apiVersion,
    entries: Object.keys(artifact.zip.files),
    javascriptBytes: Buffer.byteLength(artifact.visual.content.js),
    javascriptSha256: digest(artifact.visual.content.js),
    cssBytes: Buffer.byteLength(artifact.visual.content.css),
    cssSha256: digest(artifact.visual.content.css),
    locales: Object.keys(artifact.visual.stringResources).sort(),
    privileges: artifact.visual.capabilities.privileges,
    bundledNotices,
    checked: "ZIP CRC, no certificate/key containers or recognizable private-key material, manifest/resource references, exact GUID/version/API, actual compiled JS/CSS/icon, source capabilities and locale equality, complete distributable runtime license text retained in compiled JS"
};
await writeFile(path.join(root, "dist", `${artifact.filename}.sha256`), `${artifact.sha256}  ${artifact.filename}\n`);
await writeReport("package-inspection.json", report);
console.log(`Inspected actual ${artifact.filename} (${artifact.bytes.length} bytes)\nSHA-256 ${artifact.sha256}`);
