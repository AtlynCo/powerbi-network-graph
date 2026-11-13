import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { JSDOM } from "jsdom";
import { digest, readArtifact, root, writeReport } from "./artifact.mjs";

const argument = process.argv.find(value => value.startsWith("--file="))?.slice(7);
const expectedStoredLabel = process.argv.find(value => value.startsWith("--expected-stored-label="))?.slice("--expected-stored-label=".length);
assert(expectedStoredLabel === undefined || (expectedStoredLabel.length > 0 && expectedStoredLabel.length <= 128), "Expected stored label must be a nonempty bounded name");
assert(argument, "Pass --file=<actual owner-saved PBIX inside this worktree>");
const filename = path.resolve(root, argument);
const relative = path.relative(root, filename);
assert(!path.isAbsolute(relative) && !relative.startsWith("..") && path.extname(filename).toLowerCase() === ".pbix",
    "The native PBIX must be an explicitly selected file inside this worktree");
const bytes = await readFile(filename);
const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
const artifact = await readArtifact();
const members = [];
for (const entry of Object.values(artifact.zip.files).filter(entry => !entry.dir)) {
    const expected = await entry.async("nodebuffer");
    const name = `Report/CustomVisuals/${artifact.config.visual.guid}/${entry.name}`;
    const embedded = zip.file(name);
    assert(embedded, `Native embedded visual member missing: ${name}`);
    const actual = await embedded.async("nodebuffer");
    assert(actual.equals(expected), `Native visual differs from the approved PBIVIZ: ${name}`);
    members.push({ path: name, bytes: actual.length, sha256: digest(actual), equal: true });
}
assert(zip.file("DataModel"), "Actual native DataModel container is required");
const decode = bytes => (bytes[1] === 0 || bytes[0] === 255 ? bytes.toString("utf16le") : bytes.toString("utf8")).replace(/^\uFEFF/, "");
const json = async name => {
    const entry = zip.file(name);
    assert(entry, `Native report metadata missing: ${name}`);
    return JSON.parse(decode(await entry.async("nodebuffer")));
};
let pages;
let reportFormat;
const savedViews = [];
if (zip.file("Report/definition/pages/pages.json")) {
    const metadata = await json("Report/definition/pages/pages.json");
    pages = await Promise.all(metadata.pageOrder.map(async name => {
        const page = await json(`Report/definition/pages/${name}/page.json`);
        assert.equal(page.name, name);
        return { name, displayName: page.displayName };
    }));
    for (const [page, visual] of [["PageServices", "SGraph"], ["PageAccounts", "AGraph"], ["PageCircular", "CircularGraph"], ["PageRadial", "RadialGraph"]]) {
        const definition = await json(`Report/definition/pages/${page}/visuals/${visual}/visual.json`);
        const literal = definition.visual?.objects?.navigation?.[0]?.properties?.savedView?.expr?.Literal?.Value;
        if (typeof literal === "string") {
            const encoded = literal.startsWith("'") ? literal.slice(1, -1).replaceAll("''", "'") : literal;
            assert(encoded.length <= 4096, "Native saved-view text exceeds the visual contract");
            const state = JSON.parse(encoded);
            savedViews.push({ page, version: state.version, layout: state.layout, root: state.root, geometry: state.geometry,
                centerX: state.centerX, centerY: state.centerY, scale: state.scale });
        }
    }
    reportFormat = "PBIR";
} else {
    const layout = await json("Report/Layout");
    pages = layout.sections.map(({ name, displayName }) => ({ name, displayName }));
    reportFormat = "legacy Layout";
}
assert.deepEqual(pages.map(page => page.name), ["PageServices", "PageAccounts", "PageCircular", "PageRadial", "PageHints"],
    "Native PBIX must contain the final Hints-last sample");
let labels = [];
const properties = zip.file("docProps/custom.xml");
if (properties) {
    const document = new JSDOM(decode(await properties.async("nodebuffer")), { contentType: "text/xml" }).window.document;
    const fields = new Map([...document.getElementsByTagName("property")].map(element => [element.getAttribute("name"), element.textContent]));
    labels = [...fields].filter(([name]) => /^MSIP_Label_.+_Enabled$/.test(name)).map(([name, enabled]) => {
        const prefix = name.slice(0, -"_Enabled".length);
        return { enabled: enabled === "true", storedName: fields.get(`${prefix}_Name`) ?? null, contentBits: fields.get(`${prefix}_ContentBits`) ?? null };
    }).filter(label => label.enabled);
}
const result = {
    checkedAt: new Date().toISOString(), file: path.relative(root, filename), bytes: bytes.length, pbixSha256: digest(bytes),
    artifact: artifact.filename, sha256: artifact.sha256, version: artifact.config.visual.version,
    zipCrcPassed: true, allVisualMembersEqual: true, modelBytes: (await zip.file("DataModel").async("nodebuffer")).length,
    reportFormat, pages, savedViews, labels, expectedStoredLabel: expectedStoredLabel ?? null,
    storedLabelMatchesExpected: expectedStoredLabel === undefined ? null : labels.length === 1 && labels[0].storedName === expectedStoredLabel,
    coldReopenVerifiedByThisScript: false, readyForSubmission: false,
    scope: "Read-only ZIP/member/order check of an actual owner-saved native PBIX, never archive construction. Stored label names can differ from native UI display names; confirm policy in Desktop. Native save provenance, cold reopen, host acceptance and owner approvals are separate."
};
await writeReport("native-pbix-inspection.json", result);
if (expectedStoredLabel !== undefined) assert(result.storedLabelMatchesExpected, "Stored native label differs from the explicitly expected metadata name");
console.log(JSON.stringify(result, null, 2));
