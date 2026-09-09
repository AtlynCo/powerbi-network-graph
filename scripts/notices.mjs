import assert from "node:assert/strict";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "acorn";
import { simple } from "acorn-walk";
import { digest, readArtifact, root, writeReport } from "./artifact.mjs";

const artifact = await readArtifact();
// Intersect compilation module IDs with the actual shipped module table. Tree-shaken and build-only packages are excluded.
const moduleIds = new Set();
simple(parse(artifact.visual.content.js, { ecmaVersion: "latest" }), {
    ObjectExpression(node) {
        const modules = node.properties.filter(property => property.key?.type === "Literal" && typeof property.key.value === "number" && /FunctionExpression/.test(property.value?.type));
        if (modules.length > 10) for (const property of modules) moduleIds.add(String(property.key.value));
    }
});
assert(moduleIds.size > 10, "Cannot identify the actual webpack module table; refusing to invent runtime attribution");
const statisticsFile = path.join(root, "webpack.statistics.prod.html");
const statistics = await readFile(statisticsFile, "utf8");
const packageFile = path.join(root, "dist", artifact.filename);
assert(Math.abs((await stat(statisticsFile)).mtimeMs - (await stat(packageFile)).mtimeMs) < 60000,
    "Webpack statistics and PBIVIZ must come from the same build; rebuild with statistics enabled");
const chart = statistics.match(/window\.chartData\s*=\s*(\[.*\]);/);
assert(chart, "Actual webpack statistics are required; run the package build with statistics enabled");
const data = JSON.parse(chart[1]);
const packageModules = new Map();
function visit(entry) {
    const match = entry.path?.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\//);
    if (match && moduleIds.has(String(entry.id))) {
        if (!packageModules.has(match[1])) packageModules.set(match[1], []);
        packageModules.get(match[1]).push({ id: entry.id, path: entry.path });
    }
    entry.groups?.forEach(visit);
}
data.forEach(visit);
assert(packageModules.size > 0, "No shipped third-party modules matched; refusing to generate empty notices");
const notices = [
    "THIRD-PARTY NOTICES — ATLYN NETWORK",
    `Artifact: ${artifact.filename}`,
    "",
    "These installed package license texts correspond to dependency modules present in the actual packaged JavaScript.",
    "The build-statistics module list is intersected with the shipped webpack module table; development-only dependencies are excluded.",
    "License identifiers below are copied from installed package metadata, not inferred.",
    ""
];
const report = [];
for (const [name, modules] of [...packageModules.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const folder = path.join(root, "node_modules", ...name.split("/"));
    const manifest = JSON.parse(await readFile(path.join(folder, "package.json"), "utf8"));
    const licenseFiles = (await readdir(folder)).filter(file => /^(?:licen[cs]e|copying|copyright|notice)(?:[._-].*)?$/i.test(file)).sort();
    assert(licenseFiles.length, `No installed license text found for ${name}; do not invent attribution`);
    notices.push("=".repeat(78), `${manifest.name} ${manifest.version}`, `Declared license: ${typeof manifest.license === "string" ? manifest.license : JSON.stringify(manifest.license)}`, "");
    for (const file of licenseFiles) notices.push(`--- ${name}/${file} ---`, (await readFile(path.join(folder, file), "utf8")).trim(), "");
    report.push({ name, version: manifest.version, license: manifest.license, licenseFiles, modules });
}
// The formatter vendors Globalize; preserve its own notices rather than attributing it solely to the wrapper.
const globalizeFolder = path.join(root, "node_modules", "powerbi-visuals-utils-formattingutils", "lib", "globalize");
for (const filename of ["globalize.js", "globalize.cultures.js"]) {
    const shipped = report.some(item => item.modules.some(module => module.path.endsWith(`/globalize/${filename}`)));
    if (!shipped) continue;
    const text = await readFile(path.join(globalizeFolder, filename), "utf8");
    const headers = text.match(/\/\*![\s\S]*?\*\/|\/\*[\s\S]*?(?:[Cc]opyright|[Ll]icense)[\s\S]*?\*\//g) ?? [];
    assert(headers.length, `Vendored ${filename} attribution header missing`);
    notices.push("=".repeat(78), `Vendored source notices: powerbi-visuals-utils-formattingutils/lib/globalize/${filename}`,
        "Globalize is distributed under its MIT license option. The full MIT terms are reproduced above; upstream copyright and dual-license notices follow.",
        ...headers, "");
}
const noticeText = `${notices.join("\n").trimEnd()}\n`;
let comparedSidecarNotices = 0;
try {
    const sidecar = await readFile(path.join(root, ".tmp", "drop", "visual.js.LICENSE.txt"), "utf8");
    const comments = sidecar.match(/\/\*[\s\S]*?\*\//g) ?? [];
    for (const comment of comments) {
        assert(noticeText.includes(comment.trim()), "Emitted runtime license sidecar contains an attribution missing from generated notices");
        comparedSidecarNotices++;
    }
} catch (error) {
    if (error.code !== "ENOENT") throw error;
}
await writeFile(path.join(root, "THIRD_PARTY_NOTICES.txt"), noticeText);
await writeFile(path.join(root, "src", "thirdPartyNotices.ts"), `export const thirdPartyNotices = ${JSON.stringify(noticeText)};\n`);
await writeReport("runtime-dependencies.json", {
    artifact: artifact.filename, sha256: artifact.sha256, statisticsSha256: digest(statistics),
    evidence: "Webpack statistics matched against numeric module IDs in the actual PBIVIZ JavaScript",
    noticeTextSha256: digest(noticeText), comparedSidecarNotices,
    dependencies: report
});
console.log(`Wrote root notices and src/thirdPartyNotices.ts for ${report.length} shipped dependency packages plus vendored Globalize notices; compared ${comparedSidecarNotices} emitted sidecar notice(s).`);
