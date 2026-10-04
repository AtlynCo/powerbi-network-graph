import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, readdir, rm, realpath } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import Ajv from "ajv";
import { assertReportVersions, PBIR_ARTIFACT_VERSION, PBIR_DEFINITION_VERSION } from "./sample-report-versions.mjs";
import { assertUniqueMeasureNames, measureDefinitions, measureName } from "./sample-measures.mjs";

const root = process.cwd();
const defaultSample = path.join(root, "samples", "release");
const candidateRoot = path.join(defaultSample, "candidates");
const args = process.argv.slice(2);
const sampleRootIndex = args.indexOf("--sample-root");
let sample = defaultSample;
if (sampleRootIndex >= 0) {
    const requestedRoot = args[sampleRootIndex + 1];
    assert(requestedRoot, "--sample-root requires a candidate directory");
    const resolvedRoot = path.resolve(root, requestedRoot);
    const realCandidateRoot = await realpath(candidateRoot);
    const realSampleRoot = await realpath(resolvedRoot);
    const relativeRoot = path.relative(realCandidateRoot, realSampleRoot);
    assert(relativeRoot && relativeRoot !== ".." && !relativeRoot.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeRoot),
        "--sample-root must be a child directory of samples/release/candidates");
    assert.equal(args.indexOf("--sample-root", sampleRootIndex + 1), -1, "--sample-root may be specified only once");
    sample = resolvedRoot;
    args.splice(sampleRootIndex, 2);
}
const reportName = "Network.Report";
const modelName = "Network.SemanticModel";
const reportRoot = path.join(sample, reportName);
const modelRoot = path.join(sample, modelName);
const visualConfig = JSON.parse(await readFile(path.join(root, "pbiviz.json"), "utf8")).visual;
assert.equal(typeof visualConfig.guid, "string", "pbiviz.json visual GUID is required");
assert.equal(typeof visualConfig.version, "string", "pbiviz.json visual version is required");
const guid = visualConfig.guid;
const schemaRoot = "https://developer.microsoft.com/json-schemas/fabric/";
const schemaCommit = "83ce11373faada0d01e76264a5cceb0ba70003e6";
const schemas = {
    pbip: `${schemaRoot}pbip/pbipProperties/1.0.0/schema.json`,
    pbir: `${schemaRoot}item/report/definitionProperties/2.0.0/schema.json`,
    pbism: `${schemaRoot}item/semanticModel/definitionProperties/1.0.0/schema.json`,
    report: `${schemaRoot}item/report/definition/report/2.0.0/schema.json`,
    version: `${schemaRoot}item/report/definition/versionMetadata/1.0.0/schema.json`,
    pages: `${schemaRoot}item/report/definition/pagesMetadata/1.0.0/schema.json`,
    page: `${schemaRoot}item/report/definition/page/1.0.0/schema.json`,
    visual: `${schemaRoot}item/report/definition/visualContainer/2.0.0/schema.json`
};
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = filename => readFile(filename, "utf8").then(JSON.parse);
async function put(filename, content) {
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, typeof content === "string" || Buffer.isBuffer(content) ? content : `${JSON.stringify(content, null, 2)}\n`);
}
async function filesBelow(directory) {
    const result = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        assert(!entry.isSymbolicLink(), `Symlinks are not allowed in the offline project: ${entry.name}`);
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) result.push(...await filesBelow(full));
        else result.push(full);
    }
    return result;
}
function inside(base, relative) {
    assert(relative && !path.isAbsolute(relative) && !/^[a-z]+:/i.test(relative), `Not a relative project path: ${relative}`);
    const resolved = path.resolve(base, relative.replaceAll("/", path.sep));
    assert(resolved.startsWith(`${sample}${path.sep}`), `Path escapes the sample: ${relative}`);
    return resolved;
}
function walk(value, callback) {
    if (!value || typeof value !== "object") return;
    callback(value);
    Object.values(value).forEach(child => walk(child, callback));
}

async function refreshSchemas() {
    const pending = [...Object.values(schemas)];
    const documents = {};
    while (pending.length) {
        const uri = pending.shift().split("#")[0];
        if (documents[uri]) continue;
        assert(uri.startsWith(schemaRoot), `Unexpected schema origin: ${uri}`);
        const url = `https://raw.githubusercontent.com/microsoft/json-schemas/${schemaCommit}/fabric/${uri.slice(schemaRoot.length)}`;
        const response = await globalThis.fetch(url);
        assert(response.ok, `Schema fetch failed: ${response.status} ${url}`);
        const text = await response.text();
        const document = JSON.parse(text);
        documents[uri] = { source: url, sha256: hash(text), text };
        walk(document, value => {
            if (typeof value.$ref === "string" && !value.$ref.startsWith("#")) {
                pending.push(new URL(value.$ref, uri).href.split("#")[0]);
            }
        });
    }
    const licenseUrl = `https://raw.githubusercontent.com/microsoft/json-schemas/${schemaCommit}/LICENSE`;
    const license = await globalThis.fetch(licenseUrl);
    assert(license.ok, "Microsoft schema license could not be downloaded");
    await put(path.join(sample, "schemas", "LICENSE.txt"), await license.text());
    await put(path.join(sample, "schemas", "bundle.json"), { repository: "https://github.com/microsoft/json-schemas", commit: schemaCommit, retrieved: "2026-09-09", documents });
    console.log(`Cached ${Object.keys(documents).length} official schema documents; subsequent assembly/validation is offline.`);
}

const columns = [
    ["SourceID", "string", "text"], ["TargetID", "string", "text"],
    ["RelationshipType", "string", "text"], ["EdgeID", "string", "text"],
    ["Weight", "double", "nullable number"], ["DurationMs", "double", "number"],
    ["EventCount", "int64", "Int64.Type"]
];
const domains = [
    { table: "Services", variable: "CyclicServices", label: "Cyclic services", prefix: "S", count: 14 },
    { table: "Accounts", variable: "ReciprocalAccounts", label: "Reciprocal accounts", prefix: "A", count: 16 }
];
const databaseDefinition = "database Network\n\tcompatibilityLevel: 1600\n\tcompatibilityMode: powerBI\n";
const modelDefinition = tables => `model Model\n\tculture: en-US\n\tdefaultPowerBIDataSourceVersion: powerBI_V3\n\tdiscourageImplicitMeasures\n\tsourceQueryCulture: en-US\n\nannotation __PBI_TimeIntelligenceEnabled = 0\n\n${tables.map(table => `ref table ${table}`).join("\n")}\n`;
function tableDefinition(table, rows) {
    const mColumns = columns.map(([name, , type]) => `${name} = ${type}`).join(", ");
    const mRows = rows.map(row => `\t\t\t\t{${row.map(value => JSON.stringify(value)).join(", ")}}`).join(",\n");
    const measures = measureDefinitions(table).map(([name, expression, format]) =>
        `\tmeasure '${name}' = ${expression}\n\t\tformatString: ${format}\n\t\tdisplayFolder: Investigation\n`).join("\n");
    const fields = columns.map(([name, type]) =>
        `\tcolumn ${name}\n\t\tdataType: ${type}\n\t\tsourceColumn: ${name}\n\t\tsummarizeBy: ${type === "string" ? "none" : "sum"}\n${name === "Weight" ? "\t\tformatString: #,0.##\n" : ""}`).join("\n");
    return `table ${table}\n\n${measures}\n${fields}\n\tpartition ${table} = m\n\t\tmode: import\n\t\tsource =\n\t\t\t#table(type table [${mColumns}], {\n${mRows}\n\t\t\t})\n\n\tannotation PBI_ResultType = Table\n`;
}
function dimensionDefinition(table, field, values) {
    return `table ${table}\n\n\tcolumn ${field}\n\t\tdataType: string\n\t\tisKey\n\t\tsourceColumn: ${field}\n\t\tsummarizeBy: none\n\n\tpartition ${table} = m\n\t\tmode: import\n\t\tsource =\n\t\t\t#table(type table [${field} = text], {\n${values.map(value => `\t\t\t\t{${JSON.stringify(value)}}`).join(",\n")}\n\t\t\t})\n\n\tannotation PBI_ResultType = Table\n`;
}
const literal = value => ({ expr: { Literal: { Value: typeof value === "string" ? `'${value.replaceAll("'", "''")}'` : String(value) } } });
function projection(table, name, measure = false) {
    const property = measure ? measureName(table, name) : name;
    return {
        field: { [measure ? "Measure" : "Column"]: { Expression: { SourceRef: { Entity: table } }, Property: property } },
        queryRef: `${table}.${property}`,
        nativeQueryRef: property
    };
}
function visual(name, type, x, y, width, height, queryState, title) {
    return {
        $schema: schemas.visual, name,
        position: { x, y, width, height, z: y * 10 + x, tabOrder: y * 10 + x },
        visual: {
            visualType: type,
            ...(queryState ? { query: { queryState } } : {}),
            visualContainerObjects: {
                title: [{ properties: { show: literal(Boolean(title)), ...(title ? { text: literal(title) } : {}) } }],
                general: [{ properties: { altText: literal(title || name) } }]
            }
        }
    };
}
function textBox(name, text, x, y, width, height, fontSize = "12pt") {
    const result = visual(name, "textbox", x, y, width, height);
    result.visual.objects = { general: [{ properties: { paragraphs: text.split("\n").map(value => ({
        textRuns: [{ value, textStyle: { fontFamily: "Segoe UI", fontSize } }]
    })) } }] };
    return result;
}
const role = (...projections) => ({ projections });
const graphQuery = table => ({
    source: role(projection(table, "SourceID")),
    target: role(projection(table, "TargetID")),
    relationshipType: role(projection(table, "RelationshipType")),
    edgeId: role(projection(table, "EdgeID")),
    weight: role(projection(table, "Total Weight", true)),
    tooltips: role(projection(table, "Average Duration ms", true), projection(table, "Events", true), projection(table, "Input Rows", true))
});
const tasks = {
    Services: [
        "INVESTIGATE A DEPENDENCY",
        "Search Orders, inspect its incoming and outgoing relationships, then compare calls and retries with the relationship-type slicer.",
        "Orders → Payments → Ledger → Orders is a directed cycle. Orders → Orders is a self-loop.",
        "Gateway → Orders contains separate calls and monitors links. Orders → Gateway is reciprocal, not the same edge.",
        "Archive ↔ Backup is disconnected. Local neighborhood controls do not filter the semantic model.",
        "Click an edge or list row to cross-filter the detail table. Clear selection to restore rows."
    ],
    Accounts: [
        "FOLLOW A RELATIONSHIP",
        "Search 0001 (keep the leading zeros). Inspect outgoing transfers and the reverse transfer from 0002.",
        "T01 appears twice with the same endpoints/type; its weight sums to 120. T05 remains a separate parallel edge.",
        "T-CONFLICT is reused with reversed endpoints: both conflicting relationships are omitted and diagnosed.",
        "Zero weight is valid. Blank/negative weights are incomplete, use neutral styling, and are not comparable totals.",
        "Select an edge and compare Accounts Events with Accounts Input Rows in tooltips. These synthetic records do not establish fraud or causality."
    ]
};

async function author() {
    assertUniqueMeasureNames(domains.map(({ table }) => ({ table, measures: measureDefinitions(table).map(([name]) => name) })));
    const pq = await readFile(path.join(root, "samples", "OfflineSamples.pq"), "utf8");
    const contract = { authoredOn: "2026-09-09", source: "samples/OfflineSamples.pq", sourceSha256: hash(pq), guid, domains: [] };
    const allTables = [];
    const relationships = [];
    const pages = [];
    for (const [index, domain] of domains.entries()) {
        const match = pq.match(new RegExp(`${domain.variable} = #table\\(Schema, \\{([\\s\\S]*?)\\n    \\}\\)`));
        assert(match, `Literal source table missing: ${domain.variable}`);
        const rows = [...match[1].matchAll(/\{([^{}]+)\}/g)].map(item => JSON.parse(`[${item[1]}]`));
        assert.equal(rows.length, domain.count);
        assert(rows.every(row => row.length === columns.length && row.slice(0, 4).every(value => typeof value === "string")));
        await put(path.join(modelRoot, "definition", "tables", `${domain.table}.tmdl`), tableDefinition(domain.table, rows));
        allTables.push(domain.table);
        const dimensions = [];
        for (const [suffix, field, columnIndex] of [["Sources", "NodeID", 0], ["Targets", "NodeID", 1], ["Types", "RelationshipType", 2]]) {
            const name = `${domain.table}${suffix}`;
            const values = [...new Set(rows.map(row => row[columnIndex]))].sort();
            await put(path.join(modelRoot, "definition", "tables", `${name}.tmdl`), dimensionDefinition(name, field, values));
            allTables.push(name);
            dimensions.push({ table: name, field, values });
            relationships.push(`relationship ${domain.table}_${suffix}\n\tfromColumn: ${domain.table}.${columns[columnIndex][0]}\n\ttoColumn: ${name}.${field}\n\tcrossFilteringBehavior: oneDirection\n`);
        }
        contract.domains.push({ ...domain, rows, dimensions, measures: measureDefinitions(domain.table) });
        const pageName = `Page${domain.table}`;
        pages.push(pageName);
        const pageRoot = path.join(reportRoot, "definition", "pages", pageName);
        const graph = visual(`${domain.prefix}Graph`, guid, 24, 128, 960, 418, graphQuery(domain.table), `${domain.label}: select a relationship to investigate`);
        graph.visual.objects = { exploration: [{ properties: { view: literal("split"), layout: literal("force") } }] };
        const table = visual(`${domain.prefix}Details`, "tableEx", 24, 566, 960, 178, {
            Values: role(...["SourceID", "TargetID", "RelationshipType", "EdgeID"].map(name => projection(domain.table, name)),
                ...["Total Weight", "Events", "Input Rows", "Average Duration ms"].map(name => projection(domain.table, name, true)))
        }, "Relationship detail — compare with host selections");
        const typeSlicer = visual(`${domain.prefix}Types`, "slicer", 1008, 128, 334, 154, {
            Values: role(projection(`${domain.table}Types`, "RelationshipType"))
        }, "Filter by relationship type");
        const visuals = [
            textBox(`${domain.prefix}Heading`, `${index + 1}. ${domain.label}`, 24, 16, 780, 42, "24pt"),
            textBox(`${domain.prefix}Subheading`, "Synthetic, offline data • Direction ≠ causality • Local exploration ≠ host filtering", 24, 66, 900, 32, "12pt"),
            graph, table, typeSlicer,
            textBox(`${domain.prefix}Guide`, tasks[domain.table].join("\n\n"), 1008, 304, 334, 440, "10pt")
        ];
        await put(path.join(pageRoot, "page.json"), {
            $schema: schemas.page, name: pageName, displayName: `${index + 1}. ${domain.label}`,
            displayOption: "FitToPage", width: 1366, height: 768,
            visualInteractions: [
                { source: graph.name, target: table.name, type: "DataFilter" },
                { source: table.name, target: graph.name, type: "DataFilter" },
                { source: typeSlicer.name, target: graph.name, type: "DataFilter" },
                { source: typeSlicer.name, target: table.name, type: "DataFilter" }
            ]
        });
        for (const item of visuals) await put(path.join(pageRoot, "visuals", item.name, "visual.json"), item);
    }
    await put(path.join(reportRoot, "definition", "pages", "PageHints", "page.json"), {
        $schema: schemas.page, name: "PageHints", displayName: "5. Hints and semantics",
        displayOption: "FitToPage", width: 1366, height: 768
    });
    const hints = [
        "5. Hints and semantics",
        "START OFFLINE: open Network.pbip with current Power BI Desktop; enable PBIP/PBIR/TMDL preview features if required. Refresh loads only literal in-project tables; it needs no files, credentials or network data source.",
        "BINDING: Source ID and Target ID are text. Edge ID and relationship type are categories. Services Total Weight and Accounts Total Weight are SUM measures. Tooltip measures use the same table prefixes: e.g. Accounts Average Duration ms, Accounts Events and Accounts Input Rows. All 14 measure names are model-global unique. Two source rows for T01 become one Power BI category tuple with weight 120.",
        "INVESTIGATION: distinguish source → target direction, reciprocal pairs, parallel typed relationships, self-loops and disconnected components. Use search and local neighborhood controls for exploration; use host selections and slicers for model filtering.",
        "MODEL: separate source-node and target-node dimension tables avoid ambiguous bidirectional filter paths. Type dimensions filter edge facts through single-direction many-to-one relationships. Cycles in the drawn graph are not model relationship cycles.",
        "LIMITS: this is a bounded relationship explorer, not a DAG/process miner, causal inference engine, fraud detector, arbitrary large-graph engine, or raw-event deduplication service. Incomplete known weight is not a complete total or financial balance.",
        "RELEASE CHECK: the embedded private visual is assembled from the actual release PBIVIZ. sample-validation.json records archive and per-resource SHA-256 equality. This source project is not a PBIX and is not evidence of Microsoft certification.",
        "NATIVE GATE: refresh, inspect all four graphs and tooltips, test slicer/table cross-filtering, save and reopen, then Save As PBIX. Retest offline and verify the embedded version/content before submitting. No native validation is claimed by this authored source."
    ];
    await put(path.join(reportRoot, "definition", "pages", "PageHints", "visuals", "Hints", "visual.json"),
        textBox("Hints", hints.join("\n\n"), 32, 24, 1290, 712, "14pt"));
    for (const [index, mode] of ["circular", "radial"].entries()) {
        const label = mode === "circular" ? "Circular" : "Radial";
        const pageName = `Page${label}`;
        pages.push(pageName);
        const pageRoot = path.join(reportRoot, "definition", "pages", pageName);
        const graph = visual(`${label}Graph`, guid, 24, 100, 960, 644, graphQuery("Services"), `${label}: the same directed service relationships`);
        graph.visual.objects = { exploration: [{ properties: { view: literal("split"), layout: literal(mode) } }] };
        const guide = mode === "circular" ? [
            "ONE CIRCLE, ALL LOADED ENTITIES",
            "The same 8 entities and 14 service relationships appear on one circle in stable typed-ID order, including Archive/Backup.",
            "Angle and proximity have no distance, hierarchy or importance meaning. This is a node-link diagram, not chord ribbons or bundled edges.",
            "Arrowheads preserve source-to-target direction, reciprocal and parallel links, cycles and real self-loops.",
            "The outside arc lanes avoid unrelated node glyphs. Dense lanes may overlap: inspect exact edges using Relationships.",
            "Change Layout locally without changing Power BI selection. Graph/List changes representation, not layout. Save local view is explicit."
        ] : [
            "LOADED UNDIRECTED HOP RINGS",
            "Automatic center is Orders: largest component, most distinct non-self neighbors, then stable ID. This is a layout convenience, not centrality or business importance.",
            "Use the Radial center selector or Use as radial center in the entity list. This does not change visible local focus, weights, report filters or selection.",
            "Each ring is minimum UNDIRECTED hop distance over all loaded relationships. Arrows still preserve original direction. Parallel edges and loops do not add hops.",
            "Archive/Backup is separately packed with its own real center; there is no distance between disconnected components.",
            "A filtered-out requested center is retained, with a visible automatic fallback, and returns when loaded again.",
            "Search, focus and highlights do not move nodes. Save local view stores mode/center; native bookmark and Desktop/Service replay still require owner verification."
        ];
        await put(path.join(pageRoot, "page.json"), {
            $schema: schemas.page, name: pageName, displayName: `${index + 3}. ${label} relationships`,
            displayOption: "FitToPage", width: 1366, height: 768
        });
        for (const item of [
            textBox(`${label}Heading`, `${index + 3}. ${label} relationships`, 24, 16, 1290, 64, "24pt"),
            graph, textBox(`${label}Guide`, guide.join("\n\n"), 1008, 100, 334, 644, "11pt")
        ]) await put(path.join(pageRoot, "visuals", item.name, "visual.json"), item);
    }
    pages.push("PageHints");
    await put(path.join(sample, "Network.pbip"), { $schema: schemas.pbip, version: "1.0", artifacts: [{ report: { path: reportName } }], settings: { enableAutoRecovery: true } });
    await put(path.join(reportRoot, "definition.pbir"), { $schema: schemas.pbir, version: PBIR_ARTIFACT_VERSION, datasetReference: { byPath: { path: `../${modelName}` } } });
    await put(path.join(modelRoot, "definition.pbism"), { $schema: schemas.pbism, version: "4.0", settings: {} });
    await put(path.join(modelRoot, "definition", "database.tmdl"), databaseDefinition);
    await put(path.join(modelRoot, "definition", "model.tmdl"), modelDefinition(allTables));
    await put(path.join(modelRoot, "definition", "relationships.tmdl"), relationships.join("\n"));
    await put(path.join(reportRoot, "definition", "version.json"), { $schema: schemas.version, version: PBIR_DEFINITION_VERSION });
    await put(path.join(reportRoot, "definition", "pages", "pages.json"), { $schema: schemas.pages, pageOrder: pages, activePageName: pages[0] });
    await put(path.join(reportRoot, "definition", "report.json"), { $schema: schemas.report, themeCollection: {}, resourcePackages: [] });
    await put(path.join(sample, "sample-contract.json"), contract);
    console.log("Authored 5 PBIR pages, 4 bound graphs (Force/Circular/Radial), 8 typed TMDL tables, 14 measures and 6 model relationships.");
}

async function artifact() {
    const config = await json(path.join(root, "pbiviz.json"));
    assert.equal(config.visual.guid, guid);
    const filename = `${guid}.${config.visual.version}.pbiviz`;
    assert.deepEqual((await readdir(path.join(root, "dist"))).filter(name => name.endsWith(".pbiviz")), [filename], "Remove stale release packages before assembling the sample.");
    const bytes = await readFile(path.join(root, "dist", filename));
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
    const manifest = JSON.parse(await zip.file("package.json").async("string"));
    const resource = manifest.resources.find(item => item.resourceId === manifest.metadata.pbivizjson.resourceId);
    assert(resource && resource.sourceType === 5);
    assert(resource.file.startsWith("resources/"), "PBIR private-visual metadata must resolve inside the package resources directory.");
    const payload = JSON.parse(await zip.file(resource.file).async("string"));
    assert.equal(payload.visual.guid, guid);
    assert.equal(payload.visual.version, config.visual.version);
    assert.equal(manifest.version, config.visual.version);
    assert.equal(payload.apiVersion, config.apiVersion);
    assert.deepEqual(payload.capabilities, await json(path.join(root, config.capabilities)));
    assert.deepEqual(payload.capabilities.privileges, []);
    assert.deepEqual(payload.externalJS, []);
    assert(payload.content.js.length > 1000 && payload.content.css.length > 100, "Compiled visual content is missing.");
    return { filename, bytes, zip, manifest, payload, resource, config };
}
async function assemble(release) {
    const customRoot = path.join(reportRoot, "CustomVisuals");
    await rm(customRoot, { recursive: true, force: true });
    for (const entry of Object.values(release.zip.files)) {
        if (entry.dir) continue;
        assert(entry.name === (entry.unsafeOriginalName ?? entry.name), `Unsafe archive entry: ${entry.name}`);
        assert(!entry.name.split(/[\\/]/).includes("..") && !/^(?:[\\/]|[A-Za-z]:)/.test(entry.name));
        await put(inside(path.join(customRoot, guid), entry.name), await entry.async("nodebuffer"));
    }
    await put(path.join(sample, "package", release.filename), release.bytes);
    // Retain previous candidate archives as immutable history; only the current version is embedded.
    const reportFile = path.join(reportRoot, "definition", "report.json");
    const definition = await json(reportFile);
    definition.publicCustomVisuals = [];
    definition.organizationCustomVisuals = [];
    definition.resourcePackages = [{
        name: guid, type: "CustomVisual", items: [{
            name: path.posix.basename(release.resource.file), path: release.resource.file.slice("resources/".length), type: "CustomVisualMetadata"
        }]
    }];
    await put(reportFile, definition);
}
async function validate(release) {
    const evidence = { status: "local-structure-only", assemblerSha256: hash(await readFile(path.join(root, "scripts", "sample-package.mjs"))), visual: { guid, version: release.config.visual.version, apiVersion: release.payload.apiVersion }, archive: {}, resources: [], schemas: {}, model: {}, limitations: [
        "No Power BI Desktop opening, Power Query refresh, DAX execution or PBIX conversion is performed by this script.",
        "TMDL validation is a strict authored-template and referential check, not a substitute for Microsoft's TOM/TMDL parser or native model loading.",
        "Public PBIR schemas validate structure, not Power BI query execution, custom-visual loading, native layout or host interactions.",
        "A cache-free PBIP opens without imported rows until Desktop refreshes its literal tables. No cache.abf or fabricated PBIX is included.",
        "Partner Center requires an offline PBIX with the same visual version/content; native conversion and offline retest remain release blockers.",
        "No certification, marketplace submission, publication, permission change or cloud execution is performed."
    ] };
    const copy = await readFile(path.join(sample, "package", release.filename));
    assert(copy.equals(release.bytes), "The offline package copy differs from the actual dist artifact.");
    evidence.archive = { source: `dist/${release.filename}`, embeddedCopy: `package/${release.filename}`, bytes: copy.length, sourceSha256: hash(release.bytes), embeddedSha256: hash(copy), equal: true };
    const customRoot = path.join(reportRoot, "CustomVisuals", guid);
    const expectedFiles = [];
    for (const entry of Object.values(release.zip.files)) {
        if (entry.dir) continue;
        const source = await entry.async("nodebuffer");
        const destination = inside(customRoot, entry.name);
        const embedded = await readFile(destination);
        assert(source.equals(embedded), `Embedded custom-visual resource differs from final package: ${entry.name}`);
        expectedFiles.push(destination);
        evidence.resources.push({ path: entry.name, bytes: source.length, sourceSha256: hash(source), embeddedSha256: hash(embedded), equal: true });
    }
    assert.deepEqual((await filesBelow(customRoot)).sort(), expectedFiles.sort());
    const bundle = await json(path.join(sample, "schemas", "bundle.json"));
    const ajv = new Ajv({ allErrors: true, schemaId: "auto", jsonPointers: true, unknownFormats: "ignore", logger: false });
    for (const [uri, document] of Object.entries(bundle.documents)) {
        assert.equal(hash(document.text), document.sha256, `Cached schema changed: ${uri}`);
        const schema = JSON.parse(document.text);
        // Some upstream embedded schemas deliberately omit $id; retain the fetched URI as their base.
        ajv.addSchema(schema, uri);
    }
    const projectFiles = [path.join(sample, "Network.pbip"), path.join(reportRoot, "definition.pbir"), path.join(modelRoot, "definition.pbism"),
        ...(await filesBelow(path.join(reportRoot, "definition"))).filter(file => file.endsWith(".json"))];
    for (const required of ["version.json", "report.json", path.join("pages", "pages.json")]) {
        assert(projectFiles.includes(path.join(reportRoot, "definition", required)), `Required PBIR structure missing: ${required}`);
    }
    for (const filename of projectFiles) {
        const document = await json(filename);
        assert(document.$schema, `Missing public schema: ${filename}`);
        const validator = ajv.getSchema(document.$schema);
        assert(validator, `Uncached schema: ${document.$schema}`);
        assert(validator(document), `${path.relative(sample, filename)}: ${ajv.errorsText(validator.errors, { separator: "\n" })}`);
    }
    evidence.schemas = { commit: bundle.commit, documents: Object.keys(bundle.documents).length, validatedFiles: projectFiles.length };
    const shortcut = await json(path.join(sample, "Network.pbip"));
    assert.equal(inside(sample, shortcut.artifacts[0].report.path), reportRoot);
    const definition = await json(path.join(reportRoot, "definition.pbir"));
    const versionMetadata = await json(path.join(reportRoot, "definition", "version.json"));
    assertReportVersions(definition, versionMetadata);
    evidence.reportVersions = {
        artifact: definition.version, definition: versionMetadata.version,
        validatorSha256: hash(await readFile(path.join(root, "scripts", "sample-report-versions.mjs")))
    };
    assert.deepEqual(Object.keys(definition.datasetReference), ["byPath"]);
    assert.equal(inside(reportRoot, definition.datasetReference.byPath.path), modelRoot);
    const report = await json(path.join(reportRoot, "definition", "report.json"));
    assert.deepEqual(report.publicCustomVisuals, []);
    assert.deepEqual(report.organizationCustomVisuals, []);
    assert.equal(report.resourcePackages.length, 1);
    assert.equal(report.resourcePackages[0].name, guid);
    assert.equal(report.resourcePackages[0].type, "CustomVisual");
    assert.equal(report.resourcePackages[0].items[0].type, "CustomVisualMetadata");
    assert.equal(report.resourcePackages[0].items[0].name, path.posix.basename(release.resource.file));
    assert.equal(inside(path.join(customRoot, "resources"), report.resourcePackages[0].items[0].path), inside(customRoot, release.resource.file));
    const contract = await json(path.join(sample, "sample-contract.json"));
    assert.equal(contract.source, "samples/OfflineSamples.pq", "Unexpected literal sample source");
    assert.equal(contract.sourceSha256, hash(await readFile(path.join(root, "samples", "OfflineSamples.pq"))),
        "Sample contract differs from its literal source; regenerate the authored sample");
    const expectedTables = new Map();
    const expectedRelationships = [];
    const tableFiles = (await readdir(path.join(modelRoot, "definition", "tables"))).sort();
    const modelTables = new Map();
    const modelMeasures = [];
    for (const filename of tableFiles) {
        const source = await readFile(path.join(modelRoot, "definition", "tables", filename), "utf8");
        modelTables.set(filename, source);
        modelMeasures.push({
            table: path.basename(filename, ".tmdl"),
            measures: [...source.matchAll(/^\tmeasure '((?:[^']|'')+)' =/gm)].map(match => match[1].replaceAll("''", "'"))
        });
    }
    assertUniqueMeasureNames(modelMeasures);
    assertUniqueMeasureNames(contract.domains.map(domain => ({ table: domain.table, measures: domain.measures.map(([name]) => name) })));
    for (const domain of contract.domains) {
        assert.equal(domain.rows.length, domain.count);
        assert.deepEqual(domain.measures, measureDefinitions(domain.table), `Stale measure metadata: ${domain.table}`);
        const source = modelTables.get(`${domain.table}.tmdl`);
        assert.equal(source, tableDefinition(domain.table, domain.rows), `Authored literal table or measure changed: ${domain.table}`);
        expectedTables.set(domain.table, new Map([...columns.map(([name, type]) => [name, type]), ...domain.measures.map(([name]) => [name, "measure"])]));
        for (const dimension of domain.dimensions) {
            assert.equal(new Set(dimension.values).size, dimension.values.length);
            assert.equal(await readFile(path.join(modelRoot, "definition", "tables", `${dimension.table}.tmdl`), "utf8"), dimensionDefinition(dimension.table, dimension.field, dimension.values));
            expectedTables.set(dimension.table, new Map([[dimension.field, "string"]]));
            const suffix = dimension.table.slice(domain.table.length);
            const factColumn = suffix === "Sources" ? "SourceID" : suffix === "Targets" ? "TargetID" : "RelationshipType";
            const index = columns.findIndex(([name]) => name === factColumn);
            assert(domain.rows.every(row => dimension.values.includes(row[index])), `Orphan relationship key in ${domain.table}`);
            expectedRelationships.push(`relationship ${domain.table}_${suffix}\n\tfromColumn: ${domain.table}.${factColumn}\n\ttoColumn: ${dimension.table}.${dimension.field}\n\tcrossFilteringBehavior: oneDirection\n`);
        }
    }
    assert.equal(await readFile(path.join(modelRoot, "definition", "relationships.tmdl"), "utf8"), expectedRelationships.join("\n"));
    const model = await readFile(path.join(modelRoot, "definition", "model.tmdl"), "utf8");
    assert.deepEqual([...model.matchAll(/^ref table (.+)$/gm)].map(match => match[1]).sort(), [...expectedTables.keys()].sort());
    assert.equal(model, modelDefinition([...expectedTables.keys()]), "Unsupported authored model root change");
    assert.equal(await readFile(path.join(modelRoot, "definition", "database.tmdl"), "utf8"), databaseDefinition, "Unsupported authored database root change");
    assert.deepEqual(tableFiles, [...expectedTables.keys()].map(table => `${table}.tmdl`).sort());
    for (const filename of await filesBelow(modelRoot)) {
        const text = await readFile(filename, "utf8");
        assert(!/(?:Web\.|File\.|Folder\.|Sql\.|OData\.|SharePoint\.|AzureStorage\.|AnalysisServices\.|Extension\.|Value\.NativeQuery|dataSource\s|https?:\/\/|powerbi:\/\/)/i.test(text.replace(/"\$schema":\s*"[^"]+"/g, "")), `External data source forbidden: ${filename}`);
    }
    const pages = await json(path.join(reportRoot, "definition", "pages", "pages.json"));
    assert.deepEqual(pages.pageOrder, ["PageServices", "PageAccounts", "PageCircular", "PageRadial", "PageHints"]);
    assert(pages.pageOrder.includes(pages.activePageName));
    let graphCount = 0;
    let bindings = 0;
    const roleNames = new Set(release.payload.capabilities.dataRoles.map(item => item.name));
    for (const pageName of pages.pageOrder) {
        const pageRoot = path.join(reportRoot, "definition", "pages", pageName);
        const page = await json(path.join(pageRoot, "page.json"));
        assert.equal(page.name, pageName);
        const visualFiles = (await filesBelow(path.join(pageRoot, "visuals"))).filter(file => file.endsWith("visual.json"));
        const ids = [];
        for (const filename of visualFiles) {
            const container = await json(filename);
            ids.push(container.name);
            assert.equal(path.basename(path.dirname(filename)), container.name);
            const position = container.position;
            assert(position.x >= 0 && position.y >= 0 && position.x + position.width <= page.width && position.y + position.height <= page.height, `Off-page visual: ${container.name}`);
            if (container.visual.visualType === guid) {
                graphCount++;
                const tableName = ["PageCircular", "PageRadial"].includes(pageName) ? "Services" : pageName.slice("Page".length);
                const layout = pageName === "PageCircular" ? "circular" : pageName === "PageRadial" ? "radial" : "force";
                assert.deepEqual(container.visual.objects.exploration[0].properties.layout, literal(layout), "Sample layout is not wired to the author property");
                const state = container.visual.query.queryState;
                assert.deepEqual(Object.keys(state).sort(), ["edgeId", "relationshipType", "source", "target", "tooltips", "weight"]);
                const expectedRoleFields = {
                    source: ["SourceID"], target: ["TargetID"], relationshipType: ["RelationshipType"], edgeId: ["EdgeID"],
                    weight: [measureName(tableName, "Total Weight")],
                    tooltips: ["Average Duration ms", "Events", "Input Rows"].map(name => measureName(tableName, name))
                };
                for (const [name, value] of Object.entries(state)) {
                    assert(roleNames.has(name), `Role absent from final visual: ${name}`);
                    const condition = release.payload.capabilities.dataViewMappings[0].conditions[0][name];
                    assert(value.projections.length >= (condition.min ?? 0) && value.projections.length <= (condition.max ?? Infinity), `Role cardinality mismatch: ${name}`);
                    assert.deepEqual(value.projections.map(item => (item.field.Column || item.field.Measure)?.Property), expectedRoleFields[name], `Unexpected sample field mapping for ${name}`);
                    for (const item of value.projections) {
                        const reference = item.field.Column || item.field.Measure;
                        assert.equal(reference?.Expression.SourceRef.Entity, tableName, `Cross-domain field mapping for ${name}`);
                        const type = expectedTables.get(reference?.Expression.SourceRef.Entity)?.get(reference?.Property);
                        assert.equal(type, ["weight", "tooltips"].includes(name) ? "measure" : "string", `Incorrect role binding type: ${name}`);
                    }
                }
            } else assert(["textbox", "slicer", "tableEx"].includes(container.visual.visualType), "Unexpected external visual.");
            walk(container.visual.query, value => {
                const projectionReference = value.field?.Column || value.field?.Measure;
                if (projectionReference) {
                    assert.equal(value.queryRef, `${projectionReference.Expression.SourceRef.Entity}.${projectionReference.Property}`, "Stale PBIR queryRef");
                    assert.equal(value.nativeQueryRef, projectionReference.Property, "Stale PBIR nativeQueryRef");
                }
                const reference = value.Column || value.Measure;
                if (!reference) return;
                const fields = expectedTables.get(reference.Expression.SourceRef.Entity);
                assert(fields && fields.has(reference.Property), `Broken model binding: ${JSON.stringify(reference)}`);
                assert.equal(fields.get(reference.Property) === "measure", Boolean(value.Measure), "Column/measure binding kind mismatch");
                bindings++;
            });
        }
        assert.equal(new Set(ids).size, ids.length);
        for (const interaction of page.visualInteractions || []) assert(ids.includes(interaction.source) && ids.includes(interaction.target), "Broken interaction link");
    }
    assert.equal(graphCount, 4);
    const accounts = contract.domains.find(domain => domain.table === "Accounts");
    assert(accounts.rows.every(row => /^000[1-8]$/.test(row[0]) && /^000[1-8]$/.test(row[1])), "Leading-zero text IDs must be preserved");
    assert.equal(accounts.rows.filter(row => row[3] === "T01").reduce((sum, row) => sum + row[4], 0), 120);
    evidence.model = { tables: expectedTables.size, relationships: expectedRelationships.length, measures: contract.domains.reduce((count, domain) => count + domain.measures.length, 0),
        globallyUniqueMeasureNames: true, measureNames: modelMeasures,
        measureValidatorSha256: hash(await readFile(path.join(root, "scripts", "sample-measures.mjs"))),
        pages: pages.pageOrder.length, boundGraphVisuals: graphCount, verifiedFieldBindings: bindings, rows: Object.fromEntries(contract.domains.map(domain => [domain.table, domain.rows.length])),
        externalDataSources: 0, validation: "strict-authored-template-and-references" };
    evidence.sourceFiles = [];
    for (const filename of [...projectFiles, ...(await filesBelow(modelRoot)).filter(file => file.endsWith(".tmdl"))].sort()) {
        evidence.sourceFiles.push({ path: path.relative(sample, filename).replaceAll(path.sep, "/"), sha256: hash(await readFile(filename)) });
    }
    await put(path.join(sample, "sample-validation.json"), evidence);
    console.log(`PASS: ${projectFiles.length} schema-validated files; ${graphCount} bound graphs; ${bindings} field bindings; exact PBIVIZ SHA-256 ${hash(copy)}.`);
    console.log("Native Desktop refresh/open, model execution, PBIX conversion and submission tests remain unverified.");
}

const flags = new Set(args);
for (const flag of flags) assert(["--author", "--refresh-schemas", "--validate"].includes(flag), `Unknown argument: ${flag}`);
if (flags.has("--refresh-schemas")) await refreshSchemas();
if (flags.has("--author")) await author();
const release = await artifact();
if (!flags.has("--validate")) await assemble(release);
await validate(release);
