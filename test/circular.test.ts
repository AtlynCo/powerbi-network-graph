import { describe, expect, it } from "vitest";
import { buildGraph, FALLBACK_BUCKET_ID, GraphOptions, InputRow } from "../src/graph";
import { CIRCULAR_CENTER, circularColor, densityStrokeMax, layoutCircularDetail, layoutCircularOverview, orderCircularNodes, radialItemLabel } from "../src/circular";
import { layoutGraph, topologySignature } from "../src/layout";

const graph = (rows: Omit<InputRow, "index">[], options: Partial<GraphOptions> = {}) =>
    buildGraph(rows.map((row, index) => ({ ...row, index })), {
        weighted: true, edgeIds: false, hasHighlights: false, partial: false, ...options
    });
const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

describe("deterministic circular overview", () => {
    it("orders normalized labels with stable typed tie-breaks and keeps the bucket last under both orderings", () => {
        const g = graph([
            { source: "z", target: "Alpha", weight: 3 },
            { source: "ALPHA", target: "b", weight: 2 },
            { source: "b", target: null, weight: 100 },
            { source: "z", target: "z", weight: 1000 }
        ], { groupBlankTargets: true });
        expect(orderCircularNodes(g).map(node => node.id)).toEqual(["s:ALPHA", "s:Alpha", "s:b", "s:z", FALLBACK_BUCKET_ID]);
        expect(orderCircularNodes(g, "weight").map(node => node.id)).toEqual(["s:b", "s:Alpha", "s:z", "s:ALPHA", FALLBACK_BUCKET_ID]);
    });
    it("uses exact clockwise ring angles and outward hemisphere label anchors", () => {
        const g = graph(["A", "B", "C", "D"].map(source => ({ source, target: source, weight: 1 })));
        const layout = layoutCircularOverview(g);
        expect(layout.guide).toEqual({ cx: 320, cy: 320, r: 245 });
        expect([...layout.positions.values()]).toEqual([
            { x: 320, y: 75 }, { x: 565, y: 320 }, { x: 320, y: 565 }, { x: 75, y: 320.00000000000006 }
        ]);
        expect([...layout.nodes.values()].map(node => node.angle)).toEqual([-Math.PI / 2, 0, Math.PI / 2, Math.PI]);
        expect([...layout.nodes.values()].map(node => [node.label.hemisphere, node.label.textAnchor]))
            .toEqual([["top", "middle"], ["right", "start"], ["bottom", "middle"], ["left", "end"]]);
        for (const node of layout.nodes.values()) expect(distance(node.label, CIRCULAR_CENTER)).toBeCloseTo(279);
    });
    it("keeps self-only entities but hides their routes and role rings without mutating the graph", () => {
        const g = graph([{ source: "A", target: "B", weight: 2 }, { source: "C", target: "C", weight: 5 }]);
        const before = JSON.stringify(g);
        const layout = layoutCircularOverview(g);
        expect(layout.positions.size).toBe(3);
        expect(layout.routes.size).toBe(1);
        expect(layout.nodes.get("s:A")).toMatchObject({ coreRadius: 19, haloRadius: null, isSource: true, isTarget: false, sourceStrokeWidth: 3 });
        expect(layout.nodes.get("s:B")).toMatchObject({ haloRadius: 24, isTarget: true, sourceStrokeWidth: 2 });
        expect(layout.nodes.get("s:C")).toMatchObject({ haloRadius: null, isSource: false, isTarget: false, sourceStrokeWidth: 2 });
        expect(layout.selfLinks).toMatchObject({ selfEdgeCount: 1, selfWeight: 5, drawnWeight: 2 });
        expect(JSON.stringify(g)).toBe(before);
        expect(layoutCircularOverview(g, { roleRings: false }).nodes.get("s:B")!.haloRadius).toBeNull();
        expect(layoutCircularOverview(g, { roleRings: false }).nodes.get("s:A")!.sourceStrokeWidth).toBe(2);
    });
    it("pulls single chords to the exact center and insets endpoints outside core and target halos", () => {
        const g = graph([{ source: "A", target: "B", weight: 2 }]);
        const layout = layoutCircularOverview(g);
        const route = layout.routes.get(g.edges[0].id)!;
        expect(route.controls[1]).toEqual(CIRCULAR_CENTER);
        expect(distance(route.controls[0], layout.positions.get("s:A")!)).toBeCloseTo(28);
        expect(distance(route.controls[2], layout.positions.get("s:B")!)).toBeCloseTo(38);
        const noRings = layoutCircularOverview(g, { roleRings: false });
        expect(distance(noRings.routes.get(g.edges[0].id)!.controls[2], noRings.positions.get("s:B")!)).toBeCloseTo(32);
    });
    it("separates reciprocal and parallel type curves deterministically under reordered input", () => {
        const rows = [
            { source: "A", target: "B", weight: 1 }, { source: "B", target: "A", weight: 2 },
            { source: "A", target: "B", type: "x", weight: 3 }, { source: "A", target: "B", type: "y", weight: 4 }
        ];
        const a = layoutCircularOverview(graph(rows));
        const b = layoutCircularOverview(graph([...rows].reverse()));
        expect([...a.routes.values()].map(route => route.controls[1])).toEqual([...b.routes.values()].map(route => route.controls[1]));
        expect(new Set([...a.routes.values()].map(route => JSON.stringify(route.controls[1]))).size).toBe(4);
        expect(a.signature).toBe(b.signature);
    });
    it("routes shown self-loops as outward petals and fits every control point", () => {
        const g = graph(Array.from({ length: 5 }, (_, index) => ({ source: "A", target: "A", edgeId: index, weight: 1 })), { edgeIds: true });
        const layout = layoutCircularOverview(g, { hideSelfLinks: false });
        expect(layout.routes.size).toBe(5);
        expect(new Set([...layout.routes.values()].map(route => route.path)).size).toBe(5);
        for (const route of layout.routes.values()) {
            expect(route.path).toContain(" C ");
            for (const point of route.controls) {
                expect(distance(point, CIRCULAR_CENTER)).toBeGreaterThan(245);
                expect(point.x).toBeGreaterThanOrEqual(layout.bounds.x);
                expect(point.x).toBeLessThanOrEqual(layout.bounds.x + layout.bounds.width);
                expect(point.y).toBeGreaterThanOrEqual(layout.bounds.y);
                expect(point.y).toBeLessThanOrEqual(layout.bounds.y + layout.bounds.height);
            }
        }
    });
    it("exposes deterministic density badges without dropping any entity", () => {
        const g = graph(Array.from({ length: 17 }, (_, i) => ({ source: i, target: i, weight: 1 })));
        const layout = layoutCircularOverview(g);
        expect(layout.usesBadges).toBe(true);
        expect([...layout.nodes.values()].map(node => node.badgeNumber)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
        expect(layoutCircularOverview(g, { avoidLabelOverlap: false }).usesBadges).toBe(false);
    });
    it("keeps empty, singleton and maximum graphs finite and bounded", () => {
        for (const g of [
            graph([]), graph([{ source: "A", target: "A", weight: 1 }]),
            graph(Array.from({ length: 1000 }, (_, i) => ({ source: i % 250, target: (i + 1) % 250, edgeId: i, weight: 1 })), { edgeIds: true })
        ]) {
            const layout = layoutCircularOverview(g);
            expect(layout.bounds.width).toBeGreaterThan(0);
            expect(layout.bounds.height).toBeGreaterThan(0);
            expect([...layout.positions.values()].every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
            expect([...layout.routes.values()].every(route => !/NaN|Infinity/.test(route.path))).toBe(true);
            expect(layout.routes.size).toBe(g.edges.filter(edge => edge.source !== edge.target).length);
        }
    });
});

describe("two-ring item detail", () => {
    const fixture = () => graph([
        { source: "Z", target: "B", itemId: "b-low", weight: 1 },
        { source: "Z", target: "A", itemId: "a-low", weight: 2 },
        { source: "Y", target: "A", itemId: "a-high", weight: 10 },
        { source: "Z", target: "A", itemId: "a-high", weight: 3 },
        { source: "A", target: "A", itemId: "self", weight: 100 },
        { source: "Z", target: null, itemId: "external", weight: 50 }
    ], { itemIds: true, groupBlankTargets: true });
    it("sorts items by owner arc then weight, preserving the overview mental map and all row identities", () => {
        const g = fixture();
        const layout = layoutCircularDetail(g);
        expect(layout.orderedNodes.map(node => node.id)).toEqual(layoutCircularOverview(g).orderedNodes.map(node => node.id));
        expect(layout.visibleItems.map(item => item.label)).toEqual(["a-high", "a-low", "b-low", "external"]);
        expect(layout.guide.r).toBe(250);
        expect(layout.innerGuide.r).toBe(185);
        for (const point of layout.itemPositions.values()) expect(distance(point, CIRCULAR_CENTER)).toBeCloseTo(185);
        expect(layout.nodes.get("s:A")).toMatchObject({ coreRadius: 17, haloRadius: 23 });
        expect(layout.renderedItemEdges.flatMap(edge => edge.rows).sort()).toEqual([0, 1, 2, 3, 5]);
    });
    it("supports outgoing source, directed pair, selected item and all-items focus without deleting overview data", () => {
        const g = fixture();
        expect(layoutCircularDetail(g, { focusSource: "s:Z" }).renderedItemEdges.every(edge => edge.source === "s:Z")).toBe(true);
        const pair = layoutCircularDetail(g, { focusPair: ["s:Z", "s:A"] });
        expect(pair.visibleItems.map(item => item.label)).toEqual(["a-high", "a-low"]);
        expect(pair.renderedItemEdges.flatMap(edge => edge.rows).sort()).toEqual([1, 3]);
        const selectedItemId = g.items!.find(item => item.label === "a-high")!.id;
        const selected = layoutCircularDetail(g, { selectedItemId });
        expect(selected.visibleItems).toHaveLength(1);
        expect(selected.renderedItemEdges.map(edge => edge.source).sort()).toEqual(["s:Y", "s:Z"]);
        const all = layoutCircularDetail(g, { allItems: true });
        expect(all.visibleItems.map(item => item.label)).toContain("self");
        expect(all.renderedItemEdges.every(edge => edge.source !== edge.target)).toBe(true);
        expect(layoutCircularDetail(g, { hideSelfLinks: false }).renderedItemEdges).toHaveLength(6);
        expect(layoutCircularDetail(g, { focusSource: "missing" }).visibleItems).toEqual([]);
        expect(g.edges).toHaveLength(5);
    });
    it("provides dotted owner-color tethers with exact insets and muted bucket ownership", () => {
        const layout = layoutCircularDetail(fixture());
        expect(layout.ownershipTethers).toHaveLength(4);
        for (const tether of layout.ownershipTethers) {
            expect(tether.dotted).toBe(true);
            expect(tether.color).toBe(layout.colors.get(tether.ownerId));
            expect(distance(tether.route.controls[0], layout.positions.get(tether.ownerId)!)).toBeCloseTo(24);
            expect(distance(tether.route.controls[1], layout.itemPositions.get(tether.itemId)!)).toBeCloseTo(12);
        }
        expect(layout.ownershipTethers.find(tether => tether.ownerId === FALLBACK_BUCKET_ID)?.muted).toBe(true);
    });
    it("insets source/item curves and approaches nearby or opposite items from inside without inverted arrowheads", () => {
        const g = graph(Array.from({ length: 32 }, (_, i) => ({
            source: `person${i % 8}`, target: `owner${i % 4}`, itemId: `item${i}`, weight: 1,
            type: i % 2 ? "x" : "y"
        })), { itemIds: true });
        const layout = layoutCircularDetail(g);
        for (const edge of layout.renderedItemEdges) {
            const [start, control, end] = layout.routes.get(edge.id)!.controls;
            const target = layout.itemPositions.get(edge.itemId)!;
            expect(distance(start, layout.positions.get(edge.source)!)).toBeCloseTo(26);
            expect(distance(end, target)).toBeCloseTo(12);
            expect(distance(control, CIRCULAR_CENTER)).toBeLessThanOrEqual(150 + 1e-8);
            // Terminal tangent and the target's outward radial vector have a positive dot product.
            expect((end.x - control.x) * (target.x - 320) + (end.y - control.y) * (target.y - 320)).toBeGreaterThan(0);
        }
        expect(layout.strokeMax).toBeCloseTo(9 * Math.sqrt(16 / 32));
    });
    it("separates parallel source/item types and preserves selected self-only items", () => {
        const g = graph([
            { source: "A", target: "B", itemId: "shared", type: 1, weight: 1 },
            { source: "A", target: "B", itemId: "shared", type: "1", weight: 1 },
            { source: "B", target: "B", itemId: "self", weight: 1 }
        ], { itemIds: true });
        const detail = layoutCircularDetail(g);
        expect(new Set([...detail.routes.values()].map(route => route.path)).size).toBe(2);
        const self = layoutCircularDetail(g, { selectedItemId: g.items!.find(item => item.label === "self")!.id });
        expect(self.visibleItems).toHaveLength(1);
        expect(self.renderedItemEdges).toEqual([]);
        expect(self.ownershipTethers).toHaveLength(1);
    });
    it("places the 12 o'clock item label inward, clear of the outer ring", () => {
        const itemPoint = { x: 320, y: 135 };
        const label = radialItemLabel(itemPoint);
        expect(label.y).toBeGreaterThan(itemPoint.y);
        expect(label).toMatchObject({ rotation: -90, textAnchor: "end" });
        expect(distance(label, CIRCULAR_CENTER)).toBeCloseTo(170);
        expect(distance(label, CIRCULAR_CENTER)).toBeLessThan(250);
    });
    it("uses upright radial label flips and density-adaptive stroke limits", () => {
        expect(radialItemLabel({ x: 135, y: 320 })).toMatchObject({ rotation: 360, textAnchor: "start" });
        expect(radialItemLabel({ x: 505, y: 320 })).toMatchObject({ rotation: 0, textAnchor: "end" });
        expect(radialItemLabel({ x: 320, y: 135 })).toMatchObject({ rotation: -90, textAnchor: "end" });
        expect(densityStrokeMax(16)).toBe(9);
        expect(densityStrokeMax(17)).toBeCloseTo(9 * Math.sqrt(16 / 17));
        expect(densityStrokeMax(100000)).toBe(1.5);
    });
});

describe("layout dispatch, invalidation and categorical color", () => {
    it("preserves default force signatures but invalidates mode, order, self-link and detail options", () => {
        const g = graph([{ source: "A", target: "B", itemId: "item", weight: 1 }, { source: "A", target: "A", weight: 2 }], { itemIds: true });
        const circular = { layoutMode: "circular" as const };
        expect(topologySignature(g)).toBe(topologySignature(g, { layoutMode: "force" }));
        expect(layoutGraph(g, circular)).toEqual(layoutCircularOverview(g));
        const signatures = [
            topologySignature(g), topologySignature(g, circular),
            topologySignature(g, { ...circular, circularOrder: "weight" }),
            topologySignature(g, { ...circular, selfLinks: "show" }),
            topologySignature(g, { ...circular, selfLinks: "hide" }),
            topologySignature(g, { ...circular, roleRings: false }),
            topologySignature(g, { ...circular, detail: { focusSource: "s:A" } })
        ];
        expect(new Set(signatures).size).toBe(signatures.length);
        expect(layoutGraph(g, { selfLinks: "hide" }).routes.size).toBe(1);
        expect(layoutGraph(g, { ...circular, selfLinks: "show" }).routes.size).toBe(2);
        expect(layoutGraph(g, { ...circular, detail: { focusSource: "s:A" } }).signature)
            .toBe(topologySignature(g, { ...circular, detail: { focusSource: "s:A" } }));
        const heavier = graph([{ source: "A", target: "B", itemId: "item", weight: 9 }, { source: "A", target: "A", weight: 2 }], { itemIds: true });
        expect(topologySignature(g, { ...circular, circularOrder: "weight" })).not.toBe(topologySignature(heavier, { ...circular, circularOrder: "weight" }));
        expect(topologySignature(g)).toBe(topologySignature(heavier));
    });
    it("assigns stable colors independently of filters with dark-surface variants and a neutral bucket", () => {
        const g = graph([{ source: "A", target: "B", weight: 1 }, { source: "B", target: null, weight: 1 }], { groupBlankTargets: true });
        const light = layoutCircularOverview(g);
        expect(light.colors.get(FALLBACK_BUCKET_ID)).toBe("#6b7280");
        expect(light.colors.get("s:A")).toBe(layoutCircularOverview(graph([{ source: "A", target: "C", weight: 1 }])).colors.get("s:A"));
        expect(circularColor("s:A", true)).not.toBe(circularColor("s:A"));
        const colors = Array.from({ length: 100 }, (_, i) => circularColor(`s:node${i}`));
        expect(colors.every(color => /^#[0-9a-f]{6}$/.test(color))).toBe(true);
        expect(new Set(colors).size).toBeGreaterThan(12);
    });
    it("maintains at least 3:1 non-text contrast on light and dark reference surfaces", () => {
        const luminance = (hex: string): number => {
            const rgb = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
                .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
            return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        };
        for (const dark of [false, true]) {
            const background = luminance(dark ? "#292929" : "#ffffff");
            for (let i = 0; i < 1000; i++) {
                const color = luminance(circularColor(`s:node${i}`, dark));
                expect((Math.max(color, background) + 0.05) / (Math.min(color, background) + 0.05)).toBeGreaterThanOrEqual(3);
            }
        }
    });
});
