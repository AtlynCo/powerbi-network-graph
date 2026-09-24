import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createBrowserHarness, HOST_DISCLAIMER, releaseFixtures, releaseSampleFixtures, TILES } from "./browser-harness.mjs";
import { root, writeReport } from "./artifact.mjs";

const preliminary = process.argv.includes("--preliminary");
const finalScreenshots = process.argv.includes("--screenshots");
const reportName = preliminary ? "release-browser-preliminary.json" : "release-browser-results.json";
let harness;
try {
    harness = await createBrowserHarness({ touch: true });
} catch (error) {
    await writeReport(reportName, { artifact: null, sha256: null, passed: false, error: String(error), host: HOST_DISCLAIMER });
    throw error;
}
const { page, context, artifact, mount, update, settle } = harness;
const fixtures = releaseFixtures();
let samples;
const checks = [];
const geometry = [];
const screenshots = [];
let fatalError;
const act = (action, scope = page) => scope.locator(`[data-action="${action}"]`);
const calls = async () => { await settle(); return page.evaluate(() => window.fixture.calls); };
const ids = selector => page.locator(selector).evaluateAll(nodes => nodes.map(node => node.getAttribute("data-node-id") ?? node.getAttribute("data-edge-id")).sort());
const camera = () => page.locator(".network-svg > g").getAttribute("transform");
async function show(view) {
    for (let i = 0; i < 3; i++) {
        if (await page.locator(`.atlyn-network.view-${view}`).count()) return;
        await act("toggle-view").click();
    }
    throw new Error(`Unable to show ${view} view`);
}
async function tools() {
    const details = page.locator(".network-tools");
    if (await details.getAttribute("open") === null) await details.locator(":scope > summary").click();
}
async function check(name, action) {
    try {
        const errorsBefore = harness.errors.length;
        const requestsBefore = harness.requests.length;
        await action();
        assert.deepEqual(harness.errors.slice(errorsBefore), [], "An uncaught browser/console error escaped this interaction");
        assert.deepEqual(harness.requests.slice(requestsBefore), [], "This interaction attempted a runtime resource request");
        checks.push({ name, passed: true });
        console.log(`PASS ${name}`);
    } catch (error) {
        checks.push({ name, passed: false, error: String(error) });
        console.error(`FAIL ${name}: ${error}`);
    }
}
async function geometrySnapshot(name) {
    const snapshot = await page.locator(".network-svg").evaluate(svg => {
        const box = element => {
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        };
        const viewport = box(svg);
        const visible = element => window.getComputedStyle(element).display !== "none" && element.getBoundingClientRect().width > 0;
        const labels = [...svg.querySelectorAll(".network-node text")].filter(visible).map(element => ({ id: element.parentElement.dataset.nodeId, ...box(element) }));
        const marks = [...svg.querySelectorAll(".network-node circle,.network-edge > path:first-of-type")].map(element => ({ id: element.parentElement.dataset.nodeId ?? element.parentElement.dataset.edgeId, ...box(element) }));
        const outside = [...labels, ...marks].filter(rect => rect.x < viewport.x - 1 || rect.y < viewport.y - 1 || rect.x + rect.width > viewport.x + viewport.width + 1 || rect.y + rect.height > viewport.y + viewport.height + 1);
        const overlaps = [];
        for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
            const a = labels[i], b = labels[j];
            if (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 &&
                Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5) overlaps.push([a.id, b.id]);
        }
        const paths = [...svg.querySelectorAll(".network-edge > path:first-of-type")].map(element => element.getAttribute("d"));
        const hiddenPaths = [...svg.querySelectorAll(".network-edge > path:first-of-type")].filter(element => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0 ||
                style.stroke === "none" || Number.parseFloat(style.strokeWidth) <= 0 || (rect.width <= 0 && rect.height <= 0);
        }).map(element => element.parentElement.dataset.edgeId);
        return { viewport, labelCount: labels.length, labels, markCount: marks.length, outside, overlaps, hiddenPaths, paths: paths.length, distinctPaths: new Set(paths).size, finite: paths.every(path => !/NaN|Infinity/.test(path)) };
    });
    geometry.push({ name, ...snapshot });
    return snapshot;
}
async function capture(name, label, { width = 1366, height = 724, inputProvenance } = {}) {
    await settle();
    await page.evaluate(({ label, sha, width }) => {
        const banner = document.createElement("div");
        banner.id = "evidence-label";
        banner.textContent = `${label} | OFFLINE CHROMIUM / MOCK POWER BI HOST — NOT DESKTOP OR SERVICE | SHA256 ${sha.slice(0, 16)}…`;
        banner.style.cssText = `box-sizing:border-box;width:${width}px;height:44px;padding:6px;background:#fff1bf;color:#172d3d;font:12px Segoe UI,sans-serif;border-bottom:2px solid #a64000`;
        document.body.prepend(banner);
    }, { label, sha: artifact.sha256, width });
    const directory = path.join(root, "dist", preliminary ? "preliminary-screenshots" : "release-screenshots");
    await mkdir(directory, { recursive: true });
    const png = await page.screenshot({ path: path.join(directory, `${name}.png`), clip: { x: 0, y: 0, width, height: height + 44 }, type: "png", scale: "css" });
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1366, 768], "Screenshot dimensions must meet the verified Marketplace requirement");
    assert(png.length <= 1024000, `Screenshot exceeds 1024 KB: ${name} (${png.length} bytes)`);
    await page.locator("#evidence-label").evaluate(element => element.remove());
    screenshots.push({
        filename: `${path.basename(directory)}/${name}.png`, label, artifact: artifact.filename, sha256: artifact.sha256,
        format: "PNG", bytes: png.length, width, height: height + 44, visualViewport: { width, height }, inputProvenance, host: HOST_DISCLAIMER
    });
}
try {
    samples = await releaseSampleFixtures();
    if (!preliminary) assert(!artifact.historical, "Final release checks require strict current artifact/source validation");
    if (finalScreenshots) {
        assert.equal(process.env.RELEASE_FINAL_READY_SHA, artifact.sha256, "Final screenshots require parent's final package-ready SHA in RELEASE_FINAL_READY_SHA");
        assert(!preliminary, "Final and preliminary evidence cannot be combined");
    }
    await check("explicit topology oracle: cycles, loops, reciprocal/parallel IDs, disconnection and exact row identities", async () => {
        await mount();
        await update(fixtures.typical, { edgeIds: true });
        assert.deepEqual(await ids(".network-node"), ["s:Approve", "s:Archive", "s:Deploy", "s:Intake", "s:Monitor", "s:Retain", "s:Review"]);
        assert.deepEqual(await ids(".network-edge"), Array.from({ length: 10 }, (_, i) => `s:W${i}`));
        const snapshot = await geometrySnapshot("normal-fit");
        assert.equal(snapshot.distinctPaths, 10);
        assert(snapshot.finite);
        assert.deepEqual(snapshot.outside, []);
        assert.deepEqual(snapshot.overlaps, []);
        await act("relationships").click();
        await act("select-edge").filter({ hasText: "Intake → Review" }).click();
        const indices = (await calls()).select.at(-1).keys.map(key => Number(JSON.parse(key)[0][1].split(":").at(-1)));
        assert.deepEqual(indices, [0]);
        const before = (await calls()).select.length;
        await page.locator('[data-control="entity"]').selectOption("s:Review");
        await page.locator('[data-control="focus-mode"]').selectOption("incident");
        assert.deepEqual(await ids(".network-edge"), ["s:W0", "s:W1", "s:W4", "s:W5", "s:W6", "s:W7"]);
        await page.locator('[data-control="focus-mode"]').selectOption("path");
        await page.locator('[data-control="path-target"]').selectOption("s:Deploy");
        assert.deepEqual(await ids(".network-edge"), ["s:W1", "s:W2"]);
        await page.locator('[data-control="path-target"]').selectOption("s:Archive");
        assert.equal(await page.locator(".network-node").count(), 0);
        assert.match(await page.locator(".network-caption").innerText(), /no directed path/i);
        assert.equal((await calls()).select.length, before);
    });
    await check("path/incident controls preserve full native incident identity and exact-versus-aggregate context scope", async () => {
        await mount();
        await update([...fixtures.typical, { ...fixtures.typical[1] }], { edgeIds: true });
        const inspect = page.locator('[data-action="incident-node"][data-focus-key="s:Review"]');
        await inspect.focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.locator('[data-control="focus-mode"]').inputValue(), "incident");
        assert.equal(await act("relationships").getAttribute("aria-pressed"), "true");
        assert.deepEqual(await ids(".network-edge"), ["s:W0", "s:W1", "s:W4", "s:W5", "s:W6", "s:W7"]);
        assert.equal(await page.locator(".network-list-content button").first().evaluate(element => element === document.activeElement), true);
        assert.equal((await calls()).select.length, 0);
        await page.locator('[data-control="focus-mode"]').selectOption("path");
        await page.locator('[data-control="path-target"]').selectOption("s:Deploy");
        assert.deepEqual(await ids(".network-edge"), ["s:W1", "s:W2"]);
        await act("entities").click();
        const review = page.locator('button[data-action="select-node"][data-node-id="s:Review"]');
        await review.focus();
        await page.keyboard.press("Enter");
        assert.deepEqual((await calls()).select.at(-1).keys.map(key => Number(JSON.parse(key)[0][1].split(":").at(-1))), [0, 1, 4, 5, 6, 7, 10]);
        await review.focus();
        await page.keyboard.press("Shift+F10");
        assert.equal((await calls()).context.at(-1).key, null, "Node menus cannot pretend to have entity-level native identity");
        await act("relationships").click();
        await page.locator('button[data-edge-id="s:W1"]').focus();
        await page.keyboard.press("Shift+F10");
        assert.equal((await calls()).context.at(-1).key, null, "An aggregate must not arbitrarily choose one contributing native row");
        await page.locator('button[data-edge-id="s:W2"]').focus();
        await page.keyboard.press("Shift+F10");
        const exact = (await calls()).context.at(-1).key;
        assert(exact && JSON.parse(exact).every(part => part[1].endsWith(":2")));
    });
    await check("literal certification sample contract renders Services 8/14 and Accounts 6/13 with preserved diagnostics", async () => {
        await mount();
        await update(samples.domains.Services, samples.options);
        assert.deepEqual(await ids(".network-node"), ["s:Alerts", "s:Archive", "s:Backup", "s:Gateway", "s:Inventory", "s:Ledger", "s:Orders", "s:Payments"]);
        assert.deepEqual(await ids(".network-edge"), Array.from({ length: 14 }, (_, i) => `s:S${String(i + 1).padStart(2, "0")}`));
        assert.equal(await page.locator(".atlyn-network").getAttribute("data-incomplete"), "false");
        assert.deepEqual((await geometrySnapshot("sample-services")).outside, []);
        await update(samples.domains.Accounts, samples.options);
        assert.deepEqual(await ids(".network-node"), Array.from({ length: 6 }, (_, i) => `s:${String(i + 1).padStart(4, "0")}`));
        assert.deepEqual(await ids(".network-edge"), Array.from({ length: 13 }, (_, i) => `s:T${String(i + 1).padStart(2, "0")}`));
        assert.equal(await page.locator(".atlyn-network").getAttribute("data-incomplete"), "true");
        const status = await page.locator('[role="status"]').innerText();
        assert.match(status, /conflicting edge IDs omitted entirely: 1/i);
        assert.match(status, /missing\/invalid weight contributions.*: 2/i);
        assert.match(status, /repeated relationship rows aggregated: 1/i);
        await act("relationships").click();
        assert.match(await page.locator('button[data-edge-id="s:T01"]').innerText(), /120\.00/);
        assert.match(await page.locator('button[data-edge-id="s:T11"]').innerText(), /0\.00/);
        assert.match(await page.locator('button[data-edge-id="s:T12"]').innerText(), /unavailable|incomplete/i);
        assert.match(await page.locator('button[data-edge-id="s:T13"]').innerText(), /unavailable|incomplete/i);
        assert.deepEqual((await geometrySnapshot("sample-accounts")).outside, []);
    });
    for (const [width, height] of TILES) await check(`exact ${width}x${height} tile: scrollable controls, graph/list recovery and independent fit geometry`, async () => {
        await mount({ width, height });
        await update(fixtures.typical, { edgeIds: true });
        const dimensions = await page.locator(".atlyn-network").evaluate(element => ({
            width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height,
            client: element.clientWidth, scroll: element.scrollWidth
        }));
        assert.deepEqual([dimensions.width, dimensions.height], [width, height]);
        assert(dimensions.scroll <= dimensions.client + 1, `Unreachable horizontal overflow: ${JSON.stringify(dimensions)}`);
        await show("list");
        await act("entities").focus();
        await page.keyboard.press("Enter");
        await act("select-node").last().focus();
        await page.keyboard.press("Enter");
        assert.equal((await calls()).select.length, 1);
        await tools();
        await act("clear-selection").focus();
        await page.keyboard.press("Enter");
        assert.equal((await calls()).clear, 1);
        if (width < 700 || height < 320) await page.locator(".network-tools > summary").click();
        await show("graph");
        await page.locator(".network-svg").focus();
        await page.keyboard.press("Home");
        const snapshot = await geometrySnapshot(`${width}x${height}-graph`);
        assert.equal(snapshot.paths, 10);
        assert(snapshot.viewport.width > 20 && snapshot.viewport.height >= 79);
        assert.deepEqual(snapshot.outside, []);
        assert.deepEqual(snapshot.overlaps, []);
        await update(fixtures.maximum, { edgeIds: true, width, height });
        await page.locator(".network-svg").focus();
        await page.keyboard.press("Home");
        const dense = await geometrySnapshot(`${width}x${height}-maximum`);
        assert.equal(await page.locator(".network-node").count(), 250);
        assert.equal(dense.paths, 1000);
        assert.equal(dense.distinctPaths, 1000);
        assert(dense.finite);
        assert.deepEqual(dense.hiddenPaths, []);
        assert.deepEqual(dense.outside, []);
        assert.deepEqual(dense.overlaps, []);
        await show("list");
        await act("relationships").focus();
        await page.keyboard.press("Enter");
        await act("next").focus();
        await page.keyboard.press("Enter");
        assert.equal(await act("select-edge").first().getAttribute("data-edge-id"), "s:E0025");
    });
    await check("maximum real mixed topology: 250 nodes / 1000 IDs / 5000 contributing rows; every paged ID reachable by keyboard", async () => {
        await mount({ width: 1366, height: 768 });
        await update(fixtures.maximum, { edgeIds: true });
        assert.deepEqual(await ids(".network-node"), Array.from({ length: 250 }, (_, i) => `s:N${String(i).padStart(3, "0")}`));
        assert.deepEqual(await ids(".network-edge"), Array.from({ length: 1000 }, (_, i) => `s:E${String(i).padStart(4, "0")}`));
        const snapshot = await geometrySnapshot("maximum-fit");
        assert.equal(snapshot.distinctPaths, 1000);
        assert(snapshot.finite);
        assert.deepEqual(snapshot.hiddenPaths, []);
        assert.deepEqual(snapshot.outside, []);
        assert.deepEqual(snapshot.overlaps, []);
        assert(snapshot.labelCount > 0 && snapshot.labelCount < 250, "Dense labels must be disclosed, not silently stacked");
        assert.match(await page.locator(".network-caption").innerText(), /labels shown.*dense overview/i);
        assert.equal(await page.locator(".atlyn-network").getAttribute("data-incomplete"), "false");
        assert.match(await page.locator('[role="status"]').innerText(), /4000/);
        for (const [tab, action, attribute, total] of [["entities", "select-node", "data-node-id", 250], ["relationships", "select-edge", "data-edge-id", 1000]]) {
            await act(tab).click();
            const seen = new Set();
            for (let pageNumber = 0; pageNumber < total / 25; pageNumber++) {
                const values = await act(action).evaluateAll((elements, attribute) => elements.map(element => element.getAttribute(attribute)), attribute);
                assert.equal(values.length, 25);
                values.forEach(value => { assert(!seen.has(value)); seen.add(value); });
                if (pageNumber === 0) {
                    const expected = await page.locator(".network-list-content button").evaluateAll(elements =>
                        elements.map(element => [element.dataset.action, element.dataset.focusKey]));
                    await page.locator(".network-list-content button").first().focus();
                    for (let index = 0; index < expected.length; index++) {
                        assert.deepEqual(await page.evaluate(() => [document.activeElement.dataset.action, document.activeElement.dataset.focusKey]), expected[index]);
                        if (index + 1 < expected.length) await page.keyboard.press("Tab");
                    }
                }
                if (pageNumber + 1 < total / 25) {
                    await act("next").focus();
                    await page.keyboard.press("Enter");
                    assert.equal(await page.locator(".network-list-content button").first().evaluate(element => element === document.activeElement), true);
                }
            }
            assert.equal(seen.size, total);
            assert(await act("next").isDisabled());
        }
        await act("select-edge").last().focus();
        await page.keyboard.press("Enter");
        const indices = (await calls()).select.at(-1).keys.map(key => Number(JSON.parse(key)[0][1].split(":").at(-1)));
        assert.deepEqual(indices, [999, 1999, 2999, 3999, 4999]);
    });
    for (const kind of ["loop", "parallel", "reciprocal"]) await check(`actual compiled geometry preserves 1000 distinct ${kind} relationship paths without route caps`, async () => {
        await mount();
        const rows = Array.from({ length: 1000 }, (_, i) => ({
            source: kind === "reciprocal" && i % 2 ? "B" : "A",
            target: kind === "loop" || (kind === "reciprocal" && i % 2) ? "A" : "B",
            edgeId: `R${String(i).padStart(4, "0")}`, weight: 1
        }));
        await update(rows, { edgeIds: true });
        assert.deepEqual(await ids(".network-edge"), Array.from({ length: 1000 }, (_, i) => `s:R${String(i).padStart(4, "0")}`));
        const snapshot = await geometrySnapshot(`1000-${kind}`);
        assert.equal(snapshot.paths, 1000);
        assert.equal(snapshot.distinctPaths, 1000);
        assert(snapshot.finite);
        assert.deepEqual(snapshot.hiddenPaths, []);
        assert.deepEqual(snapshot.outside, []);
        assert.deepEqual(snapshot.overlaps, []);
    });
    await check("true mouse picking, drag suppression, captured pan, anchored wheel and keyboard camera", async () => {
        await mount();
        await update(fixtures.accounts, { edgeIds: true });
        const circle = page.locator('.network-node[data-node-id="s:Account 101"] circle');
        await circle.click();
        assert.deepEqual((await calls()).select.at(-1).keys.map(key => Number(JSON.parse(key)[0][1].split(":").at(-1))), [0, 1, 2, 4]);
        const start = await circle.boundingBox();
        const before = await camera();
        const selected = (await calls()).select.length;
        await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
        await page.mouse.down();
        await page.mouse.move(start.x + start.width / 2 + 80, start.y + start.height / 2 + 30, { steps: 8 });
        await page.mouse.up();
        assert.notEqual(await camera(), before);
        assert.equal((await calls()).select.length, selected, "Dragging a node must not also select it");
        assert.equal(await page.locator(".atlyn-network.panning").count(), 0);
        await page.locator(".network-svg").focus();
        await page.keyboard.press("Home");
        assert.equal(await camera(), before);
        const box = await page.locator(".network-svg").boundingBox();
        const anchor = { x: box.x + box.width * 0.35, y: box.y + box.height * 0.4 };
        const matrixBefore = await page.locator(".network-svg > g").evaluate(element => [...["a", "d", "e", "f"].map(key => element.getScreenCTM()[key])]);
        await page.mouse.move(anchor.x, anchor.y);
        await page.mouse.wheel(0, -240);
        await settle();
        const matrixAfter = await page.locator(".network-svg > g").evaluate(element => [...["a", "d", "e", "f"].map(key => element.getScreenCTM()[key])]);
        assert(matrixAfter[0] > matrixBefore[0]);
        assert(Math.abs((anchor.x - matrixBefore[2]) / matrixBefore[0] - (anchor.x - matrixAfter[2]) / matrixAfter[0]) < 0.05);
        assert(Math.abs((anchor.y - matrixBefore[3]) / matrixBefore[1] - (anchor.y - matrixAfter[3]) / matrixAfter[1]) < 0.05);
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowRight");
        assert.notEqual(await camera(), before);
        await page.keyboard.press("Home");
        assert.equal(await camera(), before);
        const pick = await page.locator('.network-edge[data-edge-id="s:A3"] .edge-hit').evaluate(path => {
            for (const fraction of [0.5, 0.35, 0.65, 0.2, 0.8]) {
                const point = path.getPointAtLength(path.getTotalLength() * fraction).matrixTransform(path.getScreenCTM());
                if (document.elementFromPoint(point.x, point.y)?.closest(".network-edge")?.getAttribute("data-edge-id") === "s:A3") return { x: point.x, y: point.y };
            }
            throw new Error("Relationship A3 has no independently pickable sampled point");
        });
        await page.waitForTimeout(550);
        await page.mouse.click(pick.x, pick.y);
        assert.deepEqual((await calls()).select.at(-1).keys.map(key => Number(JSON.parse(key)[0][1].split(":").at(-1))), [3]);
    });
    await check("real Chromium touch pan/pinch/cancel and tap preserve pointer capture and do not synthesize unwanted selection", async () => {
        await mount();
        await update(fixtures.accounts, { edgeIds: true });
        const cdp = await context.newCDPSession(page);
        const box = await page.locator(".network-svg").boundingBox();
        const before = await camera();
        const touch = (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
        const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await touch("touchStart", [{ id: 1, x: center.x - 40, y: center.y }, { id: 2, x: center.x + 40, y: center.y }]);
        await touch("touchMove", [{ id: 1, x: center.x - 100, y: center.y + 10 }, { id: 2, x: center.x + 100, y: center.y + 10 }]);
        await touch("touchEnd", []);
        assert.notEqual(await camera(), before);
        assert.equal((await calls()).select.length, 0);
        assert.equal(await page.locator(".atlyn-network.panning").count(), 0);
        const pinched = await camera();
        await touch("touchStart", [{ id: 3, x: center.x, y: center.y }]);
        await touch("touchMove", [{ id: 3, x: center.x + 55, y: center.y + 30 }]);
        await touch("touchCancel", []);
        assert.notEqual(await camera(), pinched);
        assert.equal(await page.locator(".atlyn-network.panning").count(), 0);
        await act("fit").click();
        await page.waitForTimeout(550);
        const node = await page.locator('.network-node[data-node-id="s:Account 101"] circle').boundingBox();
        await page.touchscreen.tap(node.x + node.width / 2, node.y + node.height / 2);
        assert.equal((await calls()).select.length, 1);
        await cdp.detach();
    });
    await check("three concurrent instances keep marker definitions, selection, camera, search and destroy isolated", async () => {
        await mount({ width: 500, height: 300 });
        await update(fixtures.accounts, { edgeIds: true });
        for (const name of ["second", "third"]) {
            await mount({ width: 500, height: 300, append: true, name });
            await update(fixtures.typical, { edgeIds: true }, name);
        }
        const markers = await page.locator("marker").evaluateAll(elements => elements.map(element => element.id));
        assert.equal(markers.length, 3);
        assert.equal(new Set(markers).size, 3);
        assert(await page.locator(".network-edge > path:first-of-type").evaluateAll(elements => elements.every(element => {
            const id = element.getAttribute("marker-end").slice(5, -1);
            return element.closest("svg").querySelector(`[id="${id}"]`) !== null;
        })));
        const secondBefore = await page.locator("#second .network-svg > g").getAttribute("transform");
        await page.locator("#visual .network-node circle").first().click();
        await settle();
        assert.equal(await page.evaluate(() => window.second.calls.select.length), 0);
        await page.locator("#visual .network-svg").focus();
        await page.keyboard.press("+");
        assert.equal(await page.locator("#second .network-svg > g").getAttribute("transform"), secondBefore);
        await page.locator("#visual .network-tools > summary").click();
        await page.locator('#visual input[type="search"]').fill("101");
        assert.equal(await page.locator('#second input[type="search"]').inputValue(), "");
        await page.evaluate(() => window.fixture.visual.destroy());
        assert.equal(await page.locator("#visual .atlyn-network").count(), 0);
        assert.equal(await page.locator("#second .network-edge").count(), 10);
        assert.equal(await page.locator("#third .network-edge").count(), 10);
    });
    await check("saved local view request and host metadata replay preserve focus/search/camera; invalid and deleted bookmarks reset safely", async () => {
        await mount();
        await update(fixtures.typical, { edgeIds: true });
        await page.locator('[data-control="entity"]').selectOption("s:Review");
        await page.locator('[data-control="focus-mode"]').selectOption("path");
        await page.locator('[data-control="path-target"]').selectOption("s:Deploy");
        await page.locator('input[type="search"]').fill("Review");
        await act("zoom-in").click();
        await page.locator(".network-svg").focus();
        await page.keyboard.press("ArrowRight");
        const savedCamera = await camera();
        await act("save-view").click();
        const persisted = (await calls()).persist.at(-1);
        assert.equal(persisted.merge[0].objectName, "navigation");
        const savedView = persisted.merge[0].properties.savedView;
        assert.deepEqual(JSON.parse(savedView).mode, "path");
        assert.equal((await calls()).select.length, 0);
        await act("reset-focus").click();
        await update(fixtures.typical, { edgeIds: true, objects: { navigation: { savedView } } });
        assert.equal(await page.locator('[data-control="focus-mode"]').inputValue(), "path");
        assert.equal(await page.locator('input[type="search"]').inputValue(), "Review");
        assert.equal(await camera(), savedCamera);
        await update(fixtures.typical, { edgeIds: true, highlights: true, objects: { navigation: { savedView } } });
        assert.equal(await camera(), savedCamera);
        await update(fixtures.typical, { edgeIds: true, objects: { navigation: { savedView: "{" } } });
        assert.match(await page.locator('[role="alert"]').innerText(), /invalid|reset/i);
        assert.equal(await page.locator('[data-control="focus-mode"]').inputValue(), "all");
        await update(fixtures.typical, { edgeIds: true, objects: { navigation: { savedView } } });
        await update(fixtures.typical, { edgeIds: true });
        assert.equal(await page.locator('[data-control="focus-mode"]').inputValue(), "all");
        assert.equal(await page.locator('input[type="search"]').inputValue(), "");
        await update(fixtures.typical, { edgeIds: true, objects: { exploration: { view: "list" }, navigation: { savedView } } });
        assert.equal(await page.locator('[data-control="focus-mode"]').inputValue(), "path");
        await update(fixtures.typical, { edgeIds: true, objects: { exploration: { view: "list" } } });
        assert.equal(await page.locator(".atlyn-network.view-list").count(), 1, "Removing a bookmark must restore the configured initial view");
        assert.equal(await page.locator('[data-control="focus-mode"]').inputValue(), "all");
    });
    await check("host promise rejection, pending clear, data unbind/rebind, failure cleanup and destroy after async action terminate safely", async () => {
        await mount();
        await update(fixtures.typical, { edgeIds: true });
        await page.evaluate(() => { window.fixture.faults.select = true; });
        await act("select-node").first().click();
        await settle();
        assert.match(await page.locator('[role="alert"]').innerText(), /could not apply|selection/i);
        await settle();
        await page.evaluate(() => { window.fixture.faults.select = false; window.fixture.faults.defer = true; });
        await act("select-node").first().click();
        await settle();
        await act("clear-selection").click();
        await page.evaluate(() => { window.fixture.faults.defer = false; window.fixture.release(); });
        await settle();
        assert.equal((await calls()).clear, 1);
        assert.equal(await page.locator('.network-node[aria-pressed="true"]').count(), 0);
        const events = await page.evaluate(() => {
            const state = window.fixture;
            state.visual.update({ dataViews: [], viewport: { width: 1280, height: 620 }, type: 2 });
            return state.calls.lifecycle;
        });
        assert.deepEqual(events.slice(-2), ["started", "finished"]);
        assert.equal(await page.locator(".network-node,.network-edge").count(), 0);
        await update(fixtures.accounts, { edgeIds: true });
        await page.evaluate(() => window.fixture.visual.update({ viewport: { width: NaN, height: 620 }, type: 4 }));
        assert.match((await calls()).lifecycle.at(-1), /^failed:/);
        assert.equal(await page.locator('.atlyn-network[aria-busy="false"]').count(), 1);
        assert.equal(await page.locator(".network-node,.network-edge").count(), 0);
        assert.equal(await act("select-edge").count(), 0);
        await update(fixtures.typical, { edgeIds: true });
        await page.evaluate(() => { window.fixture.faults.defer = true; });
        await act("select-node").first().click();
        await settle();
        await page.evaluate(() => { window.fixture.visual.destroy(); window.fixture.visual.destroy(); window.fixture.release(); window.fixture.resize(500, 300); });
        await settle();
        assert.equal(await page.locator(".atlyn-network").count(), 0);
    });
    await check("formatting replay controls labels/colors/view; persistence failure is disclosed without host selection", async () => {
        await mount();
        await update(fixtures.accounts, { edgeIds: true, objects: {
            appearance: { showLabels: false, nodeColor: { solid: { color: "#123456" } }, labelSize: 18 },
            exploration: { view: "list" }
        } });
        assert.equal(await page.locator(".network-node text").count(), 0);
        assert.equal(await page.locator(".atlyn-network").evaluate(element => element.style.getPropertyValue("--node")), "#123456");
        assert(await page.locator(".atlyn-network.view-list").count());
        await update(fixtures.accounts, { edgeIds: true, objects: {
            appearance: { showLabels: true, nodeColor: { solid: { color: "#007D87" } }, labelSize: 12 },
            exploration: { view: "split" }
        } });
        assert.equal(await page.locator(".network-node text").count(), 3);
        assert(await page.locator(".atlyn-network.view-split").count());
        await page.evaluate(() => { window.fixture.faults.persist = true; });
        await act("save-view").click();
        await settle();
        assert.match(await page.locator('[role="alert"]').innerText(), /could not store|failed/i);
        assert.equal((await calls()).select.length, 0);
    });
    await check("numeric/text IDs and significant/control whitespace remain distinctly labelled in graph and complete lists", async () => {
        await mount();
        await update([
            { source: 1, target: "1", edgeId: "typed", weight: 0 },
            { source: " A ", target: "A", edgeId: "space", weight: 1 },
            { source: "A\nB", target: "AB", edgeId: "control", weight: 2 }
        ], { edgeIds: true });
        const labels = await page.locator(".network-node").evaluateAll(elements => Object.fromEntries(elements.map(element => [
            element.dataset.nodeId, element.querySelector("text").textContent
        ])));
        assert.deepEqual(labels, {
            "n:1": "1 [number ID]", "s:1": "1 [text ID]",
            "s: A ": "\" A \"", "s:A": "A", "s:A\nB": "\"A\\nB\"", "s:AB": "AB"
        });
        assert.deepEqual(new Set(await page.locator(".network-list-content strong").allTextContents()), new Set(Object.values(labels)));
        assert.equal(await page.locator(".network-node text").count(), 6, "Decluttering may change visibility, not remove label DOM");
        await act("relationships").click();
        assert.match(await page.locator('button[data-edge-id="s:typed"]').innerText(), /1 \[number ID\] → 1 \[text ID\]/);
        assert.match(await page.locator('button[data-edge-id="s:control"]').innerText(), /"A\\nB" → AB/);
    });
    await check("native tooltip enable/show/hide failures disclose alerts; update/zoom hide and destroy cleanup are observable", async () => {
        await mount();
        await update(fixtures.accounts, { edgeIds: true });
        await act("relationships").click();
        for (const fault of ["tooltipEnabled", "tooltip"]) {
            await page.evaluate(fault => { window.fixture.faults[fault] = true; }, fault);
            await act("select-edge").first().focus();
            assert.match(await page.locator('[role="alert"]').innerText(), /tooltip.*unavailable/i);
            await act("relationships").focus();
            await page.evaluate(fault => { window.fixture.faults[fault] = false; }, fault);
            await update(fixtures.accounts, { edgeIds: true });
        }
        await act("select-edge").first().focus();
        assert.equal((await calls()).tooltipVisible, true);
        const hiddenBeforeUpdate = (await calls()).tooltipHides;
        await update(fixtures.accounts, { edgeIds: true });
        assert((await calls()).tooltipHides > hiddenBeforeUpdate);
        await act("relationships").focus();
        const box = await page.locator(".network-svg").boundingBox();
        await page.mouse.move(box.x + 4, box.y + 4);
        await act("select-edge").first().focus();
        assert.equal((await calls()).tooltipVisible, true);
        const hiddenBeforeZoom = (await calls()).tooltipHides;
        await page.mouse.wheel(0, -120);
        await settle();
        assert((await calls()).tooltipHides > hiddenBeforeZoom);
        assert.equal((await calls()).tooltipVisible, false);
        await page.evaluate(() => { window.fixture.faults.tooltipHide = true; });
        await page.mouse.wheel(0, 120);
        await settle();
        assert.match(await page.locator('[role="alert"]').innerText(), /tooltip.*unavailable/i);
        const destruction = await page.evaluate(() => {
            try { window.fixture.visual.destroy(); return "did not propagate"; }
            catch (error) { return error.message; }
        });
        assert.match(destruction, /Injected tooltip hide failure/);
        assert.equal(await page.locator(".atlyn-network").count(), 0);
        await page.evaluate(() => { window.fixture.faults.tooltipHide = false; window.fixture.setHostSelection([0]); });
        await settle();
        assert.equal(await page.locator(".atlyn-network").count(), 0, "Destroy must neutralize callbacks even when tooltip cleanup throws");
    });
    await check("collapsible help refits live viewport while compact toolbar changes preserve a manually positioned camera", async () => {
        await mount();
        await update(fixtures.typical, { edgeIds: true });
        const original = await camera();
        const plotBefore = await page.locator(".network-svg").boundingBox();
        await page.locator(".network-help > summary").click();
        await settle();
        const plotOpen = await page.locator(".network-svg").boundingBox();
        assert(plotOpen.height < plotBefore.height, "Fixture must exercise actual viewport height loss");
        assert.notEqual(await camera(), original);
        assert.deepEqual((await geometrySnapshot("expanded-help-fit")).outside, []);
        await page.locator(".network-help > summary").click();
        await settle();
        assert.equal(await camera(), original);
        await page.locator(".network-svg").focus();
        await page.keyboard.press("ArrowRight");
        const panned = await camera();
        await page.evaluate(() => window.fixture.resize(398, 298));
        await settle();
        assert.equal(await camera(), panned);
        await tools();
        await settle();
        assert.equal(await camera(), panned);
        await page.locator(".network-tools > summary").click();
        await page.evaluate(() => window.fixture.resize(1280, 620));
        await settle();
        assert.equal(await camera(), panned);
    });
    await check("Arabic RTL / high contrast / reduced motion remain readable, keyboard-selectable and synchronously export-ready in this browser only", async () => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await mount({ locale: "ar-SA", highContrast: true });
        await page.evaluate(() => {
            const original = window.fixture.host.eventService.renderingFinished;
            window.fixture.host.eventService.renderingFinished = options => {
                original(options);
                window.exportSnapshot = window.fixture.container.querySelector(".network-svg").outerHTML;
            };
        });
        await update([{ source: "ألف", target: "باء", edgeId: "1", weight: 0 }, { source: "باء", target: "باء", edgeId: "2", weight: 1 }], { edgeIds: true });
        await settle();
        assert.equal(await page.locator(".network-svg").evaluate(element => element.outerHTML), await page.evaluate(() => window.exportSnapshot));
        assert.equal(await page.locator(".atlyn-network").getAttribute("dir"), "rtl");
        const styling = await page.locator(".atlyn-network").evaluate(element => ({
            foreground: window.getComputedStyle(element).getPropertyValue("--foreground").trim(),
            background: window.getComputedStyle(element).getPropertyValue("--background").trim(),
            reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            animations: element.getAnimations({ subtree: true }).length
        }));
        assert.deepEqual(styling, { foreground: "#FFFF00", background: "#000000", reduced: true, animations: 0 });
        await act("select-node").first().focus();
        await page.keyboard.press("Enter");
        assert.equal((await calls()).select.length, 1);
        const before = await page.locator(".network-svg").innerHTML();
        await settle();
        assert.equal(await page.locator(".network-svg").innerHTML(), before);
        assert.deepEqual((await calls()).lifecycle, ["started", "finished"]);
        assert.deepEqual((await geometrySnapshot("rtl-high-contrast")).overlaps, []);
        await page.emulateMedia({ reducedMotion: "no-preference" });
    });
    for (const layout of ["circular", "radial"]) {
        await check(`${layout}: mode/center changes, transformed picking, exact identity and stable local coordinates`, async () => {
            await mount();
            await update(fixtures.typical, { edgeIds: true });
            const positions = () => page.locator(".network-node").evaluateAll(nodes => nodes.map(node => [node.dataset.nodeId, node.getAttribute("transform")]));
            const force = await positions();
            await page.locator('[data-control="layout"]').selectOption(layout);
            if (layout === "radial") await page.locator('[data-control="layout-center"]').selectOption("s:Review");
            const polar = await positions();
            assert.notDeepEqual(polar, force);
            assert.equal((await calls()).select.length, 0);
            assert.equal((await calls()).persist.length, 0);
            const snapshot = await geometrySnapshot(`${layout}-fit`);
            assert.deepEqual(snapshot.outside, []);
            assert.deepEqual(snapshot.overlaps, []);
            await page.locator('[data-control="entity"]').selectOption("s:Review");
            assert((await positions()).every(pair => polar.some(original => JSON.stringify(original) === JSON.stringify(pair))));
            await act("reset-focus").click();
            await page.locator('input[type="search"]').fill("Review");
            assert.deepEqual(await positions(), polar);
            await page.locator('input[type="search"]').fill("");
            await update(fixtures.typical.map(row => ({ ...row, weight: 999, highlight: 0 })), { edgeIds: true, highlights: true });
            assert.deepEqual(await positions(), polar);
            await show("graph");
            await act("fit").click();
            const target = page.locator('.network-node[data-node-id="s:Review"] circle');
            const bounds = await target.boundingBox();
            await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            const expected = fixtures.typical.flatMap((row, index) => row.source === "Review" || row.target === "Review" ? [index] : []);
            const selected = (await calls()).select.at(-1).keys.map(key => Number(JSON.parse(key)[0][1].split(":").at(-1))).sort((a, b) => a - b);
            assert.deepEqual(selected, expected);
            await page.locator('[data-control="layout"]').selectOption("force");
            assert.deepEqual(await positions(), force);
            assert.equal((await calls()).select.length, 1);
        });
        for (const [width, height] of TILES) await check(`${layout}: ${width}x${height}, complete maximum topology, fit and keyboard list recovery`, async () => {
            await mount({ width, height });
            await update(fixtures.maximum, { edgeIds: true, objects: { exploration: { layout } } });
            assert.equal(await page.locator(".network-node").count(), 250);
            assert.equal(await page.locator(".network-edge").count(), 1000);
            await show("graph");
            await tools();
            await act("fit").click();
            const snapshot = await geometrySnapshot(`${layout}-${width}x${height}-maximum`);
            assert(snapshot.finite);
            assert.equal(snapshot.distinctPaths, 1000);
            assert.deepEqual(snapshot.hiddenPaths, []);
            assert.deepEqual(snapshot.outside, []);
            assert.deepEqual(snapshot.overlaps, []);
            await show("list");
            await act("relationships").focus();
            await page.keyboard.press("Enter");
            assert.equal(await page.locator(".network-list-content button[data-edge-id]").count(), 25);
            await act("next").focus();
            await page.keyboard.press("Enter");
            assert.match(await page.locator(".network-pager").innerText(), /2 \/ 40/);
        });
    }
    await check("polar actual SVG arcs avoid expanded unrelated glyphs, including diametral and skip-one chords", async () => {
        const rows = [
            ...Array.from({ length: 12 }, (_, i) => ({ source: "center", target: `N${i}`, edgeId: `spoke${i}` })),
            ...Array.from({ length: 24 }, (_, i) => ({ source: `N${i % 12}`, target: `N${(i + (i < 12 ? 2 : 6)) % 12}`, edgeId: `arc${i}` }))
        ];
        for (const layout of ["circular", "radial"]) {
            await mount();
            await update(rows, { edgeIds: true, objects: { exploration: { layout } } });
            if (layout === "radial") await page.locator('[data-control="layout-center"]').selectOption("s:center");
            const minimum = await page.locator(".network-svg").evaluate((svg, rows) => {
                const nodes = [...svg.querySelectorAll(".network-node")].map(node => {
                    const transform = node.transform.baseVal.getItem(0).matrix;
                    return { id: node.dataset.nodeId, x: transform.e, y: transform.f };
                });
                let minimum = Infinity;
                for (const path of svg.querySelectorAll(".network-edge > path:first-of-type")) {
                    const row = rows.find(row => `s:${row.edgeId}` === path.parentElement.dataset.edgeId);
                    const length = path.getTotalLength(), steps = Math.ceil(length / 3);
                    for (let i = 0; i <= steps; i++) {
                        const point = path.getPointAtLength(length * i / steps);
                        for (const node of nodes) if (node.id !== `s:${row.source}` && node.id !== `s:${row.target}`) minimum = Math.min(minimum, Math.hypot(point.x - node.x, point.y - node.y));
                    }
                }
                return minimum;
            }, rows);
            assert(minimum > 27.5, `Unrelated glyph intersection: ${minimum}`);
        }
    });
    await check("polar v2 bookmark geometry, v1 migration, retained missing center, encode refusal and per-instance isolation", async () => {
        await mount();
        await update(fixtures.typical, { edgeIds: true });
        await page.locator('[data-control="layout"]').selectOption("radial");
        await page.locator('[data-control="layout-center"]').selectOption("s:Review");
        await act("zoom-in").click();
        const savedCamera = await camera();
        await act("save-view").click();
        const savedView = (await calls()).persist.at(-1).merge[0].properties.savedView;
        assert.equal(JSON.parse(savedView).version, 2);
        assert.equal(JSON.parse(savedView).layout, "radial");
        await page.locator('[data-control="layout"]').selectOption("circular");
        await update(fixtures.typical, { edgeIds: true, objects: { navigation: { savedView } } });
        const coordinates = value => value.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
        const restoredCamera = coordinates(await camera());
        coordinates(savedCamera).forEach((value, index) => assert(Math.abs(value - restoredCamera[index]) < 1e-9, "Camera round-trip differs beyond floating-point precision"));
        await update([{ source: "A", target: "B", edgeId: "different" }], { edgeIds: true, objects: { navigation: { savedView } } });
        assert.equal(await page.locator('[data-control="layout-center"]').inputValue(), "s:Review");
        assert.match(await page.locator(".network-status").innerText(), /Requested center is not loaded/);
        await update(fixtures.typical, { edgeIds: true, objects: { navigation: { savedView } } });
        assert.equal(await page.locator(".atlyn-network").getAttribute("data-layout-center"), "s:Review");
        const legacy = { version: 1, focus: "", target: "", mode: "all", search: "", view: "auto", centerX: 0, centerY: 0, scale: 1 };
        await update(fixtures.typical, { edgeIds: true, objects: { navigation: { savedView: JSON.stringify(legacy) } } });
        assert.equal(await page.locator(".atlyn-network").getAttribute("data-layout"), "force");
        assert.match(await page.locator(".network-notice").innerText(), /Version 1/);
        await update(fixtures.typical, { edgeIds: true, objects: { navigation: { savedView: JSON.stringify({ ...JSON.parse(savedView), geometry: "0".repeat(32) }) } } });
        assert.match(await page.locator(".network-notice").innerText(), /geometry differs/);
        await mount({ append: true, name: "second" });
        await update(fixtures.typical, { edgeIds: true, objects: { exploration: { layout: "circular" } } }, "second");
        assert.deepEqual(await page.locator(".atlyn-network").evaluateAll(nodes => nodes.map(node => node.dataset.layout)), ["radial", "circular"]);
        await mount();
        await update([{ source: "\u0001".repeat(512), target: "\u0002".repeat(512), edgeId: "long" }], { edgeIds: true });
        await act("save-view").click();
        assert.equal((await calls()).persist.length, 0);
        assert.match(await page.locator(".network-notice").innerText(), /4,096/);
    });
    await check("polar Arabic/high-contrast/reduced-motion controls and root list action remain keyboard accessible", async () => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await mount({ locale: "ar-SA", highContrast: true });
        await update(fixtures.typical, { edgeIds: true, objects: { exploration: { layout: "radial" } } });
        assert.equal(await page.locator(".atlyn-network").getAttribute("dir"), "rtl");
        assert.match(await page.locator('[data-control="layout"]').getAttribute("aria-label"), /[\u0600-\u06ff]/);
        await act("center-node").first().focus();
        await page.keyboard.press("Enter");
        assert.equal((await calls()).select.length, 0);
        assert.equal((await calls()).persist.length, 0);
        assert.equal(await page.locator('[data-control="layout-center"]').evaluate(element => element === document.activeElement), true);
        assert.deepEqual((await geometrySnapshot("polar-rtl")).outside, []);
        await page.emulateMedia({ reducedMotion: "no-preference" });
    });
    if (preliminary || finalScreenshots) {
        if (finalScreenshots) assert(checks.every(check => check.passed) && !harness.errors.length && !harness.requests.length, "Final screenshots require a passing full browser suite");
        for (const obsolete of ["cyclic-workflow.png", "reciprocal-accounts.png"]) {
            await rm(path.join(root, "dist", preliminary ? "preliminary-screenshots" : "release-screenshots", obsolete), { force: true });
        }
        for (const [name, rows, label, options, inputProvenance] of [
            ["services", samples.domains.Services, "Services literal sample — 8 entities / 14 relationships; cycles, reciprocal calls and retries", samples.options, samples.provenance],
            ["accounts", samples.domains.Accounts, "Accounts literal sample — 16 rows; 6 entities / 13 retained relationships; diagnostics preserved", samples.options, samples.provenance],
            ["circular", samples.domains.Services, "Circular — all loaded endpoints on one ring; arrows retain direction; angle is not distance", { ...samples.options, objects: { exploration: { layout: "circular" } } }, samples.provenance],
            ["radial", samples.domains.Services, "Radial — loaded undirected hop rings; separate component centers; no centrality claim", { ...samples.options, objects: { exploration: { layout: "radial" } } }, samples.provenance],
            ["dense-overview", fixtures.maximum, "Dense overview — all 250 entities, 1000 relationships, 5000 rows; labels selectively placed"]
        ]) {
            await mount({ width: 1366, height: 724 });
            await update(rows, options ?? { edgeIds: true });
            if (name === "accounts") {
                await act("relationships").click();
                await page.locator('button[data-edge-id="s:T12"]').scrollIntoViewIfNeeded();
                assert.match(await page.locator('[role="status"]').innerText(), /conflicting.*missing\/invalid/i);
            }
            await capture(name, `${preliminary ? "PRELIMINARY CANDIDATE" : "LOCAL QUALITY CANDIDATE"}: ${label}`, { inputProvenance });
        }
        assert(screenshots.length >= 1 && screenshots.length <= 5, "Screenshot set must contain 1–5 images");
    }
} catch (error) {
    fatalError = String(error);
    console.error(error);
} finally {
    const passed = !fatalError && checks.length >= 22 && checks.every(check => check.passed) && !harness.errors.length && !harness.requests.length;
    await writeReport(reportName, {
        artifact: artifact.filename, sha256: artifact.sha256, version: artifact.config.visual.version, currentSourceValidated: !artifact.historical, buildInputSha256: artifact.buildInputSha256,
        browser: await harness.browser.version(), host: HOST_DISCLAIMER, preliminary, passed,
        checks, geometry, screenshots, sampleContract: samples?.provenance, fatalError, errors: harness.errors, errorDetails: harness.errorDetails, runtimeRequests: harness.requests,
        measurementLimits: "Synthetic fixture data. CDP touch produces real Chromium input, not physical hardware validation. Programmatic focus plus keyboard activation tests list reachability; no screen-reader certification. Native bookmark/filter/export behavior remains a manual host gate."
    });
    await harness.close();
    if (!passed) process.exitCode = 1;
}
