import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { digest, readArtifact, root } from "./artifact.mjs";
import { buildInputs } from "./provenance.mjs";

export const HOST_DISCLAIMER = "Actual PBIVIZ compiled JS/CSS in offline Chromium; Power BI APIs are mocked. Not native Desktop/Service, export, accessibility certification, Partner Center, or AppSource proof.";
export const TILES = [[80, 80], [258, 198], [398, 298], [1280, 620], [1366, 768]];

export async function loadBrowserArtifact() {
    if (!process.env.BROWSER_ARTIFACT) return readArtifact();
    const filename = path.resolve(process.env.BROWSER_ARTIFACT);
    assert(!path.relative(root, filename).startsWith(".."), "Historical browser artifact must remain inside this worktree");
    const bytes = await readFile(filename);
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
    const manifest = JSON.parse(await zip.file("package.json").async("string"));
    const entry = manifest.resources.find(item => item.resourceId === manifest.metadata.pbivizjson.resourceId);
    const visual = JSON.parse(await zip.file(entry.file).async("string"));
    assert.equal(visual.visual.guid, "AtlynNetworkAB24C68297094C32AF64D50D92C01711");
    assert.equal(manifest.visual.guid, visual.visual.guid);
    assert.equal(manifest.version, visual.visual.version);
    assert.equal(typeof visual.content.js, "string");
    assert.equal(typeof visual.content.css, "string");
    return { filename: path.basename(filename), bytes, manifest, visual, config: { visual: visual.visual }, sha256: digest(bytes), historical: true };
}

export async function createBrowserHarness({ artifact, touch = false } = {}) {
    artifact ??= await loadBrowserArtifact();
    if (!artifact.historical) {
        const manifest = JSON.parse(await readFile(path.join(root, "dist", "build-inputs.json"), "utf8"));
        assert.equal(manifest.sha256, artifact.sha256, "Build-input manifest belongs to a different PBIVIZ; the package owner must rebuild");
        const current = await buildInputs();
        const changed = [...new Set([...Object.keys(manifest.inputs), ...Object.keys(current)])]
            .filter(key => JSON.stringify(manifest.inputs[key]) !== JSON.stringify(current[key]));
        assert.deepEqual(changed, [], "Source/build inputs changed since packaging; final evidence requires a stable package baseline");
        artifact.buildInputSha256 = digest(JSON.stringify(current));
    }
    const browserWork = path.join(root, ".tool-home", "browser");
    await mkdir(browserWork, { recursive: true });
    process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(root, ".browser-cache");
    process.env.TEMP = browserWork;
    process.env.TMP = browserWork;
    process.env.TMPDIR = browserWork;
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? chromium.executablePath()
    });
    const context = await browser.newContext({
        viewport: { width: 1600, height: 1000 }, offline: true, serviceWorkers: "block", hasTouch: touch
    });
    const requests = [];
    const errors = [];
    const errorDetails = [];
    await context.route("**/*", async route => {
        requests.push(route.request().url());
        await route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", error => {
        errors.push(error.message);
        errorDetails.push({ kind: "pageerror", message: error.message, stack: error.stack });
    });
    page.on("console", message => {
        if (message.type() === "error") {
            errors.push(message.text());
            errorDetails.push({ kind: "console", message: message.text(), location: message.location() });
        }
    });
    async function mount({ width = 1280, height = 620, locale = "en-US", highContrast = false, append = false, name = "fixture" } = {}) {
        if (!append) {
            await page.evaluate(() => { for (const fixture of Object.values(window.fixtures ?? {})) fixture.visual.destroy(); });
            await page.setContent("<!doctype html><html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'\"></head><body style=\"margin:0\"></body></html>");
            await page.evaluate(() => { window.powerbi = { visuals: { plugins: {} } }; window.fixtures = {}; });
            await page.addStyleTag({ content: artifact.visual.content.css });
            await page.addScriptTag({ content: artifact.visual.content.js });
        }
        await page.evaluate(installMockHost, { guid: artifact.config.visual.guid, resources: artifact.visual.stringResources, locale, highContrast, width, height, name });
    }
    async function update(rows, options = {}, name = "fixture") {
        const events = await page.evaluate(({ rows, options, name }) => {
            const fixture = window.fixtures[name];
            fixture.update(rows, options);
            return fixture.calls.lifecycle;
        }, { rows, options, name });
        assert.equal(events.at(-1), "finished", `Rendering failed: ${events.join(", ")}`);
    }
    const settle = () => page.evaluate(async () => {
        for (let i = 0; i < 4; i++) await new Promise(resolve => window.requestAnimationFrame(resolve));
    });
    return { artifact, browser, context, page, requests, errors, errorDetails, mount, update, settle, close: () => browser.close() };
}

export function installMockHost({ guid, resources, locale, highContrast, width, height, name = "fixture" }) {
    const calls = { select: [], clear: 0, context: [], tooltips: [], tooltipHides: 0, tooltipVisible: false, lifecycle: [], forbidden: [], persist: [], settled: 0 };
    const faults = { select: false, clear: false, persist: false, tooltip: false, tooltipEnabled: false, tooltipHide: false, defer: false };
    let selected = [];
    let callback = () => {};
    let pending = [];
    const identity = (key, selectors) => ({
        getKey: () => key, hasIdentity: () => true,
        getSelector: () => ({ data: selectors }), getSelectorsByColumn: () => ({ dataMap: selectors }),
        equals: other => other?.getKey?.() === key, includes: other => other?.getKey?.() === key
    });
    const complete = (kind, action) => new Promise((resolve, reject) => {
        const finish = () => {
            if (faults[kind]) reject(new Error(`Injected mock ${kind} failure`));
            else { action(); callback(); resolve(selected); }
            calls.settled++;
        };
        if (faults.defer) pending.push(finish);
        else window.queueMicrotask(finish);
    });
    const manager = {
        select(ids, multi) {
            calls.select.push({ keys: ids.map(id => id.getKey()), multi });
            return complete("select", () => {
                if (!multi) selected = ids;
                else {
                    const keys = new Set(ids.map(id => id.getKey()));
                    const existing = new Set(selected.map(id => id.getKey()));
                    selected = [...selected.filter(id => !keys.has(id.getKey())), ...ids.filter(id => !existing.has(id.getKey()))];
                }
            });
        },
        clear() { calls.clear++; return complete("clear", () => { selected = []; }); },
        getSelectionIds: () => selected, hasSelection: () => selected.length > 0,
        registerOnSelectCallback(fn) { callback = fn; },
        showContextMenu(id, position) {
            calls.context.push({ key: id.getKey?.() ?? null, position });
            return Promise.resolve();
        }
    };
    const host = {
        locale,
        hostCapabilities: { allowInteractions: true },
        createSelectionManager: () => manager,
        createSelectionIdBuilder() {
            const parts = [];
            const builder = {
                withCategory(column, index) { parts.push([column.source.queryName, column.identity[index].key]); return builder; },
                withMeasure() { throw new Error("Measure identity must not substitute for relationship identity"); },
                createSelectionId: () => identity(JSON.stringify(parts), parts)
            };
            return builder;
        },
        createLocalizationManager: () => ({ getDisplayName: key => resources[locale]?.[key] ?? key }),
        colorPalette: {
            isHighContrast: highContrast,
            foreground: { value: "#FFFF00" }, background: { value: "#000000" },
            foregroundSelected: { value: "#00FFFF" }, hyperlink: { value: "#00FFFF" },
            getColor: () => ({ value: "#007D87" })
        },
        tooltipService: {
            enabled() { if (faults.tooltipEnabled) throw new Error("Injected tooltip enabled failure"); return true; },
            show(info) { if (faults.tooltip) throw new Error("Injected tooltip failure"); calls.tooltips.push(info); calls.tooltipVisible = true; },
            move: () => {},
            hide() { calls.tooltipHides++; if (faults.tooltipHide) throw new Error("Injected tooltip hide failure"); calls.tooltipVisible = false; }
        },
        eventService: {
            renderingStarted: () => calls.lifecycle.push("started"),
            renderingFinished: () => calls.lifecycle.push("finished"),
            renderingFailed: (_options, message) => calls.lifecycle.push(`failed: ${message}`)
        },
        fetchMoreData: () => { calls.forbidden.push("fetchMoreData"); throw new Error("Segment fetching forbidden"); },
        launchUrl: () => { calls.forbidden.push("launchUrl"); throw new Error("Network navigation forbidden"); },
        persistProperties(value) {
            if (faults.persist) throw new Error("Injected persist failure");
            calls.persist.push(value);
        },
        refreshHostData: () => {}, displayWarningIcon: () => {}
    };
    let container = document.getElementById(name === "fixture" ? "visual" : name);
    if (!container) { container = document.createElement("div"); container.id = name === "fixture" ? "visual" : name; document.body.append(container); }
    const visual = window.powerbi.visuals.plugins[guid].create({ element: container, host });
    const state = {
        visual, host, calls, faults, rows: [], view: undefined, container,
        release() { const ready = pending; pending = []; ready.forEach(finish => finish()); },
        createView(rows, options = {}) {
            const fields = ["source", "target", ...(options.types === false ? [] : ["relationshipType"]), ...(options.edgeIds ? ["edgeId"] : [])];
            const categories = fields.map(role => ({
                source: { displayName: role, queryName: `fixture.${role}`, roles: { [role]: true }, type: { text: true } },
                values: rows.map(row => row[role === "relationshipType" ? "type" : role] ?? (role === "relationshipType" ? "uses" : null)),
                identity: options.missingIdentity === role ? undefined : rows.map((_, index) => ({ key: `${role}:${index}` }))
            }));
            const values = options.weighted === false ? [] : [{
                source: { displayName: "Delivered weight", queryName: "fixture.weight", roles: { weight: true }, type: { numeric: true }, format: "0.00" },
                values: rows.map(row => row.weight ?? null),
                ...(options.highlights ? { highlights: rows.map(row => row.highlight ?? null) } : {})
            }];
            for (const field of options.tooltipFields ?? [{ key: "tooltip", displayName: "Delivered tooltip", format: "0.00" }]) values.push({
                source: { displayName: field.displayName, queryName: `fixture.${field.key}`, roles: { tooltips: true }, type: { numeric: true }, format: field.format ?? "0.00" },
                values: rows.map((row, index) => row[field.key] ?? (field.key === "tooltip" ? index : null))
            });
            values.grouped = () => [{ values }];
            return {
                metadata: { columns: [...categories.map(column => column.source), ...values.map(column => column.source)], ...(options.partial ? { segment: {} } : {}), objects: options.objects ?? {} },
                categorical: { categories, values }
            };
        },
        update(rows, options = {}) {
            state.rows = rows;
            state.view = state.createView(rows, options);
            visual.update({ dataViews: [state.view], viewport: { width: options.width ?? width, height: options.height ?? height }, type: 2 });
        },
        resize(w, h) { visual.update({ viewport: { width: w, height: h }, type: 4 }); },
        setHostSelection(indices) {
            selected = indices.map(index => {
                let builder = host.createSelectionIdBuilder();
                for (const category of state.view.categorical.categories) builder = builder.withCategory(category, index);
                return builder.createSelectionId();
            });
            callback();
        }
    };
    window.fixtures ??= {};
    window.fixtures[name] = state;
    window[name] = state;
}

export function releaseFixtures() {
    const name = index => `N${String(index).padStart(3, "0")}`;
    const maximumEdges = Array.from({ length: 1000 }, (_, index) => {
        const node = index % 250;
        const group = Math.floor(index / 250);
        return {
            source: name(group === 2 ? (node + 1) % 250 : node),
            target: name(group === 0 ? node : group === 2 ? node : (node + 1) % 250),
            type: group === 0 ? "self" : group === 2 ? "return" : "transfer",
            edgeId: `E${String(index).padStart(4, "0")}`, weight: index % 7
        };
    });
    const maximum = Array.from({ length: 5 }, () => maximumEdges.map(row => ({ ...row }))).flat();
    const typical = [
        ["Intake", "Review"], ["Review", "Approve"], ["Approve", "Deploy"], ["Deploy", "Monitor"],
        ["Monitor", "Review"], ["Review", "Intake"], ["Review", "Review"], ["Review", "Approve"],
        ["Archive", "Retain"], ["Retain", "Archive"]
    ].map(([source, target], index) => ({ source, target, type: index === 7 ? "expedite" : "workflow", edgeId: `W${index}`, weight: index }));
    const accounts = [
        ["Account 101", "Account 202"], ["Account 202", "Account 101"], ["Account 101", "Account 202"],
        ["Account 202", "Account 303"], ["Account 303", "Account 101"], ["Account 202", "Account 202"]
    ].map(([source, target], index) => ({ source, target, type: index === 2 ? "refund" : "transfer", edgeId: `A${index}`, weight: index * 125 }));
    return { typical, maximum, accounts };
}

export async function microsoftSankeyFixture() {
    const filename = path.join("test", "fixtures", "microsoft-sankey.json");
    const bytes = await readFile(path.join(root, filename));
    const fixture = JSON.parse(bytes);
    assert.deepEqual(fixture.columns, ["Origin City", "Destination City", "Passenger Volume"]);
    assert.equal(fixture.rows.length, 9);
    assert.equal(fixture.provenance.sheet, "Sankey Chart");
    const rows = fixture.rows.map(([source, target, weight]) => ({ source, target, weight }));
    assert.equal(rows.reduce((sum, row) => sum + row.weight, 0), 6975);
    return {
        rows, options: { types: false, edgeIds: false, tooltipFields: [] },
        provenance: { ...fixture.provenance, fixtureFile: filename, fixtureSha256: digest(bytes) }
    };
}

export async function releaseSampleFixtures() {
    const filename = path.join("samples", "release", "sample-contract.json");
    const bytes = await readFile(path.join(root, filename));
    const contract = JSON.parse(bytes);
    assert.equal(contract.guid, "AtlynNetworkAB24C68297094C32AF64D50D92C01711");
    const source = path.resolve(root, ...contract.source.split(/[\\/]/));
    assert(!path.relative(root, source).startsWith(".."), "Sample literal source must remain inside the worktree");
    assert.equal(digest(await readFile(source)), contract.sourceSha256, "Sample contract differs from its literal source; regenerate it before capturing evidence");
    const domains = {};
    for (const name of ["Services", "Accounts"]) {
        const domain = contract.domains.find(domain => domain.table === name);
        assert(domain, `Missing ${name} certification sample domain`);
        assert.equal(domain.rows.length, name === "Services" ? 14 : 16);
        domains[name] = domain.rows.map(row => {
            assert.equal(row.length, 7);
            const [source, target, type, edgeId, weight, durationMs, eventCount] = row;
            return { source, target, type, edgeId, weight, durationMs, eventCount };
        });
    }

    return {
        domains,
        provenance: {
            file: filename, sha256: digest(bytes), literalSource: contract.source, literalSourceSha256: contract.sourceSha256,
            interpretation: "Literal sample-contract rows delivered directly to the offline mock host; no native Power Query refresh, DAX aggregation, or PBIP rendering is implied."
        },
        options: { edgeIds: true, tooltipFields: [
            { key: "durationMs", displayName: "Delivered duration ms", format: "0.0" },
            { key: "eventCount", displayName: "Delivered event count", format: "0" }
        ] }
    };
}
