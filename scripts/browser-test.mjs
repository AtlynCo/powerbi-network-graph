import assert from "node:assert/strict";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { extractArtifact, readArtifact, root, verifyBundledNotices, writeReport } from "./artifact.mjs";
import { createBrowserHarness } from "./browser-harness.mjs";

let artifact, bundledNotices, noticeText, harness;
try {
    artifact = await readArtifact();
    bundledNotices = await verifyBundledNotices(artifact);
    noticeText = await readFile(path.join(root, "THIRD_PARTY_NOTICES.txt"), "utf8");
    await extractArtifact(artifact);
    harness = await createBrowserHarness({ artifact });
} catch (error) {
    await writeReport("browser-test-results.json", {
        artifact: artifact?.filename ?? null, sha256: artifact?.sha256 ?? null,
        checks: [], passed: false, error: String(error), host: "Mocked Power BI host; not native Power BI validation"
    });
    throw error;
}
const { browser, page, requests, errors, warnings, mount, update, settle } = harness;
const checks = [];
const previewRoot = path.resolve(process.env.PREVIEW_DIR ?? path.join(root, "dist", "verification-previews"));
const previewFiles = [];
const act = action => page.locator(`[data-action="${action}"]`);
async function calls() { await settle(); return page.evaluate(() => window.fixture.calls); }
async function check(name, action) {
    await action();
    checks.push(name);
    console.log(`PASS ${name}`);
}
async function screenshotMock(filename, width, height) {
    await settle();
    await page.evaluate(({ artifactName, sha256, width }) => {
        document.getElementById("mock-preview-label")?.remove();
        const banner = document.createElement("div");
        banner.id = "mock-preview-label";
        banner.textContent = `MOCK HOST / CHROMIUM — NOT Power BI Desktop or Service. ${artifactName} SHA-256 ${sha256.slice(0, 16)}…`;
        banner.style.cssText = `width:${width}px;box-sizing:border-box;padding:8px;background:#fff1bf;color:#172d3d;font:12px Segoe UI,sans-serif;border-bottom:2px solid #a64000`;
        document.body.prepend(banner);
    }, { artifactName: artifact.filename, sha256: artifact.sha256, width });
    await page.screenshot({ path: path.join(root, "dist", filename), clip: { x: 0, y: 0, width, height } });
    await page.locator("#mock-preview-label").evaluate(element => element.remove());
    console.log(`Saved dist/${filename} from the mocked Chromium host.`);
}
async function preview(filename) {
    await mkdir(previewRoot, { recursive: true });
    await settle();
    const destination = path.join(previewRoot, filename);
    await page.screenshot({ path: destination, clip: { x: 0, y: 0, width: 1366, height: 768 } });
    assert((await stat(destination)).size <= 1024 * 1024, `Preview exceeds 1024 KB: ${filename}`);
    previewFiles.push(destination);
}
const normal = [
    { source: "A", target: "B", weight: 0 }, { source: "A", target: "B", weight: 2 },
    { source: "B", target: "A", weight: 3 }, { source: "B", target: "C", weight: null },
    { source: "C", target: "C", weight: 1 }, { source: "D", target: "A", weight: 5 },
    { source: "X", target: "Y", weight: 2 }
];
const circularSample = [
    { source: "Maya Chen", target: "Rowan Patel", type: "PR", itemId: "PR-104", weight: 5 },
    { source: "Maya Chen", target: "Rowan Patel", type: "Spec", itemId: "PR-104", weight: 2 },
    { source: "Casey Nguyen", target: "Rowan Patel", type: "PR", itemId: "PR-104", weight: 3 },
    { source: "Quinn Davis", target: "Rowan Patel", type: "PR", itemId: "PR-104", weight: 1 },
    { source: "Rowan Patel", target: "Maya Chen", type: "PR", itemId: "PR-118", weight: 4 },
    { source: "Maya Chen", target: "Jordan Lee", type: "PR", itemId: "PR-125", weight: 2 },
    { source: "Maya Chen", target: "Maya Chen", type: "Spec", itemId: "SPEC-09", weight: 2 },
    { source: "Quinn Davis", target: null, type: "PR", itemId: "PR-901", weight: 3 },
    { source: "Avery Brooks", target: null, type: "Spec", itemId: "SPEC-14", weight: 2 }
];

try {
    await mount({ width: 1000, height: 700 });
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
    await mount({ width: 1000, height: 700 });
    await update(normal, { objects: { exploration: { layout: "radial", view: "split" } } });
    await check("Rooted radial package supports automatic and locally selected centers without report selection", async () => {
        const root = page.locator(".atlyn-network");
        assert.equal(await root.getAttribute("data-layout"), "radial");
        assert.equal(await root.getAttribute("data-layout-center"), "s:A");
        assert((await page.locator(".network-status").textContent()).includes("Automatic center"));
        await page.locator('[data-control="layout-center"]').selectOption("s:C");
        assert.equal(await root.getAttribute("data-layout-center"), "s:C");
        assert((await page.locator(".network-status").textContent()).includes("Layout center: C"));
        assert.equal((await calls()).select.length, 0);
    });
    await mount({ width: 1400, height: 900 });
    await update(circularSample, {
        itemIds: true,
        objects: { exploration: { layout: "circular", groupBlankTargets: true, view: "split" } }
    });
    await check("Circular light-mode split view renders role rings, source-colored parallel types, self-link disclosure, blank-target bucket and full lists", async () => {
        const theme = await page.evaluate(() => {
            const root = document.querySelector(".atlyn-network");
            return {
                isHighContrast: window.fixture.host.colorPalette.isHighContrast,
                paletteBackground: window.fixture.host.colorPalette.background.value,
                renderedBackground: getComputedStyle(root).backgroundColor,
                splitView: root.classList.contains("view-split")
            };
        });
        assert.deepEqual(theme, {
            isHighContrast: false, paletteBackground: "#ffffff",
            renderedBackground: "rgb(255, 255, 255)", splitView: true
        });
        assert.equal(await page.locator(".atlyn-network.circular").count(), 1);
        assert.equal(await page.locator(".network-node").count(), 7);
        assert.equal(await page.locator(".network-edge").count(), 8);
        const maya = page.locator('.network-node[data-node-id="s:Maya Chen"]');
        assert.equal(await maya.locator(".network-role-halo").count(), 1);
        assert.equal(await maya.locator(".network-node-core").getAttribute("stroke-width"), "3");
        const quinn = page.locator('.network-node[data-node-id="s:Quinn Davis"]');
        assert.equal(await quinn.locator(".network-role-halo").count(), 0);
        assert.equal(await quinn.locator(".network-node-core").getAttribute("stroke-width"), "3");
        const bucket = page.locator('.network-node[data-node-id="bucket:external"]');
        assert.equal(await bucket.count(), 1);
        assert.equal(await bucket.locator(".network-node-core").getAttribute("stroke-dasharray"), "3 2");
        const status = await page.locator('[role="status"]').innerText();
        assert.match(status, /Self-links hidden from the diagram; retained in the lists:\s*1/);
        assert.match(status, /Hidden self-link rows: 1/);
        assert.match(status, /Hidden self-link weight:\s*2(?:\.00)?/);
        const pair = await page.locator(".network-edge").evaluateAll(groups => groups
            .filter(group => group.getAttribute("aria-label")?.startsWith("Maya Chen → Rowan Patel"))
            .map(group => {
                const line = group.querySelector(".edge-line");
                const markerId = line?.getAttribute("marker-end")?.match(/^url\(#(.+)\)$/)?.[1];
                const marker = markerId ? document.getElementById(markerId) : null;
                return {
                    label: group.getAttribute("aria-label"),
                    dash: line?.getAttribute("stroke-dasharray") ?? null,
                    stroke: line?.getAttribute("stroke"),
                    markerFill: marker?.querySelector("path")?.getAttribute("fill")
                };
            }));
        const sourceColor = await maya.locator(".network-node-core").getAttribute("stroke");
        assert.equal(pair.length, 2);
        assert(pair.some(edge => edge.label.includes("[PR]") && edge.dash === null));
        assert(pair.some(edge => edge.label.includes("[Spec]") && edge.dash === "6 4"));
        assert(pair.every(edge => edge.stroke === sourceColor && edge.markerFill === sourceColor));
        await act("relationships").click();
        const relationshipRows = await act("select-edge").allTextContents();
        assert.equal(relationshipRows.length, 9);
        assert(relationshipRows.some(text => text.startsWith("Maya Chen → Maya Chen")));
        await act("entities").click();
        await act("fit").click();
        await screenshotMock("circular-overview.png", 1400, 940);
    });
    await act("all-items").click();
    await check("All items opens the two-ring detail with owned items and directed source-to-item curves", async () => {
        assert.equal(await page.locator(".network-guide-ring").count(), 2);
        assert.equal(await page.locator(".network-item").count(), 6);
        assert.equal(await page.locator(".network-edge.network-item-edge").count(), 8);
        assert.equal(await act("all-items").getAttribute("aria-pressed"), "true");
        await act("fit").click();
        await screenshotMock("circular-two-ring-detail.png", 1400, 940);
    });
    await act("reset-circle").click();
    await check("Reset circle returns to overview without dropping loaded relationships", async () => {
        assert.equal(await page.locator(".network-guide-ring").count(), 1);
        assert.equal(await page.locator(".network-item").count(), 0);
        assert.equal(await act("all-items").getAttribute("aria-pressed"), "false");
        assert.equal(await page.locator(".network-edge").count(), 8);
    });
    await update(normal, { width: 1000, height: 700 });
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
    await check("buttons/keyboard zoom, pan and fit remain functional", async () => {
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
        if (!(await act("entities").isVisible())) await act("toggle-view").click();
        await act("entities").click();
        await act("select-node").first().scrollIntoViewIfNeeded();
        await act("select-node").first().click();
        assert((await calls()).select.length > 0);
        await page.evaluate(() => window.fixture.resize(1400, 900));
        while (!(await page.locator(".network-svg").isVisible()) || !(await act("entities").isVisible())) await act("toggle-view").click();
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
        assert.equal(await page.locator('button[data-node-id="s:Hub"]').getAttribute("aria-disabled"), "true");
        await page.locator('button[data-node-id="s:Hub"]').focus();
        await page.keyboard.press("Enter");
        assert.equal((await calls()).select.length, before);
        assert.match(await page.locator('[role="alert"]').innerText(), /200/);
        await update([{ source: "A", target: "B" }], { missingIdentity: "target" });
        assert.equal(await act("select-node").first().getAttribute("aria-disabled"), "true");
        await act("select-node").first().focus();
        await page.keyboard.press("Enter");
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
    await check("Circular Arabic RTL shows perimeter and inward item labels and localized hidden self-links", async () => {
        await mount({ locale: "ar-SA", width: 1366, height: 768 });
        await update(circularSample, { itemIds: true, objects: { exploration: { layout: "circular", view: "split", groupBlankTargets: true } } });
        assert.equal(await page.locator(".atlyn-network").getAttribute("dir"), "rtl");
        assert((await page.locator(".network-perimeter-label").count()) > 0);
        assert.match(await page.locator('[role="status"]').innerText(), /العلاقات الذاتية مخفية/);
        await act("all-items").click();
        assert((await page.locator(".network-item-label").count()) > 0);
        assert(await page.locator(".network-item-label").evaluateAll(labels => {
            const guide = document.querySelector(".network-inner-guide");
            const center = new window.DOMPoint(Number(guide.getAttribute("cx")), Number(guide.getAttribute("cy"))).matrixTransform(guide.getCTM());
            return labels.every(label => {
                const anchor = new window.DOMPoint(0, 0).matrixTransform(label.getCTM());
                const item = new window.DOMPoint(0, 0).matrixTransform(label.parentElement.getCTM());
                return label.getAttribute("transform")?.includes("rotate(") &&
                    Math.hypot(anchor.x - center.x, anchor.y - center.y) < Math.hypot(item.x - center.x, item.y - center.y);
            });
        }), "Two-ring item labels must point inward toward the center");
    });
    await check("Circular maximum graph uses numbered hollow badges with accessible legend and keyboard pagination", async () => {
        await mount({ width: 1366, height: 768 });
        const rows = Array.from({ length: 1000 }, (_, index) => ({
            source: `N${String(index % 250).padStart(3, "0")}`,
            target: `N${String((index + 1) % 250).padStart(3, "0")}`, edgeId: index, weight: 1
        }));
        await update(rows, { edgeIds: true, objects: { exploration: { layout: "circular", view: "split" } } });
        assert.equal(await page.locator(".network-node").count(), 250);
        assert.equal(await page.locator(".network-edge").count(), 1000);
        const badges = await page.locator(".network-badge").allTextContents();
        assert.deepEqual(badges.map(Number), Array.from({ length: 250 }, (_, index) => index + 1));
        assert.equal(await page.locator(".network-badge-legend button[aria-label]").count(), 250);
        assert.equal(await page.locator(".network-badge-legend .network-color-swatch[aria-hidden='true']").count(), 250);
        assert.equal(await page.locator(".network-node-core").first().getAttribute("fill"), "var(--bg)");
        for (const [tab, action, attribute, count] of [["entities", "select-node", "data-node-id", 250], ["relationships", "select-edge", "data-edge-id", 1000]]) {
            await act(tab).click();
            const seen = new Set();
            for (let i = 0; i < Math.ceil(count / 25); i++) {
                for (const value of await act(action).evaluateAll((elements, attr) => elements.map(element => element.getAttribute(attr)), attribute)) seen.add(value);
                if (i < Math.ceil(count / 25) - 1) {
                    await act("next").focus();
                    await page.keyboard.press("Enter");
                }
            }
            assert.equal(seen.size, count);
        }
    });
    await check("1.1 saved view and formatting without layout or Item ID restore Force", async () => {
        await mount({ width: 1366, height: 768 });
        const warningsBefore = warnings.length;
        const savedView = JSON.stringify({ version: 1, focus: "s:A", target: "s:B", mode: "path", search: "", view: "split", centerX: 0, centerY: 0, scale: 1 });
        await update(normal, { objects: { exploration: { view: "split" }, navigation: { savedView } } });
        assert.equal(await page.locator(".atlyn-network").getAttribute("data-layout"), "force");
        assert.equal(await page.locator(".network-node").count(), 2);
        assert.deepEqual(errors, []);
        assert.equal(warnings.length, warningsBefore);
    });
    await check("1366x768 light-mode Circular and Radial mock previews", async () => {
        await mount({ width: 1366, height: 768 });
        await update(circularSample, { itemIds: true, objects: { exploration: { layout: "circular", view: "graph", groupBlankTargets: true } } });
        await act("fit").click();
        await preview("circular-overview-1366x768.png");
        await act("all-items").click();
        await act("fit").click();
        await preview("circular-two-ring-1366x768.png");
        await mount({ width: 1366, height: 768 });
        await update(normal, { objects: { exploration: { layout: "radial", view: "split" } } });
        await act("fit").click();
        await preview("radial-overview-1366x768.png");
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
        checks, runtimeRequests: requests, errors, bundledNotices,
        screenshots: ["circular-overview.png", "circular-two-ring-detail.png"], previewFiles,
        passed: true
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
