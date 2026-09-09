import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { parse } from "acorn";
import { simple } from "acorn-walk";

export const root = process.cwd();
export const digest = bytes => createHash("sha256").update(bytes).digest("hex");
export const readJson = async filename => JSON.parse(await readFile(path.join(root, filename), "utf8"));

export function assertNoPrivateKeyMaterial(filename, bytes) {
    assert(!/\.(?:pem|key|pfx|p12|p8|pk8|pkcs12|der|cer|crt)$/i.test(filename),
        `Certificate/key container forbidden in PBIVIZ: ${filename}`);
    const text = Buffer.from(bytes).toString("utf8");
    assert(!/-----BEGIN (?:[A-Z0-9 ]* )?PRIVATE KEY-----/.test(text) && !text.includes("openssh-key-v1"),
        `Private-key material forbidden in PBIVIZ: ${filename}`);
    if (filename.endsWith(".json")) {
        const inspect = value => {
            if (!value || typeof value !== "object") return;
            assert(!(typeof value.kty === "string" && (typeof value.d === "string" || (value.kty === "oct" && typeof value.k === "string"))),
                `Private JSON Web Key forbidden in PBIVIZ: ${filename}`);
            for (const entry of Object.values(value)) inspect(entry);
        };
        inspect(JSON.parse(text));
    }
}

export function assertBundledNoticeText(javascript, noticeText) {
    let included = false;
    simple(parse(javascript, { ecmaVersion: "latest", sourceType: "module" }), {
        Literal(node) {
            if (typeof node.value === "string" && node.value.includes(noticeText)) included = true;
        },
        TemplateLiteral(node) {
            if (!node.expressions.length && node.quasis[0].value.cooked?.includes(noticeText)) included = true;
        }
    });
    assert(included, "Actual PBIVIZ JavaScript must retain the complete generated third-party license text; import and render thirdPartyNotices, then rebuild");
}

export async function verifyBundledNotices(artifact) {
    const noticeText = await readFile(path.join(root, "THIRD_PARTY_NOTICES.txt"), "utf8");
    const source = await readFile(path.join(root, "src", "thirdPartyNotices.ts"), "utf8");
    const prefix = "export const thirdPartyNotices = ";
    assert(source.startsWith(prefix), "Generated third-party notice source is missing its export");
    assert.equal(JSON.parse(source.slice(prefix.length).trim().replace(/;$/, "")), noticeText, "Root and compiled-source notices disagree");
    for (const required of ["Permission is hereby granted", "THE SOFTWARE IS PROVIDED", "Microsoft Corporation", "Copyright Software Freedom Conservancy, Inc."]) {
        assert(noticeText.includes(required), `Required runtime license/copyright text missing: ${required}`);
    }
    assertBundledNoticeText(artifact.visual.content.js, noticeText);
    return { bytes: Buffer.byteLength(noticeText), sha256: digest(noticeText) };
}

export async function readArtifact() {
    const config = await readJson("pbiviz.json");
    const filename = `${config.visual.guid}.${config.visual.version}.pbiviz`;
    const artifacts = (await readdir(path.join(root, "dist"))).filter(name => name.endsWith(".pbiviz"));
    assert.deepEqual(artifacts, [filename], "dist must contain exactly the expected, real PBIVIZ (remove stale packages)");
    const bytes = await readFile(path.join(root, "dist", filename));
    assert.equal(bytes.subarray(0, 2).toString(), "PK", "PBIVIZ must be a ZIP archive, not a renamed placeholder");
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
    for (const entry of Object.values(zip.files)) {
        assert(!entry.name.split(/[\\/]/).includes("..") && !/^(?:[\\/]|[A-Za-z]:)/.test(entry.name), "Unsafe ZIP path");
        assert(!entry.unsafeOriginalName || entry.name === entry.unsafeOriginalName, "ZIP path was silently sanitized");
        if (!entry.dir) assertNoPrivateKeyMaterial(entry.name, await entry.async("nodebuffer"));
    }
    const manifestEntry = zip.file("package.json");
    assert(manifestEntry, "Archive package.json is required");
    const manifest = JSON.parse(await manifestEntry.async("string"));
    const resource = manifest.resources.find(item => item.resourceId === manifest.metadata.pbivizjson.resourceId);
    assert(resource && resource.sourceType === 5, "Manifest must reference the visual resource");
    const resourceEntry = zip.file(resource.file);
    assert(resourceEntry, "Manifest visual resource must exist");
    const visual = JSON.parse(await resourceEntry.async("string"));
    for (const value of [manifest.visual, visual.visual]) {
        assert.equal(value.guid, config.visual.guid, "Exact visual GUID mismatch");
        assert.equal(value.version, config.visual.version, "Exact visual version mismatch");
        assert.equal(value.visualClassName, config.visual.visualClassName);
    }
    assert.equal(manifest.version, config.visual.version);
    assert.equal(visual.apiVersion, config.apiVersion);
    assert.deepEqual(visual.capabilities, await readJson(config.capabilities), "Packaged capabilities differ from source");
    assert.deepEqual(visual.externalJS, [], "External scripts are forbidden");
    assert.deepEqual(visual.capabilities.privileges, [], "Privileges must be empty");
    assert(typeof visual.content.js === "string" && visual.content.js.length > 1000, "Compiled JavaScript missing");
    assert(typeof visual.content.css === "string" && visual.content.css.includes("atlyn-network"), "Compiled CSS missing");
    assert(visual.content.js.includes(config.visual.guid), "Plugin registration missing");
    const icon = Buffer.from(visual.content.iconBase64.replace(/^data:image\/png;base64,/, ""), "base64");
    assert.equal(icon.subarray(1, 4).toString(), "PNG", "Embedded PNG icon missing");
    for (const file of config.stringResources) {
        const locale = path.basename(path.dirname(file));
        assert.deepEqual(visual.stringResources[locale], await readJson(file), `Packaged ${locale} resources differ`);
    }
    return { filename, bytes, zip, manifest, visual, config, sha256: digest(bytes) };
}

export async function extractArtifact(artifact) {
    const destination = path.join(root, "dist", "inspected");
    await mkdir(destination, { recursive: true });
    await Promise.all([
        writeFile(path.join(destination, "visual.js"), artifact.visual.content.js),
        writeFile(path.join(destination, "visual.css"), artifact.visual.content.css),
        writeFile(path.join(destination, "package.json"), JSON.stringify(artifact.manifest, null, 2)),
        writeFile(path.join(destination, "capabilities.json"), JSON.stringify(artifact.visual.capabilities, null, 2)),
        writeFile(path.join(destination, "stringResources.json"), JSON.stringify(artifact.visual.stringResources, null, 2))
    ]);
    return destination;
}

export async function writeReport(name, value) {
    await writeFile(path.join(root, "dist", name), `${JSON.stringify(value, null, 2)}\n`);
}
