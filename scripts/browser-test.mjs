import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { extractArtifact, readArtifact, root, verifyBundledNotices, writeReport } from "./artifact.mjs";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve(".browser-cache");
const browserWork = path.join(root, ".tool-home", "browser");
await mkdir(browserWork, { recursive: true });
process.env.TEMP = browserWork;
process.env.TMP = browserWork;
process.env.TMPDIR = browserWork;
const { chromium } = await import("@playwright/test");
const artifact = await readArtifact();
const bundledNotices = await verifyBundledNotices(artifact);
const noticeText = await readFile(path.join(root, "THIRD_PARTY_NOTICES.txt"), "utf8");
await extractArtifact(artifact);
const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {})
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, offline: true, serviceWorkers: "block" });
const requests = [];
const errors = [];
const checks = [];
await context.route("**/*", async route => {
    requests.push(route.request().url());
    await route.abort("blockedbyclient");
});
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });

function installMockHost({ guid, resources, locale, highContrast, width, height }) {
    const calls = { select: [], clear: 0, context: [], tooltips: [], lifecycle: [], forbidden: [] };
    let selected = [];
    let callback = () => {};
    const identity = (key, selectors) => ({
        getKey: () => key, hasIdentity: () => true,
        getSelector: () => ({ data: selectors }), getSelectorsByColumn: () => ({ dataMap: selectors }),
        equals: other => other?.getKey?.() === key, includes: other => other?.getKey?.() === key
    });
    const manager = {
        select(ids, multi) {
            calls.select.push({ keys: ids.map(id => id.getKey()), multi });
            selected = multi ? [...new Map([...selected, ...ids].map(id => [id.getKey(), id])).values()] : ids;
            callback();
            return Promise.resolve(selected);
        },
        clear() { calls.clear++; selected = []; callback(); return Promise.resolve([]); },
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
            enabled: () => true, show: info => calls.tooltips.push(info), move: () => {}, hide: () => {}
        },
        eventService: {
            renderingStarted: () => calls.lifecycle.push("started"),
            renderingFinished: () => calls.lifecycle.push("finished"),
            renderingFailed: (_options, message) => calls.lifecycle.push(`failed: ${message}`)
        },
        fetchMoreData: () => { calls.forbidden.push("fetchMoreData"); throw new Error("Segment fetching forbidden"); },
        launchUrl: () => { calls.forbidden.push("launchUrl"); throw new Error("Network navigation forbidden"); },
        persistProperties: () => {}, refreshHostData: () => {}, displayWarningIcon: () => {}
    };
    const container = document.getElementById("visual");
    const visual = window.powerbi.visuals.plugins[guid].create({ element: container, host });
    const state = {
        visual, host, calls, rows: [], view: undefined,
        update(rows, options = {}) {
            state.rows = rows;
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
            values.push({
                source: { displayName: "Delivered tooltip", queryName: "fixture.tooltip", roles: { tooltips: true }, type: { numeric: true }, format: "0.00" },
                values: rows.map((row, index) => row.tooltip ?? index)
            });
            values.grouped = () => [{ values }];
            state.view = {
                metadata: { columns: [...categories.map(column => column.source), ...values.map(column => column.source)], ...(options.partial ? { segment: {} } : {}), objects: options.objects ?? {} },
                categorical: { categories, values }
            };
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
    window.fixture = state;
}

async function mount({ width = 1000, height = 700, locale = "en-US", highContrast = false } = {}) {
    await page.setContent("<!doctype html><html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'\"></head><body style=\"margin:0\"><div id=\"visual\"></div></body></html>");
    await page.evaluate(() => { window.powerbi = { visuals: { plugins: {} } }; });
    await page.addStyleTag({ content: artifact.visual.content.css });
    await page.addScriptTag({ content: artifact.visual.content.js });
    await page.evaluate(installMockHost, { guid: artifact.config.visual.guid, resources: artifact.visual.stringResources, locale, highContrast, width, height });
}
async function update(rows, options = {}) {
    await page.evaluate(({ rows, options }) => window.fixture.update(rows, options), { rows, options });
    const events = await page.evaluate(() => window.fixture.calls.lifecycle);
    assert.equal(events.at(-1), "finished", `Rendering failed: ${events.join(", ")}`);
}
const act = action => page.locator(`[data-action="${action}"]`);
async function calls() { return page.evaluate(() => window.fixture.calls); }
async function check(name, action) {
    await action();
    checks.push(name);
    console.log(`PASS ${name}`);
}
const normal = [
    { source: "A", target: "B", weight: 0 }, { source: "A", target: "B", weight: 2 },
    { source: "B", target: "A", weight: 3 }, { source: "B", target: "C", weight: null },
    { source: "C", target: "C", weight: 1 }, { source: "D", target: "A", weight: 5 },
    { source: "X", target: "Y", weight: 2 }
];

try {
    await mount();
    await update(normal);
    await check("actual packaged plugin renders nodes, labels, reciprocal edges, self-loop and complete lists", async () => {
        assert.equal(await page.locator(".network-node").count(), 6);
        assert.equal(await page.locator(".network-edge").count(), 6);
        assert.equal(await page.locator(".network-node text").count(), 6);
        const paths = await page.locator(".network-edge > path:first-of-type").evaluateAll(elements => elements.map(element => ({
            path: element.getAttribute("d"), marker: element.getAttribute("marker-end")
        })));
        assert.equal(new Set(paths.map(item => item.path)).size, 6);
        assert.equal(paths.filter(item => item.path.includes(" C ")).length, 1);
        assert(paths.every(item => item.marker.startsWith("url(#") && !/NaN|Infinity/.test(item.path)));
        await act("relationships").click();
        assert.equal(await act("select-edge").count(), 6);
        const descriptions = await act("select-edge").allTextContents();
        assert(descriptions.some(text => text.includes("A → B") && text.includes("2.00")));
        assert(descriptions.some(text => text.includes("B → C") && /incomplete|unavailable/i.test(text)));
        await act("entities").click();
    });
    await check("normal fit includes all node labels, edges and loop within actual SVG viewport", async () => {
        await act("fit").click();
        const outside = await page.locator(".network-svg").evaluate(svg => {
            const bounds = svg.getBoundingClientRect();
            return [...svg.querySelectorAll(".network-node text,.network-node circle,.network-edge > path")].filter(element => {
                const rect = element.getBoundingClientRect();
                return rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1;
            }).map(element => element.tagName);
        });
        assert.deepEqual(outside, []);
    });
    await check("complete runtime licenses are distributed in the PBIVIZ and accessible as collapsed inert text", async () => {
        const legal = page.locator(".network-licenses");
        assert.equal(await legal.textContent(), noticeText);
        assert(!(await legal.isVisible()));
        await page.locator(".network-help > summary").click();
        await page.locator(".network-help details > summary").click();
        assert(await legal.isVisible());
        assert.equal(await legal.locator("a,script,iframe,img").count(), 0);
        const box = await legal.boundingBox();
        assert(box && box.height > 0 && box.height <= 201);
        await legal.focus();
        assert(await legal.evaluate(element => element === document.activeElement));
        await page.locator(".network-help details > summary").click();
        await page.locator(".network-help > summary").click();
    });
    await check("normal preview is explicitly labelled as a mock-host rendering", async () => {
        await page.evaluate(({ artifact, sha256 }) => {
            const banner = document.createElement("div");
            banner.id = "mock-preview-label";
            banner.textContent = `MOCK HOST / CHROMIUM — NOT Power BI Desktop or Service. ${artifact} SHA-256 ${sha256.slice(0, 16)}…`;
            banner.style.cssText = "width:1000px;box-sizing:border-box;padding:8px;background:#fff1bf;color:#172d3d;font:12px Segoe UI,sans-serif;border-bottom:2px solid #a64000";
            document.body.prepend(banner);
        }, { artifact: artifact.filename, sha256: artifact.sha256 });
        await page.screenshot({ path: path.join(root, "dist", "mock-host-preview.png"), clip: { x: 0, y: 0, width: 1000, height: 760 } });
        await page.locator("#mock-preview-label").evaluate(element => element.remove());
        await writeReport("mock-host-preview.json", {
            artifact: artifact.filename, sha256: artifact.sha256,
            screenshot: "mock-host-preview.png",
            disclaimer: "Actual PBIVIZ compiled JS/CSS rendered in real Chromium with a mocked Power BI host. NOT native Desktop/Service validation or certification."
        });
    });
    await check("search and directional local focus do not select or filter host; node selection includes hidden incident identities", async () => {
        const before = (await calls()).select.length;
        await page.locator('input[type="search"]').fill("A");
        assert.equal(await act("select-node").count(), 1);
        assert.equal(await page.locator(".network-node").count(), 6);
        await page.locator('select[data-control="entity"]').selectOption("s:A");
        await page.locator('select[data-control="focus-mode"]').selectOption("downstream");
        assert.equal(await page.locator(".network-node").count(), 3);
        assert.equal((await calls()).select.length, before);
        await act("select-node").click();
        const selected = (await calls()).select.at(-1);
        const indices = selected.keys.map(key => Number(JSON.parse(key)[0][1].split(":").at(-1))).sort((a, b) => a - b);
        assert.deepEqual(indices, [0, 1, 2, 5], "Node selection must include D→A even while D is locally hidden");
        assert.equal(selected.multi, false);
        await act("reset-focus").click();
        assert.equal(await page.locator(".network-node").count(), 6);
    });
    await check("native multiselect, host callback, clear and Escape preserve local focus semantics", async () => {
        await act("relationships").click();
        await act("select-edge").last().click({ modifiers: ["Control"] });
        assert.equal((await calls()).select.at(-1).multi, true);
        await page.evaluate(() => window.fixture.setHostSelection([0]));
        await act("entities").click();
        assert.equal(await page.locator('button[data-node-id="s:A"]').getAttribute("aria-pressed"), "mixed");
        await act("clear-selection").click();
        assert.equal((await calls()).clear, 1);
        assert.equal(await page.locator('button[data-node-id="s:A"]').getAttribute("aria-pressed"), "false");
        await page.locator('button[data-node-id="s:A"]').click();
        await page.keyboard.press("Escape");
        assert.equal((await calls()).clear, 2);
    });
    await check("context identities are empty for nodes/aggregates and exact for unambiguous relationships", async () => {
        await page.locator('button[data-node-id="s:A"]').click({ button: "right" });
        assert.equal((await calls()).context.at(-1).key, null);
        await act("relationships").click();
        await act("select-edge").filter({ hasText: "A → B" }).click({ button: "right" });
        assert.equal((await calls()).context.at(-1).key, null);
        await act("select-edge").filter({ hasText: "B → A" }).focus();
        await page.keyboard.press("Shift+F10");
        const key = (await calls()).context.at(-1).key;
        assert(key && JSON.parse(key).every(part => part[1].endsWith(":2")));
    });
    await check("wheel/buttons/keyboard zoom, pan and fit remain functional", async () => {
        const world = page.locator(".network-svg > g");
        const initial = await world.getAttribute("transform");
        await act("zoom-in").click();
        assert.notEqual(await world.getAttribute("transform"), initial);
        await act("zoom-out").click();
        await page.locator(".network-svg").focus();
        await page.keyboard.press("ArrowRight");
        assert.notEqual(await world.getAttribute("transform"), initial);
        await page.keyboard.press("Home");
        assert.equal(await world.getAttribute("transform"), initial);
    });
    await check("resize-only updates keep topology and tiny layout exposes usable scrollable controls", async () => {
        const positions = await page.locator(".network-node").evaluateAll(nodes => nodes.map(node => node.getAttribute("transform")));
        await page.evaluate(() => window.fixture.resize(240, 220));
        assert.equal(await page.locator(".atlyn-network.tiny").count(), 1);
        assert.equal(await page.locator(".network-node").count(), 6);
        await act("entities").click();
        await act("select-node").first().scrollIntoViewIfNeeded();
        await act("select-node").first().click();
        assert((await calls()).select.length > 0);
        await page.evaluate(() => window.fixture.resize(1400, 900));
        assert.deepEqual(await page.locator(".network-node").evaluateAll(nodes => nodes.map(node => node.getAttribute("transform"))), positions);
    });
    await check("data order/weight/highlight updates retain topology-only positions", async () => {
        const before = await page.locator(".network-node").evaluateAll(nodes => nodes.map(node => [node.getAttribute("data-node-id"), node.getAttribute("transform")]));
        await update([...normal].reverse().map((row, index) => ({ ...row, weight: index, highlight: index === 0 ? 0 : null })), { highlights: true, width: 1400, height: 900 });
        assert.deepEqual(await page.locator(".network-node").evaluateAll(nodes => nodes.map(node => [node.getAttribute("data-node-id"), node.getAttribute("transform")])), before);
        assert((await page.locator(".network-node.dimmed").count()) > 0);
        assert.equal(await page.locator(".network-edge").count(), 6);
    });
    await check("focused entity and relationship row controls survive highlight and resize updates", async () => {
        await act("entities").click();
        const entityButton = page.locator('button[data-node-id="s:B"]');
        await entityButton.focus();
        await update(normal.map((row, index) => ({ ...row, highlight: index === 0 ? 0 : null })), { highlights: true, width: 1400, height: 900 });
        assert(await entityButton.evaluate(element => element === document.activeElement));
        await page.evaluate(() => window.fixture.resize(1100, 650));
        assert(await entityButton.evaluate(element => element === document.activeElement));
        await act("relationships").click();
        const relationshipId = await act("select-edge").nth(1).getAttribute("data-edge-id");
        await act("select-edge").nth(1).focus();
        await update(normal.map(row => ({ ...row, weight: 8 })), { width: 1100, height: 650 });
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-edge-id")), relationshipId);
        await page.evaluate(() => window.fixture.resize(1000, 700));
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-edge-id")), relationshipId);
    });
    await check("malicious URL formatting falls back safely and invalid label sizes are disclosed and clamped", async () => {
        for (const labelSize of [999, -8]) {
            await update(normal, {
                objects: {
                    appearance: {
                        nodeColor: { solid: { color: "url(https://example.invalid/paint.svg#node)" } },
                        edgeColor: { solid: { color: "url(https://example.invalid/paint.svg#edge)" } },
                        labelSize
                    }
                }
            });
            const appearance = await page.locator(".atlyn-network").evaluate(element => ({
                node: element.style.getPropertyValue("--node"),
                edge: element.style.getPropertyValue("--edge"),
                size: element.style.getPropertyValue("--label-size"),
                fill: getComputedStyle(element.querySelector(".network-node circle")).fill
            }));
            assert.equal(appearance.node, "#007D87");
            assert.equal(appearance.edge, "#596579");
            assert.equal(appearance.size, labelSize > 24 ? "24px" : "8px");
            assert(!appearance.fill.includes("url("));
            assert.match(await page.locator('[role="alert"]').innerText(), /invalid|appearance|safe|default/i);
        }
        await update(normal, { objects: { appearance: { nodeColor: { solid: { color: "#08af" } }, edgeColor: { solid: { color: "#12345678" } }, labelSize: 16 } } });
        assert.equal(await page.locator(".atlyn-network").evaluate(element => element.style.getPropertyValue("--node")), "#08af");
        assert.equal(await page.locator(".atlyn-network").evaluate(element => element.style.getPropertyValue("--edge")), "#12345678");
        assert.equal(await page.locator('[role="alert"]').innerText(), "");
        await update(normal);
    });
    await check("all 250 entities and 1000 edges are reachable by keyboard pagination", async () => {
        const rows = Array.from({ length: 1000 }, (_, index) => ({
            source: `N${String(index % 250).padStart(3, "0")}`, target: `N${String((index + 1) % 250).padStart(3, "0")}`, edgeId: index, weight: index % 3
        }));
        await update(rows, { edgeIds: true, width: 1400, height: 900 });
        assert.equal(await page.locator(".network-node").count(), 250);
        assert.equal(await page.locator(".network-edge").count(), 1000);
        for (const [tab, action, attribute, count] of [["entities", "select-node", "data-node-id", 250], ["relationships", "select-edge", "data-edge-id", 1000]]) {
            await act(tab).click();
            const seen = new Set();
            for (let i = 0; i < Math.ceil(count / 25); i++) {
                for (const value of await act(action).evaluateAll((elements, attribute) => elements.map(element => element.getAttribute(attribute)), attribute)) seen.add(value);
                if (i < Math.ceil(count / 25) - 1) {
                    await act("next").focus();
                    await page.keyboard.press("Enter");
                    assert(await page.locator(".network-list-content button").first().evaluate(element => element === document.activeElement));
                }
            }
            assert.equal(seen.size, count);
            assert(await act("next").isDisabled());
            await act("previous").focus();
            await page.keyboard.press("Enter");
            assert(!(await act("next").isDisabled()));
        }
    });
    await check("over-limit and missing-identity selections reject the entire action", async () => {
        const rows = Array.from({ length: 201 }, (_, index) => ({ source: "Hub", target: `N${index}`, edgeId: index, weight: 1 }));
        await update(rows, { edgeIds: true, width: 1000, height: 700 });
        await act("entities").click();
        const before = (await calls()).select.length;
        await page.locator('button[data-node-id="s:Hub"]').click();
        assert.equal((await calls()).select.length, before);
        assert.match(await page.locator('[role="alert"]').innerText(), /200/);
        await update([{ source: "A", target: "B" }], { missingIdentity: "target" });
        await act("select-node").first().click();
        assert.equal((await calls()).select.length, before);
        assert.match(await page.locator('[role="alert"]').innerText(), /unavailable|identit/i);
    });
    await check("partial segments disclose loaded-only topology without fetching", async () => {
        await update(normal, { partial: true });
        assert.match(await page.locator('[role="status"]').innerText(), /incomplete/i);
        assert.deepEqual((await calls()).forbidden, []);
    });
    await check("native interaction restrictions block selection/context but retain local search", async () => {
        await page.evaluate(() => { window.fixture.host.hostCapabilities.allowInteractions = false; });
        const before = await calls();
        await act("select-node").first().click();
        await act("select-node").first().click({ button: "right" });
        await act("clear-selection").click();
        await page.locator('input[type="search"]').fill("A");
        const after = await calls();
        assert.equal(after.select.length, before.select.length);
        assert.equal(after.context.length, before.context.length);
        assert.equal(after.clear, before.clear);
        assert.equal(await act("select-node").count(), 1);
    });
    await check("Arabic RTL and high-contrast palette apply to actual compiled UI", async () => {
        await page.evaluate(() => window.fixture.visual.destroy());
        await mount({ locale: "ar-SA", highContrast: true });
        await update([{ source: "ألف", target: "باء", weight: 0 }, { source: "باء", target: "باء", weight: 2 }]);
        const root = page.locator(".atlyn-network");
        assert.equal(await root.getAttribute("dir"), "rtl");
        assert.equal(await root.getAttribute("lang"), "ar-SA");
        assert(await root.evaluate(element => element.classList.contains("high-contrast")));
        const colors = await root.evaluate(element => ({
            foreground: getComputedStyle(element).getPropertyValue("--foreground").trim(),
            background: getComputedStyle(element).getPropertyValue("--background").trim(),
            node: getComputedStyle(element).getPropertyValue("--node").trim()
        }));
        assert.deepEqual(colors, { foreground: "#FFFF00", background: "#000000", node: "#FFFF00" });
        assert.match(await act("entities").innerText(), /[\u0600-\u06ff]/);
        await act("select-node").first().focus();
        await page.keyboard.press("Enter");
        assert.equal((await calls()).select.length, 1);
        assert.equal(await page.locator(".network-node text").count(), 2);
        await page.evaluate(() => window.fixture.visual.destroy());
        assert.equal(await page.locator(".atlyn-network").count(), 0);
    });
    assert.deepEqual(requests, [], "Visual attempted runtime resource/network access");
    assert.deepEqual(errors, [], "Browser console/page errors");
    await writeReport("browser-test-results.json", {
        artifact: artifact.filename, sha256: artifact.sha256, browser: await browser.version(),
        engine: "Real Chromium via Playwright", source: "JS/CSS extracted from the inspected real PBIVIZ",
        host: "Offline Power BI API mock; not native Desktop/Service, certification, or AppSource proof",
        checks, runtimeRequests: requests, errors, bundledNotices, passed: true
    });
    console.log(`Passed ${checks.length} actual-package Chromium checks; zero runtime requests. Host is mocked, not native Power BI.`);
} catch (error) {
    await writeReport("browser-test-results.json", {
        artifact: artifact.filename, sha256: artifact.sha256, checks,
        passed: false, error: String(error), runtimeRequests: requests, errors,
        host: "Mocked Power BI host; not native Power BI validation"
    });
    throw error;
} finally {
    await browser.close();
}
