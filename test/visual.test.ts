import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import powerbi from "powerbi-visuals-api";

vi.mock("powerbi-visuals-api", async (importOriginal) => {
    const mod = await importOriginal<Record<string, unknown>>();
    const api = {
        ...mod,
        VisualUpdateType: { Data: 2, Resize: 4, ViewMode: 8, Style: 16, ResizeEnd: 32, All: 62 },
        ViewMode: { View: 0, Edit: 1, InFocusEdit: 2 },
        visuals: {
            ValidatorType: { Min: 0, Max: 1 }
        }
    };
    return {
        ...api,
        default: api
    };
});

import { Visual } from "../src/visual";
import { circularColor } from "../src/circular";
import { SavedView } from "../src/navigation";

function mockVisualHost() {
    const contextCalls: { id: unknown; position: { x: number; y: number } }[] = [];
    const selectionManager = {
        showContextMenu: vi.fn((id: unknown, position: { x: number; y: number }) => {
            contextCalls.push({ id, position });
            return Promise.resolve();
        }),
        registerOnSelectCallback: vi.fn(),
        getSelectionIds: vi.fn<() => powerbi.visuals.ISelectionId[]>(() => []),
        select: vi.fn(() => Promise.resolve([])),
        clear: vi.fn(() => Promise.resolve())
    };
    const host = {
        locale: "en-US",
        hostCapabilities: { allowInteractions: true },
        createSelectionManager: vi.fn(() => selectionManager),
        createLocalizationManager: vi.fn(() => ({
            getDisplayName: (key: string) => key
        })),
        createSelectionIdBuilder: vi.fn(() => ({
            withCategory: vi.fn().mockReturnThis(),
            createSelectionId: vi.fn(() => ({
                hasIdentity: () => true,
                getKey: () => "test",
                includes: () => false
            }))
        })),
        colorPalette: {
            isHighContrast: false,
            foreground: { value: "#000000" },
            background: { value: "#ffffff" },
            foregroundSelected: { value: "#ff0000" },
            getColor: () => ({ value: "#007d87" })
        },
        tooltipService: {
            enabled: () => true,
            show: vi.fn(),
            hide: vi.fn(),
            move: vi.fn()
        },
        eventService: {
            renderingStarted: vi.fn(),
            renderingFinished: vi.fn(),
            renderingFailed: vi.fn()
        },
        persistProperties: vi.fn()
    } as unknown as powerbi.extensibility.visual.IVisualHost;

    return { host, selectionManager, contextCalls };
}

describe("Visual context menu and empty state", () => {
    it("attaches contextmenu listener to root container calling showContextMenu with empty id", () => {
        const { host, contextCalls } = mockVisualHost();
        const element = document.createElement("div");
        const visual = new Visual({ element, host });

        const root = element.querySelector<HTMLDivElement>(".atlyn-network");
        expect(root).not.toBeNull();

        // Dispatch contextmenu event on the root element
        const event = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 120,
            clientY: 240
        });
        root!.dispatchEvent(event);
        expect(contextCalls).toHaveLength(1);
        expect(contextCalls[0]).toEqual({ id: {}, position: { x: 120, y: 240 } });
        visual.destroy();
    });
});

        interface CircularFixtureOptions {
            sources?: powerbi.PrimitiveValue[];
            targets?: powerbi.PrimitiveValue[];
            items?: powerbi.PrimitiveValue[] | false;
            edgeIds?: powerbi.PrimitiveValue[];
            types?: powerbi.PrimitiveValue[];
            weights?: powerbi.PrimitiveValue[];
            objects?: powerbi.DataViewObjects;
        }
        function circularData(options: CircularFixtureOptions = {}): powerbi.DataView {
            const sources = options.sources ?? ["A", "A", "A", "C", "B", "D"];
            const targets = options.targets ?? ["B", "B", "A", "B", "C", null];
            const categories = [
                ["source", sources], ["target", targets],
                ["relationshipType", options.types ?? ["PR", "spec", "PR", "PR", "PR", "spec"]],
                ...(options.items === false ? [] : [["itemId", options.items ?? ["work", "work", "own", "work", "cwork", "outside"]]]),
                ...(options.edgeIds ? [["edgeId", options.edgeIds]] : [])
            ].map(([role, values]) => ({
                source: { displayName: String(role), queryName: String(role), roles: { [String(role)]: true }, type: { text: true } },
                values: values as powerbi.PrimitiveValue[],
                identity: (values as powerbi.PrimitiveValue[]).map((_, index) => ({ key: `${role}-${index}` } as unknown as powerbi.DataViewScopeIdentity))
            }));
            const weights = {
                source: { displayName: "Weight", queryName: "weight", roles: { weight: true }, type: { numeric: true } },
                values: options.weights ?? [6, 3, 5, 2, 0, null]
            };
            const tooltips = {
                source: { displayName: "Measure", queryName: "measure", roles: { tooltips: true }, type: { numeric: true } },
                values: sources.map(() => 42)
            };
            return {
                metadata: { columns: [...categories.map(category => category.source), weights.source, tooltips.source],
                    objects: { ...options.objects, exploration: { layoutMode: "circular", groupBlankTargets: true, ...options.objects?.exploration } } },
                categorical: { categories, values: [weights, tooltips] as unknown as powerbi.DataViewValueColumns }
            };
        }

        const circularVisuals: Visual[] = [];
        afterEach(() => {
            for (const visual of circularVisuals) visual.destroy();
            circularVisuals.length = 0;
        });

        function setupCircular(data = circularData(), configure?: (host: powerbi.extensibility.visual.IVisualHost) => void) {
            const mock = mockVisualHost();
            const ids = new Map<number, powerbi.visuals.ISelectionId>();
            vi.mocked(mock.host.createSelectionIdBuilder).mockImplementation(() => {
                let row = 0;
                const builder = {
                    withCategory: (_category: powerbi.DataViewCategoryColumn, index: number) => { row = index; return builder; },
                    createSelectionId: () => {
                        if (!ids.has(row)) ids.set(row, {
                            hasIdentity: () => true, getKey: () => `row-${row}`,
                            includes: (other: powerbi.visuals.ISelectionId) => other.getKey() === `row-${row}`
                        } as powerbi.visuals.ISelectionId);
                        return ids.get(row)!;
                    }
                };
                return builder as unknown as powerbi.visuals.ISelectionIdBuilder;
            });
            configure?.(mock.host);
            const element = document.createElement("div");
            document.body.append(element);
            const visual = new Visual({ element, host: mock.host });
            circularVisuals.push(visual);
            const update = (view = data, type = powerbi.VisualUpdateType.Data) => visual.update({
                viewport: { width: 800, height: 600 }, viewMode: powerbi.ViewMode.View, type, dataViews: [view]
            });
            update();
            expect(mock.host.eventService.renderingFailed).not.toHaveBeenCalled();
            const click = (selector: string, modifiers: MouseEventInit = {}) => {
                const mark = element.querySelector(selector);
                expect(mark, selector).not.toBeNull();
                mark!.dispatchEvent(new MouseEvent("click", { bubbles: true, ...modifiers }));
            };
            const camera = () => element.querySelector(".network-svg > g")!.getAttribute("transform");
            return { ...mock, element, visual, update, click, camera, ids, data };
        }

        describe("Circular rendering and item exploration", () => {
            it("renders overview roles, a neutral fallback bucket and matching per-color arrows", () => {
                const { element } = setupCircular();
                const guide = element.querySelector(".network-guide-ring")!;
                expect(["cx", "cy", "r"].map(key => guide.getAttribute(key))).toEqual(["320", "320", "245"]);
                const source = element.querySelector('.network-node[data-node-id="s:A"] .network-node-core')!;
                expect(source.getAttribute("r")).toBe("19");
                expect(source.getAttribute("fill")).toBe("var(--bg)");
                expect(source.getAttribute("stroke-width")).toBe("3");
                expect(source.getAttribute("stroke")).toBe(circularColor("s:A"));
                expect(element.querySelector('.network-node[data-node-id="s:A"] .network-role-halo')).toBeNull();
                const halo = element.querySelector('.network-node[data-node-id="s:B"] .network-role-halo')!;
                expect(halo.getAttribute("r")).toBe("24");
                expect(halo.getAttribute("fill")).toBe("none");
                const bucket = element.querySelector(".network-node.is-bucket")!;
                expect(bucket.querySelector(".network-node-core")!.getAttribute("stroke-dasharray")).toBe("3 2");
                expect(bucket.querySelector(".network-node-core")!.getAttribute("stroke")).toBe("#6b7280");
                expect(bucket.querySelector(".network-role-halo")!.getAttribute("stroke")).toBe("#6b7280");
                expect(element.querySelectorAll("marker").length).toBeGreaterThan(1);
                for (const line of element.querySelectorAll(".edge-line")) {
                    const id = line.getAttribute("marker-end")!.slice(5, -1);
                    const marker = element.querySelector(`#${id}`)!;
                    expect(marker.getAttribute("viewBox")).toBe("0 0 14 14");
                    expect(marker.getAttribute("markerWidth")).toBe("14");
                    expect(marker.getAttribute("refX")).toBe("13");
                    expect(marker.getAttribute("markerUnits")).toBe("userSpaceOnUse");
                    expect(marker.querySelector("path")!.getAttribute("d")).toBe("M 0 0 L 14 7 L 0 14 z");
                    expect(marker.querySelector("path")!.getAttribute("fill")).toBe(line.getAttribute("stroke"));
                }
                expect(element.querySelector('.network-node[data-node-id="s:D"] .network-perimeter-label')!.getAttribute("text-anchor")).toBe("end");
                expect(element.querySelector('.network-node[data-node-id="s:B"] .network-perimeter-label')!.getAttribute("text-anchor")).toBe("start");
                expect(element.querySelector('.network-node[data-node-id="s:A"] .network-perimeter-label')!.getAttribute("text-anchor")).toBe("middle");
            });

            it("hides self-links only from SVG and discloses known hidden/drawn weight", () => {
                const { element, click } = setupCircular();
                expect(element.querySelectorAll(".network-edge")).toHaveLength(5);
                expect([...element.querySelectorAll(".network-edge title")].some(title => title.textContent!.includes("A → A"))).toBe(false);
                click('[data-action="relationships"]');
                expect(element.querySelector(".network-list-content")!.textContent).toContain("A → A");
                const status = element.querySelector(".network-status")!.textContent!;
                expect(status).toContain("Self-links hidden");
                expect(status).toContain("Hidden self-link weight: 5");
                expect(status).toContain("Weight drawn in the diagram: 11");
                expect(status).toContain("Incomplete weight");
            });

            it("keeps honest linear weights, zero styling, neutral incomplete weights and secondary dashes", () => {
                const { element } = setupCircular();
                const lines = [...element.querySelectorAll(".edge-line")];
                const lineFor = (text: string) => lines.find(line => line.parentElement!.querySelector("title")!.textContent!.includes(text))!;
                expect(lineFor("A → B [PR]").getAttribute("stroke-width")).toBe("9");
                expect(lineFor("A → B [spec]").getAttribute("stroke-width")).toBe("4.5");
                expect(lineFor("A → B [spec]").getAttribute("stroke-dasharray")).toBe("6 4");
                expect(lineFor("B → C").getAttribute("stroke-width")).toBe("1");
                expect(element.querySelector(".incomplete-weight")!.getAttribute("stroke-width")).toBe("1.5");
                expect(element.querySelector(".incomplete-weight")!.getAttribute("stroke-dasharray")).toBe("3 3");
                for (const hit of element.querySelectorAll(".edge-hit")) expect(hit.getAttribute("pointer-events")).toBe("stroke");
                for (const edge of element.querySelectorAll(".network-edge")) expect(edge.getAttribute("tabindex")).toBe("0");
            });

            it("drills a person, preserves native incident selection, and excludes own items", () => {
                const { element, click, selectionManager, ids } = setupCircular();
                const order = [...element.querySelectorAll(".network-node")].map(node => node.getAttribute("data-node-id"));
                click('.network-node[data-node-id="s:A"]');
                expect(selectionManager.select).toHaveBeenCalledWith([ids.get(0), ids.get(1), ids.get(2)], false);
                expect(element.querySelectorAll(".network-item")).toHaveLength(1);
                expect(element.querySelectorAll(".network-item-edge")).toHaveLength(2);
                expect(element.querySelectorAll(".network-item-tether")).toHaveLength(1);
                expect(element.querySelector(".network-item-tether")!.getAttribute("stroke-dasharray")).toBe("2 3");
                expect(element.querySelector(".network-item-tether")!.getAttribute("stroke")).toBe(circularColor("s:B"));
                expect(element.querySelector(".network-guide-ring")!.getAttribute("r")).toBe("250");
                expect(element.querySelector(".network-node-core")!.getAttribute("r")).toBe("17");
                expect(element.querySelector(".network-role-halo")!.getAttribute("r")).toBe("23");
                expect([...element.querySelectorAll(".network-node")].map(node => node.getAttribute("data-node-id"))).toEqual(order);
                expect(element.querySelector(".network-status")!.textContent).toContain("1 visible inner items, 2 rendered Source → Item curves");
                expect(element.querySelector(".network-status")!.textContent).toContain("Own-item self-links excluded");
                click('[data-action="relationships"]');
                expect(element.querySelectorAll('[data-action="select-edge"]')).toHaveLength(6);
            });

            it("drills a source-target chord and toggles all items/reset without selecting extra rows", () => {
                const { element, click, selectionManager } = setupCircular();
                const chord = [...element.querySelectorAll(".network-edge")].find(edge => edge.querySelector("title")!.textContent!.includes("A → B"))!;
                chord.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                expect(element.querySelectorAll(".network-item-edge")).toHaveLength(2);
                click('[data-action="all-items"]');
                expect(element.querySelectorAll(".network-item")).toHaveLength(4);
                expect(element.querySelectorAll(".network-item-tether")).toHaveLength(4);
                expect(element.querySelector('[data-action="all-items"]')!.getAttribute("aria-pressed")).toBe("true");
                for (const label of element.querySelectorAll(".network-item-label")) {
                    const rotation = Number(/rotate\(([^)]+)\)/.exec(label.getAttribute("transform")!)![1]);
                    const normalized = ((rotation + 180) % 360 + 360) % 360 - 180;
                    expect(Math.abs(normalized)).toBeLessThanOrEqual(90.00001);
                }
                click('[data-action="all-items"]');
                expect(element.querySelectorAll(".network-item")).toHaveLength(0);
                click('[data-action="all-items"]');
                click('[data-action="reset-circle"]');
                expect(element.querySelectorAll(".network-item")).toHaveLength(0);
                expect(element.querySelector(".network-guide-ring")!.getAttribute("r")).toBe("245");
                expect(element.querySelector<HTMLButtonElement>('[data-action="reset-circle"]')!.disabled).toBe(true);
                expect(selectionManager.select).toHaveBeenCalledTimes(1);
                expect(selectionManager.clear).not.toHaveBeenCalled();
            });

            it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }])("modified click %o selects without drilling", modifiers => {
                const { element, click, selectionManager } = setupCircular();
                click('.network-node[data-node-id="s:A"]', modifiers);
                expect(selectionManager.select).toHaveBeenCalledWith(expect.any(Array), !!(modifiers.ctrlKey || modifiers.metaKey));
                expect(element.querySelectorAll(".network-item")).toHaveLength(0);
            });

            it("selects an inner item's union of native rows, while a curve selects only its rows; zoom stays stable", async () => {
                const { element, click, selectionManager, ids, camera, host } = setupCircular();
                click('[data-action="all-items"]');
                click('[data-action="zoom-in"]');
                const before = camera();
                const item = [...element.querySelectorAll(".network-item")].find(item => item.querySelector("title")!.textContent!.startsWith("work;"))!;
                item.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
                expect(selectionManager.select).toHaveBeenCalledWith([ids.get(0), ids.get(1), ids.get(3)], false);
                expect(item.classList.contains("local-item")).toBe(true);
                expect(element.querySelectorAll(".network-item-edge.local-item")).toHaveLength(3);
                expect(element.querySelectorAll(".network-item-tether.local-item")).toHaveLength(1);
                expect(camera()).toBe(before);
                item.dispatchEvent(new FocusEvent("focus"));
                expect(host.tooltipService.show).toHaveBeenCalledWith(expect.objectContaining({
                    identities: [ids.get(0), ids.get(1), ids.get(3)],
                    dataItems: expect.arrayContaining([{ displayName: "Measure", value: "42" }])
                }));
                expect(item.getAttribute("aria-label")).toContain("Weight: 11; 3 relationships; 3 Contributing rows");
                await vi.waitFor(() => expect(element.querySelector(".network-notice")!.textContent).toBe(""));
                await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
                selectionManager.select.mockClear();
                const curve = element.querySelector(".network-item-edge.local-item")!;
                curve.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
                expect(selectionManager.select).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ getKey: expect.any(Function) })]), true);
                expect(selectionManager.select.mock.calls[0][0]).toHaveLength(1);
                expect(camera()).toBe(before);
            });

            it("keeps local toolbar/list exploration separate from report selection, including disabled hosts", () => {
                const { element, click, selectionManager } = setupCircular(circularData(), host => { host.hostCapabilities.allowInteractions = false; });
                click('[data-action="focus-node"][data-focus-key="s:A"]');
                expect(element.querySelectorAll(".network-item")).toHaveLength(1);
                click('[data-action="all-items"]');
                click('[data-action="reset-circle"]');
                expect(selectionManager.select).not.toHaveBeenCalled();
                expect(element.querySelector(".network-status")!.textContent).toContain("Report interactions are disabled");
            });

            it("overrides all node/edge/marker/tether colors in host High Contrast", () => {
                const { element, click } = setupCircular(circularData(), host => {
                    host.colorPalette.isHighContrast = true;
                    host.colorPalette.foreground.value = "#ffff00";
                    host.colorPalette.background.value = "#000000";
                    host.colorPalette.foregroundSelected.value = "#00ffff";
                });
                for (const selector of [".network-node-core", ".network-role-halo", ".edge-line"]) {
                    for (const mark of element.querySelectorAll(selector)) expect(mark.getAttribute("stroke")).toBe("#ffff00");
                }
                expect(element.querySelectorAll("marker")).toHaveLength(1);
                expect(element.querySelector("marker path")!.getAttribute("fill")).toBe("#ffff00");
                click('[data-action="all-items"]');
                for (const selector of [".network-item-core", ".network-item-tether", ".edge-line", ".network-node-core"]) {
                    for (const mark of element.querySelectorAll(selector)) expect(mark.getAttribute("stroke")).toBe("#ffff00");
                }
                expect(element.querySelector("marker path")!.getAttribute("fill")).toBe("#ffff00");
                expect(element.querySelector<HTMLElement>(".atlyn-network")!.style.getPropertyValue("--bg")).toBe("var(--background)");
            });

            it("supports deterministic type/uniform colors, dark surfaces, and role-ring opt out", () => {
                const data = circularData({ objects: { appearance: { colorMode: "relationshipType" } } });
                const fixture = setupCircular(data);
                const lines = [...fixture.element.querySelectorAll(".edge-line:not(.incomplete-weight)")];
                expect(new Set(lines.map(line => line.getAttribute("stroke"))).size).toBe(2);
                for (const line of lines) {
                    const type = line.parentElement!.querySelector("title")!.textContent!.includes("[spec]") ? "spec" : "PR";
                    expect(line.getAttribute("stroke")).toBe(circularColor(`type:${type}`));
                }
                data.metadata.objects!.appearance = { colorMode: "uniform", roleRings: false, nodeColor: { solid: { color: "#112233" } }, edgeColor: { solid: { color: "#445566" } } };
                fixture.update();
                expect(fixture.element.querySelectorAll(".network-role-halo")).toHaveLength(0);
                expect(fixture.element.querySelector('.network-node[data-node-id="s:A"] .network-node-core')!.getAttribute("fill")).toBe("#112233");
                for (const line of fixture.element.querySelectorAll(".edge-line")) expect(line.getAttribute("stroke")).toBe("#445566");
                fixture.host.colorPalette.background.value = "#111111";
                data.metadata.objects!.appearance = { colorMode: "source" };
                fixture.update();
                expect(fixture.element.querySelector('.network-node[data-node-id="s:A"] .network-node-core')!.getAttribute("stroke")).toBe(circularColor("s:A", true));
            });

            it("renders numbered dense-ring badges and a complete keyboard-accessible legend", () => {
                const sources = Array.from({ length: 20 }, (_, index) => `Person ${index}`);
                const { element, click, selectionManager } = setupCircular(circularData({
                    sources, targets: sources.map((_, index) => sources[(index + 1) % sources.length]),
                    items: sources.map((_, index) => `item ${index}`), types: sources.map(() => "PR"), weights: sources.map(() => 1)
                }));
                expect(element.querySelectorAll(".network-badge")).toHaveLength(20);
                expect(element.querySelectorAll(".network-perimeter-label")).toHaveLength(0);
                expect(element.querySelectorAll(".network-badge-legend button")).toHaveLength(20);
                expect(element.querySelectorAll(".network-color-swatch")).toHaveLength(20);
                expect(element.querySelector<HTMLElement>(".network-badge-legend")!.hidden).toBe(false);
                click(".network-badge-legend button");
                expect(element.querySelectorAll(".network-item")).toHaveLength(1);
                expect(selectionManager.select).not.toHaveBeenCalled();
            });

            it("localizes controls/disclosures for RTL and preserves mixed-direction identifiers", () => {
                const { element, click } = setupCircular(circularData(), host => { host.locale = "ar-SA"; });
                expect(element.querySelector<HTMLElement>(".atlyn-network")!.dir).toBe("rtl");
                expect(element.querySelector('[data-action="all-items"]')!.textContent).toBe("كل العناصر");
                expect(element.querySelector(".network-status")!.textContent).toContain("العلاقات الذاتية مخفية");
                click('[data-action="all-items"]');
                expect(element.querySelector(".network-status")!.textContent).toContain("عناصر داخلية ظاهرة");
                expect(element.querySelector(".network-item-label")!.textContent).toBeTruthy();
            });

            it("resets camera on layout changes but not native selection or highlight-only updates", () => {
                Object.defineProperty(SVGElement.prototype, "getComputedTextLength", { configurable: true, value: () => 32 });
                const { element, click, camera, update, data } = setupCircular();
                const overview = camera();
                click('[data-action="zoom-in"]');
                const zoomed = camera();
                const values = data.categorical!.values!;
                values[0].highlights = [6, null, null, null, null, null];
                update();
                expect(camera()).toBe(zoomed);
                expect(element.querySelectorAll(".network-edge.dimmed").length).toBeGreaterThan(0);
                click('[data-action="all-items"]');
                expect(camera()).not.toBe(zoomed);
                click('[data-action="reset-circle"]');
                expect(camera()).toBe(overview);
                data.metadata.objects!.exploration!.layoutMode = "force";
                update();
                expect(element.querySelector(".network-guide-ring")).toBeNull();
                expect(element.querySelector<HTMLDivElement>(".network-circle-controls")!.hidden).toBe(true);
                data.metadata.objects!.exploration!.layoutMode = "circular";
                update();
                expect(camera()).toBe(overview);
            });

            it("supports Edge ID fallback items and shows self-links only when explicitly requested", () => {
                const { element, click } = setupCircular(circularData({ items: false, edgeIds: ["e0", "e1", "e2", "e3", "e4", "e5"],
                    objects: { exploration: { selfLinks: "show" } } }));
                expect(element.querySelectorAll(".network-edge")).toHaveLength(6);
                expect(element.querySelector(".network-status")!.textContent).not.toContain("Self-links hidden");
                click('[data-action="focus-node"][data-focus-key="s:A"]');
                expect(element.querySelectorAll(".network-item")).toHaveLength(2);
                expect(element.querySelector(".network-status")!.textContent).toContain("Own-item self-links excluded");
            });

            it("hides item controls without item bindings and scales dense detail edges to the density ceiling", () => {
                const empty = setupCircular(circularData({ items: false }));
                expect(empty.element.querySelector<HTMLElement>(".network-circle-controls")!.hidden).toBe(true);
                const sources = Array.from({ length: 32 }, (_, index) => `Source ${index}`);
                const { element, click } = setupCircular(circularData({
                    sources, targets: sources.map(() => "Owner"), items: sources.map((_, index) => `item ${index}`),
                    types: sources.map(() => "PR"), weights: sources.map(() => 1)
                }));
                click('[data-action="all-items"]');
                const expected = 9 * Math.sqrt(16 / 32);
                for (const line of element.querySelectorAll(".edge-line")) expect(Number(line.getAttribute("stroke-width"))).toBeCloseTo(expected);
            });

            it("persists and restores detail/item/camera state, supports legacy v1, and rejects missing references", async () => {
                const fixture = setupCircular();
                fixture.click('[data-action="all-items"]');
                fixture.click(".network-item");
                fixture.click('[data-action="zoom-in"]');
                fixture.click('[data-action="save-view"]');
                await vi.waitFor(() => expect(fixture.host.persistProperties).toHaveBeenCalled());
                const json = vi.mocked(fixture.host.persistProperties).mock.calls[0][0].merge![0].properties.savedView as string;
                const saved = JSON.parse(json) as SavedView;
                expect(saved.circularDetail).toBe("allItems");
                expect(saved.circularItem).toBeTruthy();
                const restored = setupCircular(circularData({ objects: { navigation: { savedView: json } } }));
                expect(restored.element.querySelectorAll(".network-item")).toHaveLength(4);
                expect(restored.element.querySelector(".network-item.local-item")!.getAttribute("data-item-id")).toBe(saved.circularItem);
                const expectedCamera = fixture.camera()!.match(/-?[\d.]+/g)!.map(Number);
                const checkCamera = () => restored.camera()!.match(/-?[\d.]+/g)!.map(Number)
                    .forEach((coordinate, index) => expect(coordinate).toBeCloseTo(expectedCamera[index], 10));
                checkCamera();
                restored.update();
                checkCamera();
                for (const fields of [{ circularSource: "s:missing", circularDetail: "source", circularItem: undefined },
                    { circularTarget: "s:missing", circularSource: "s:A", circularDetail: "pair", circularItem: undefined },
                    { circularItem: "removed" }]) {
                    restored.data.metadata.objects!.navigation = { savedView: JSON.stringify({ ...saved, ...fields }) };
                    restored.update();
                    expect(restored.element.querySelectorAll(".network-item")).toHaveLength(0);
                    expect(restored.element.querySelector(".network-notice")!.textContent).toContain("Saved local view is invalid");
                }
                const legacy = { ...saved };
                delete legacy.circularDetail; delete legacy.circularSource; delete legacy.circularTarget; delete legacy.circularItem;
                restored.data.metadata.objects!.navigation = { savedView: JSON.stringify(legacy) };
                restored.update();
                expect(restored.element.querySelectorAll(".network-item")).toHaveLength(0);
                expect(restored.element.querySelector(".network-notice")!.textContent).toBe("");
            });
        });
describe("Circular saved focus and safety", () => {
    it("applies incoming native mixed selection without changing the circular camera", async () => {
        const fixture = setupCircular();
        fixture.click('[data-action="zoom-in"]');
        const before = fixture.camera();
        fixture.selectionManager.getSelectionIds.mockReturnValue([fixture.ids.get(0)!]);
        fixture.selectionManager.registerOnSelectCallback.mock.calls.at(-1)![0]();
        await vi.waitFor(() => expect(fixture.element.querySelector('.network-node[data-node-id="s:A"]')!.getAttribute("aria-pressed")).toBe("mixed"));
        expect(fixture.camera()).toBe(before);
        expect(fixture.element.querySelectorAll(".network-edge.dimmed").length).toBeGreaterThan(0);
        fixture.update();
        expect(fixture.camera()).toBe(before);
    });

    it("budgets long labels for Fit while keeping full accessible names, including at 24px", () => {
        const name = "A".repeat(150);
        const fixture = setupCircular(circularData({
            sources: [name], targets: ["Owner"], items: ["Item".repeat(40)], types: ["PR"], weights: [1]
        }));
        const label = fixture.element.querySelector(".network-perimeter-label")!;
        expect(label.textContent).toHaveLength(80);
        expect(fixture.element.querySelector(".network-node")!.getAttribute("aria-label")).toContain(name);
        const initial = fixture.camera()!.match(/scale\(([^)]+)\)/)![1];
        fixture.data.metadata.objects!.appearance = { labelSize: 24 };
        fixture.update();
        expect(Number(fixture.camera()!.match(/scale\(([^)]+)\)/)![1])).toBeLessThan(Number(initial));
        fixture.click('[data-action="all-items"]');
        expect(fixture.element.querySelector(".network-item-label")!.textContent).toHaveLength(80);
        expect(fixture.element.querySelector(".network-item")!.getAttribute("aria-label")).toContain("Item".repeat(40));
    });

    it.each(["source", "pair"] as const)("saves and restores %s drill references", async detail => {
        const fixture = setupCircular();
        if (detail === "source") fixture.click('[data-action="focus-node"][data-focus-key="s:A"]');
        else {
            const chord = [...fixture.element.querySelectorAll(".network-edge")].find(edge => edge.querySelector("title")!.textContent!.includes("A → B"))!;
            chord.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }
        fixture.click('[data-action="save-view"]');
        await vi.waitFor(() => expect(fixture.host.persistProperties).toHaveBeenCalled());
        const json = vi.mocked(fixture.host.persistProperties).mock.calls[0][0].merge![0].properties.savedView as string;
        expect(JSON.parse(json)).toMatchObject({ circularDetail: detail, circularSource: "s:A" });
        if (detail === "pair") expect(JSON.parse(json).circularTarget).toBe("s:B");
        const restored = setupCircular(circularData({ objects: { navigation: { savedView: json } } }));
        expect(restored.element.querySelectorAll(".network-item")).toHaveLength(1);
        expect(restored.element.querySelectorAll(".network-item-edge")).toHaveLength(2);
        expect(restored.selectionManager.select).not.toHaveBeenCalled();
        // Even when the snapshot property is unchanged, a filtered-out reference must reset visibly.
        restored.data.categorical!.categories![0].values = ["X", "X", "X", "C", "B", "D"];
        restored.data.categorical!.categories![1].values = ["B", "B", "X", "B", "C", null];
        restored.update();
        expect(restored.element.querySelectorAll(".network-item")).toHaveLength(0);
        expect(restored.element.querySelector(".network-notice")!.textContent).toContain("Saved local view is invalid");
    });

    it.each([200, 201])("keeps whole-item native identity limit at %i rows", count => {
        const fixture = setupCircular(circularData({
            sources: Array(count).fill("A"), targets: Array(count).fill("B"),
            items: Array(count).fill("work"), types: Array(count).fill("PR"), weights: Array(count).fill(1)
        }));
        fixture.click('[data-action="all-items"]');
        fixture.click(".network-item");
        if (count === 200) {
            expect(fixture.selectionManager.select).toHaveBeenCalledTimes(1);
            expect(fixture.selectionManager.select.mock.calls[0][0]).toHaveLength(200);
        } else {
            expect(fixture.selectionManager.select).not.toHaveBeenCalled();
            expect(fixture.element.querySelector(".network-notice")!.textContent).toContain("more than 200");
        }
    });

    it("refuses incomplete item identities and preserves visual-level aggregate context menus", () => {
        const data = circularData();
        data.categorical!.categories![0].identity![0] = undefined as unknown as powerbi.DataViewScopeIdentity;
        const fixture = setupCircular(data);
        fixture.click('[data-action="all-items"]');
        const item = [...fixture.element.querySelectorAll(".network-item")].find(item => item.querySelector("title")!.textContent!.startsWith("work;"))!;
        item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(fixture.selectionManager.select).not.toHaveBeenCalled();
        expect(fixture.element.querySelector(".network-notice")!.textContent).toContain("complete native identities");
        item.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }));
        expect(fixture.selectionManager.showContextMenu).toHaveBeenCalledWith({}, expect.any(Object));
    });
});

describe("Visual empty state and background context", () => {
    it("triggers context menu when right-clicking on empty background, header, or status", () => {
        const { host, contextCalls } = mockVisualHost();
        const element = document.createElement("div");
        const visual = new Visual({ element, host });

        const header = element.querySelector<HTMLDivElement>(".network-header");
        expect(header).not.toBeNull();
        header!.dispatchEvent(new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 50,
            clientY: 20
        }));

        expect(contextCalls).toHaveLength(1);
        expect(contextCalls[0]).toEqual({
            id: {},
            position: { x: 50, y: 20 }
        });

        visual.destroy();
    });

    it("displays prompt and clean empty state when required fields are missing", () => {
        const { host } = mockVisualHost();
        const element = document.createElement("div");
        const visual = new Visual({ element, host });

        visual.update({
            viewport: { width: 800, height: 600 },
            viewMode: powerbi.ViewMode.View,
            type: powerbi.VisualUpdateType.Data,
            dataViews: []
        });

        const status = element.querySelector<HTMLDivElement>(".network-status");
        expect(status?.textContent).toContain("Add Source ID and Target ID");

        const nodes = element.querySelectorAll(".network-node");
        const edges = element.querySelectorAll(".network-edge");
        expect(nodes).toHaveLength(0);
        expect(edges).toHaveLength(0);

        visual.destroy();
    });

    it("safely handles individual role drag (source only, target only, weight only)", () => {
        const { host } = mockVisualHost();
        const element = document.createElement("div");
        const visual = new Visual({ element, host });

        // Source only
        const sourceCol: powerbi.DataViewCategoryColumn = {
            source: { displayName: "Source ID", queryName: "source", roles: { source: true }, type: { text: true } },
            values: ["S1", "S2"],
            identity: [{ key: "s1" } as unknown as powerbi.DataViewScopeIdentity, { key: "s2" } as unknown as powerbi.DataViewScopeIdentity]
        };
        visual.update({
            viewport: { width: 800, height: 600 },
            viewMode: powerbi.ViewMode.View,
            type: powerbi.VisualUpdateType.Data,
            dataViews: [{
                metadata: { columns: [sourceCol.source] },
                categorical: { categories: [sourceCol] }
            }]
        });
        const status = element.querySelector<HTMLDivElement>(".network-status");
        expect(status?.textContent).toContain("Add Source ID and Target ID");
        expect(element.querySelectorAll(".network-node")).toHaveLength(0);

        // Target only
        const targetCol: powerbi.DataViewCategoryColumn = {
            source: { displayName: "Target ID", queryName: "target", roles: { target: true }, type: { text: true } },
            values: ["T1", "T2"],
            identity: [{ key: "t1" } as unknown as powerbi.DataViewScopeIdentity, { key: "t2" } as unknown as powerbi.DataViewScopeIdentity]
        };
        visual.update({
            viewport: { width: 800, height: 600 },
            viewMode: powerbi.ViewMode.View,
            type: powerbi.VisualUpdateType.Data,
            dataViews: [{
                metadata: { columns: [targetCol.source] },
                categorical: { categories: [targetCol] }
            }]
        });
        expect(status?.textContent).toContain("Add Source ID and Target ID");
        expect(element.querySelectorAll(".network-node")).toHaveLength(0);

        // Weight only
        const weightCol: powerbi.DataViewValueColumn = {
            source: { displayName: "Weight", queryName: "weight", roles: { weight: true }, type: { numeric: true } },
            values: [10, 20]
        };
        visual.update({
            viewport: { width: 800, height: 600 },
            viewMode: powerbi.ViewMode.View,
            type: powerbi.VisualUpdateType.Data,
            dataViews: [{
                metadata: { columns: [weightCol.source] },
                categorical: { values: [weightCol] as unknown as powerbi.DataViewValueColumns }
            }]
        });
        expect(status?.textContent).toContain("Add Source ID and Target ID");
        expect(element.querySelectorAll(".network-node")).toHaveLength(0);

        visual.destroy();
    });

    it("proves capabilities.json conditions accept individual role drags from a blank visual", () => {
        const capabilities = JSON.parse(readFileSync(path.join(process.cwd(), "capabilities.json"), "utf8"));
        const condition = capabilities.dataViewMappings[0].conditions[0];

        // Power BI condition evaluator:
        // An assignment { role: count } is accepted if all assigned counts <= max (and >= min if set),
        // and unassigned roles (count 0) have no min > 0.
        function isConditionMet(cond: Record<string, { min?: number; max?: number }>, assigned: Record<string, number>): boolean {
            for (const [role, rule] of Object.entries(cond)) {
                const count = assigned[role] ?? 0;
                if (rule.min !== undefined && count < rule.min) return false;
                if (rule.max !== undefined && count > rule.max) return false;
            }
            return true;
        }

        // Current capabilities: individual field drag from blank visual is accepted
        expect(isConditionMet(condition, { source: 1 })).toBe(true);
        expect(isConditionMet(condition, { target: 1 })).toBe(true);
        expect(isConditionMet(condition, { weight: 1 })).toBe(true);
        expect(isConditionMet(condition, { relationshipType: 1 })).toBe(true);
        expect(isConditionMet(condition, { edgeId: 1 })).toBe(true);
        expect(isConditionMet(condition, { itemId: 1 })).toBe(true);
        expect(isConditionMet(condition, { tooltips: 1 })).toBe(true);

        // Incremental combinations are accepted
        expect(isConditionMet(condition, { source: 1, target: 1 })).toBe(true);
        expect(isConditionMet(condition, { source: 1, target: 1, weight: 1 })).toBe(true);

        // Exceeding max is rejected
        expect(isConditionMet(condition, { source: 2 })).toBe(false);
        expect(isConditionMet(condition, { target: 2 })).toBe(false);
        expect(isConditionMet(condition, { weight: 2 })).toBe(false);
        expect(isConditionMet(condition, { itemId: 2 })).toBe(false);

        // Contrast: old 1.1.0.0 condition with min: 1 on source AND target rejected individual drags
        const oldCondition = {
            source: { min: 1, max: 1 },
            target: { min: 1, max: 1 },
            weight: { max: 1 }
        };
        expect(isConditionMet(oldCondition, { source: 1 })).toBe(false); // target min: 1 failed
        expect(isConditionMet(oldCondition, { target: 1 })).toBe(false); // source min: 1 failed
        expect(isConditionMet(oldCondition, { weight: 1 })).toBe(false); // both source and target min: 1 failed
    });
});
