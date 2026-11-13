import { describe, expect, it } from "vitest";
import { buildGraph, FALLBACK_BUCKET_ID, incidentRows, LIMITS, reachable, stableId, summarizeSelfLinks, type GraphOptions, type InputRow } from "../src/graph";
import { edgePath, layoutGraph, topologySignature } from "../src/layout";

const defaults: GraphOptions = { weighted: false, edgeIds: false, hasHighlights: false, partial: false };
const graph = (rows: Omit<InputRow, "index">[], options: Partial<GraphOptions> = {}) =>
    buildGraph(rows.map((row, index) => ({ ...row, index })), { ...defaults, ...options });

describe("shared item detail contract", () => {
    it("shares an owner-scoped item across sources without changing overview aggregation or diagnosing ambiguity", () => {
        const g = graph([
            { source: "alice", target: "charlie", itemId: "PR #42", weight: 2, highlight: 0 },
            { source: "bob", target: "charlie", itemId: "PR #42", weight: 3 },
            { source: "alice", target: "charlie", itemId: "PR #43", weight: 5 },
            { source: "alice", target: "charlie", itemId: "PR #42", weight: 7 }
        ], { itemIds: true, weighted: true, hasHighlights: true });
        expect(g.diagnostics).toMatchObject({ ambiguousIds: 0, duplicateRows: 2, invalidIds: 0 });
        expect(g.edges).toHaveLength(2);
        expect(g.edges.find(edge => edge.source === "s:alice")).toMatchObject({ rows: [0, 2, 3], weight: 14 });
        expect(g.items).toHaveLength(2);
        const item = g.items!.find(item => item.label === "PR #42")!;
        expect(item).toMatchObject({ ownerId: "s:charlie", ownerConflict: false, rows: [0, 1, 3], weight: 12, highlighted: true, highlightWeight: 0 });
        expect(g.itemEdges).toHaveLength(3);
        expect(g.itemEdges!.find(edge => edge.itemId === item.id && edge.source === "s:alice"))
            .toMatchObject({ rows: [0, 3], weight: 9, target: "s:charlie" });
    });
    it("retains all owners, typed IDs and relationship types with deterministic owner-scoped keys", () => {
        const rows = [
            { source: "A", target: "B", itemId: 42, type: 1 },
            { source: "C", target: "D", itemId: 42, type: "1" },
            { source: "A", target: "B", itemId: "42" },
            { source: "A", target: "B", itemId: 42, type: "other" }
        ];
        const g = graph(rows, { itemIds: true });
        expect(g.items).toHaveLength(3);
        expect(g.items!.filter(item => item.ownerConflict)).toHaveLength(2);
        expect(g.itemEdges).toHaveLength(4);
        expect(g.items!.find(item => item.ownerId === "s:B" && item.ownerConflict)).toMatchObject({ type: "", types: ["1", "other"], rows: [0, 3] });
        expect(graph([...rows].reverse(), { itemIds: true }).items!.map(item => item.id)).toEqual(g.items!.map(item => item.id));
    });
    it.each([null, undefined, "", " \t"])("allows blank item ID %s to contribute only to the overview", itemId => {
        const g = graph([{ source: "A", target: "B", itemId }], { itemIds: true });
        expect(g.edges).toHaveLength(1);
        expect(g.items).toEqual([]);
        expect(g.diagnostics.invalidIds).toBe(0);
    });
    it.each([true, false, {}, [], new Date(), Infinity, NaN, "x".repeat(513)])("diagnoses nonblank invalid item ID %s", itemId => {
        const g = graph([{ source: "A", target: "B", itemId }], { itemIds: true });
        expect(g.diagnostics.invalidIds).toBe(1);
        expect(g.edges).toHaveLength(0);
        expect(g.items).toEqual([]);
    });
    it("keeps edge ID ambiguity unchanged and derives fallback items only from safe edge IDs", () => {
        const rows = [
            { source: "A", target: "B", edgeId: "conflict", itemId: "shared" },
            { source: "C", target: "B", edgeId: "conflict", itemId: "shared" },
            { source: "A", target: "B", edgeId: "safe", itemId: "shared" }
        ];
        for (const itemIds of [false, true]) {
            const g = graph(rows, { edgeIds: true, itemIds });
            expect(g.edges.map(edge => edge.id)).toEqual(["s:safe"]);
            expect(g.diagnostics.ambiguousIds).toBe(1);
            expect(g.items).toHaveLength(1);
            expect(g.items![0]).toMatchObject({ label: itemIds ? "shared" : "safe", rows: [2] });
            expect(g.itemEdges![0].rows).toEqual([2]);
        }
    });
    it("aggregates item highlights, missing amounts and overflow without dropping contributing identities", () => {
        const g = graph([
            { source: "A", target: "B", itemId: "sum", weight: Number.MAX_VALUE, highlight: 0 },
            { source: "C", target: "B", itemId: "sum", weight: Number.MAX_VALUE },
            { source: "A", target: "B", itemId: "sum", weight: null, highlightActive: true }
        ], { itemIds: true, weighted: true, hasHighlights: true });
        expect(g.items![0]).toMatchObject({ weight: null, missingWeight: true, rows: [0, 1, 2], highlighted: true, highlightWeight: 0 });
        expect(g.itemEdges!.find(edge => edge.source === "s:A")).toMatchObject({ weight: Number.MAX_VALUE, missingWeight: true, rows: [0, 2] });
    });
    it("does not retain item entries from overview edges omitted by caps", () => {
        const g = graph(Array.from({ length: LIMITS.nodes + 1 }, (_, i) => ({
            source: i, target: i, itemId: i
        })), { itemIds: true });
        expect(g.items).toHaveLength(LIMITS.nodes);
        const keptRows = new Set(g.edges.flatMap(edge => edge.rows));
        expect(g.itemEdges!.every(edge => edge.rows.every(row => keptRows.has(row)))).toBe(true);
    });
});

describe("blank targets, roles and self-link summaries", () => {
    it.each([null, undefined, "", " \t"])("groups only blank target %s into a collision-proof bucket", target => {
        const rows = [{ source: "A", target, itemId: "external" }, { source: "A", target: "External / unknown", itemId: "real" }];
        const g = graph(rows, { groupBlankTargets: true, itemIds: true });
        expect(g.nodes.find(node => node.id === FALLBACK_BUCKET_ID)).toMatchObject({ label: "External / unknown", isFallbackBucket: true, isTarget: true, isSource: false });
        expect(g.nodes.find(node => node.id === "s:External / unknown")?.isFallbackBucket).toBeUndefined();
        expect(g.edges).toHaveLength(2);
        expect(g.items!.find(item => item.label === "external")?.ownerId).toBe(FALLBACK_BUCKET_ID);
        expect(graph(rows).diagnostics.invalidIds).toBe(1);
    });
    it("sanitizes the bucket label and never converts invalid sources or nonblank invalid targets", () => {
        expect(graph([{ source: "A", target: null }], { groupBlankTargets: true, blankTargetLabel: "  Unknown  " }).nodes[0].label).toBe("Unknown");
        expect(graph([{ source: "A", target: null }], { groupBlankTargets: true, blankTargetLabel: "x".repeat(100) }).nodes[0].label).toHaveLength(80);
        expect(graph([{ source: "A", target: null }], { groupBlankTargets: true, blankTargetLabel: " \t" }).nodes[0].label).toBe("External / unknown");
        for (const row of [{ source: null, target: null }, { source: "A", target: false }, { source: "A", target: {} }, { source: "A", target: null, edgeId: null }]) {
            expect(graph([row], { groupBlankTargets: true, edgeIds: true }).diagnostics.invalidIds).toBe(1);
        }
    });
    it("summarizes exactly and stores non-self roles for entities with hidden self-links", () => {
        const g = graph([
            { source: "A", target: "A", weight: 1, type: "x" }, { source: "A", target: "A", weight: 2, type: "x" },
            { source: "A", target: "A", weight: 3, type: "y" }, { source: "A", target: "B", weight: 4 }
        ], { weighted: true });
        expect(summarizeSelfLinks(g)).toEqual({ selfEdgeCount: 2, selfRowCount: 3, selfPairCount: 1, selfWeight: 6, drawnWeight: 4 });
        expect(g.nodes.find(node => node.id === "s:A")).toMatchObject({ isSource: true, isTarget: true, nonSelfSource: true, nonSelfTarget: false, totalWeight: 10, outgoingWeight: 10, incomingWeight: 6 });
        const unweighted = graph([{ source: "A", target: "A" }]);
        expect(summarizeSelfLinks(unweighted).selfWeight).toBeNull();
        const overflow = graph([Number.MAX_VALUE, Number.MAX_VALUE].map(weight => ({ source: "A", target: "A", weight })), { weighted: true });
        expect(summarizeSelfLinks(overflow).selfWeight).toBeNull();
    });
});

describe("typed identity and relationship contract", () => {
    it("keeps finite numbers distinct from strings without silently trimming IDs", () => {
        expect(stableId(12)).toBe("n:12");
        expect(stableId("12")).toBe("s:12");
        expect(stableId(" A ")).toBe("s: A ");
        expect(stableId(0)).toBe("n:0");
        expect(stableId("a".repeat(LIMITS.idLength))).not.toBeNull();
    });
    it.each([null, undefined, true, false, {}, [], new Date(), NaN, Infinity, -Infinity, "", " \t", "a".repeat(513)])("rejects invalid identity %s", value => {
        expect(stableId(value)).toBeNull();
        expect(graph([{ source: value, target: "B" }]).diagnostics.invalidIds).toBe(1);
        expect(graph([{ source: "A", target: value }]).edges).toHaveLength(0);
        expect(graph([{ source: "A", target: "B", edgeId: value }], { edgeIds: true }).edges).toHaveLength(0);
        if (value != null) expect(graph([{ source: "A", target: "B", type: value }]).edges).toHaveLength(0);
    });
    it("preserves loops, cycles, reciprocal and parallel typed relationships", () => {
        const g = graph([
            { source: "A", target: "A" }, { source: "A", target: "B" },
            { source: "B", target: "A" }, { source: "B", target: "C" },
            { source: "C", target: "A" }, { source: "A", target: "B", type: "other" },
            { source: "A", target: "B", type: 1 }, { source: "A", target: "B", type: "1" }
        ]);
        expect(g.edges).toHaveLength(8);
        expect(g.nodes).toHaveLength(3);
        expect(new Set(g.edges.map(edge => edge.id)).size).toBe(8);
        expect(incidentRows(g, "s:A")).toEqual([0, 1, 2, 4, 5, 6, 7]);
    });
    it("unions duplicate row identities and does not concatenate unsafe composite keys", () => {
        const g = graph([
            { source: "a|b", target: "c" }, { source: "a", target: "b|c" },
            { source: "a|b", target: "c" }
        ]);
        expect(g.edges).toHaveLength(2);
        expect(g.edges.find(edge => edge.source === "s:a|b")?.rows).toEqual([0, 2]);
        expect(g.diagnostics.duplicateRows).toBe(1);
    });
    it("removes every contribution of conflicting edge IDs, regardless of ordering", () => {
        const rows = [
            { source: "A", target: "B", edgeId: "conflict" },
            { source: "A", target: "C", edgeId: "conflict" },
            { source: "A", target: "B", edgeId: "conflict" },
            { source: "D", target: "D", edgeId: "safe" }
        ];
        for (const input of [rows, [...rows].reverse()]) {
            const g = graph(input, { edgeIds: true });
            expect(g.edges.map(edge => edge.id)).toEqual(["s:safe"]);
            expect(g.nodes.map(node => node.label)).toEqual(["D"]);
            expect(g.diagnostics.ambiguousIds).toBe(1);
            expect(g.diagnostics.incomplete).toBe(true);
        }
    });
    it("treats topology/type conflicts as ambiguous but allows distinct edge IDs", () => {
        expect(graph([
            { source: "A", target: "B", edgeId: 1, type: "x" },
            { source: "A", target: "B", edgeId: 1, type: "y" }
        ], { edgeIds: true }).edges).toHaveLength(0);
        expect(graph([
            { source: "A", target: "B", edgeId: 1 },
            { source: "A", target: "B", edgeId: "1" }
        ], { edgeIds: true }).edges).toHaveLength(2);
    });
});

describe("weight and partial-data semantics", () => {
    it("retains unweighted relationships without inventing a unit weight", () => {
        const g = graph([{ source: "A", target: "B" }]);
        expect(g.weighted).toBe(false);
        expect(g.edges[0].weight).toBeNull();
        expect(g.diagnostics.missingWeights).toBe(0);
    });
    it("preserves zero and aggregates only finite nonnegative numeric weights", () => {
        const g = graph([0, 2, null, undefined, "3", -1, Infinity, NaN].map(weight => ({ source: "A", target: "B", weight })), { weighted: true });
        expect(g.edges[0].weight).toBe(2);
        expect(g.edges[0].missingWeight).toBe(true);
        expect(g.diagnostics.missingWeights).toBe(6);
        expect(graph([{ source: "A", target: "B", weight: 0 }], { weighted: true }).edges[0].weight).toBe(0);
        expect(graph([{ source: "A", target: "B" }], { weighted: true }).edges[0].weight).toBeNull();
    });
    it("never emits infinite aggregated weights and retains all rows", () => {
        const g = graph([Number.MAX_VALUE, Number.MAX_VALUE].map(weight => ({ source: "A", target: "B", weight })), { weighted: true });
        expect(g.edges[0].weight).toBeNull();
        expect(g.edges[0].weightOverflow).toBe(true);
        expect(g.edges[0].missingWeight).toBe(true);
        expect(g.edges[0].rows).toEqual([0, 1]);
    });
    it("zero-valued highlights remain highlighted and do not alter full topology", () => {
        const g = graph([{ source: "A", target: "B", highlight: 0 }, { source: "B", target: "C", highlight: null }], { hasHighlights: true });
        expect(g.edges[0].highlighted).toBe(true);
        expect(g.edges[0].highlightWeight).toBe(0);
        expect(g.edges[1].highlighted).toBe(false);
        expect(g.nodes).toHaveLength(3);
        expect(g.hasHighlights).toBe(true);
    });
    it("discloses partial segments and invalid/omitted topology", () => {
        expect(graph([], { partial: true }).diagnostics.incomplete).toBe(true);
        expect(graph([{ source: false, target: "A" }]).diagnostics.incomplete).toBe(true);
        expect(graph([]).diagnostics.incomplete).toBe(false);
    });
});

describe("bounded topology and traversal", () => {
    it("caps input rows and counts omitted rows exactly", () => {
        const g = graph(Array.from({ length: LIMITS.rows + 3 }, () => ({ source: "A", target: "A" })));
        expect(g.edges[0].rows).toHaveLength(LIMITS.rows);
        expect(g.diagnostics.omittedRows).toBe(3);
        expect(g.diagnostics.incomplete).toBe(true);
    });
    it("allows the 250th unique self-loop node, rejecting only excess topology", () => {
        const g = graph(Array.from({ length: LIMITS.nodes + 1 }, (_, i) => ({ source: String(i).padStart(3, "0"), target: String(i).padStart(3, "0") })));
        expect(g.nodes).toHaveLength(250);
        expect(g.edges).toHaveLength(250);
        expect(g.diagnostics.omittedEdges).toBe(1);
    });
    it("never retains edges with omitted endpoints", () => {
        const g = graph(Array.from({ length: 260 }, (_, i) => ({ source: `node${i}`, target: `node${i + 1}` })));
        const ids = new Set(g.nodes.map(node => node.id));
        expect(g.nodes.length).toBeLessThanOrEqual(250);
        expect(g.edges.every(edge => ids.has(edge.source) && ids.has(edge.target))).toBe(true);
    });
    it("retains exactly 1000 parallel self-loops at the edge bound", () => {
        const g = graph(Array.from({ length: LIMITS.edges + 1 }, (_, i) => ({ source: "A", target: "A", edgeId: i })), { edgeIds: true });
        expect(g.nodes).toHaveLength(1);
        expect(g.edges).toHaveLength(1000);
        expect(g.diagnostics.omittedEdges).toBe(1);
    });
    it("uses cycle-safe directional BFS and one-hop neighbors", () => {
        const g = graph([
            { source: "A", target: "B" }, { source: "B", target: "C" },
            { source: "C", target: "A" }, { source: "C", target: "D" },
            { source: "Z", target: "A" }, { source: "X", target: "X" }
        ]);
        expect([...reachable(g, "s:A", "neighbors")].sort()).toEqual(["s:A", "s:B", "s:C", "s:Z"]);
        expect([...reachable(g, "s:A", "downstream")].sort()).toEqual(["s:A", "s:B", "s:C", "s:D"]);
        expect([...reachable(g, "s:A", "upstream")].sort()).toEqual(["s:A", "s:B", "s:C", "s:Z"]);
        expect(reachable(g, "s:A", "all").size).toBe(6);
        expect(reachable(g, "missing", "neighbors").size).toBe(0);
        expect(incidentRows(g, "missing")).toEqual([]);
    });
});

describe("deterministic topology-only layout", () => {
    const rows = [
        { source: "A", target: "A", edgeId: "loop1" }, { source: "A", target: "A", edgeId: "loop2" },
        { source: "A", target: "B", edgeId: "ab" }, { source: "B", target: "A", edgeId: "ba" },
        { source: "B", target: "C", edgeId: "bc" }, { source: "C", target: "A", edgeId: "ca" }
    ];
    it("reorder, resize-independent calls, weight and highlight changes preserve positions", () => {
        const a = graph(rows, { edgeIds: true });
        const b = graph([...rows].reverse().map((row, i) => ({ ...row, weight: i, highlight: i % 2 ? 0 : null })), { edgeIds: true, weighted: true, hasHighlights: true });
        expect(topologySignature(a)).toBe(topologySignature(b));
        expect(layoutGraph(a)).toEqual(layoutGraph(b));
        expect(layoutGraph(a)).toEqual(layoutGraph(a));
    });
    it("all geometry is finite and fit bounds include every loop/control point", () => {
        const g = graph(rows, { edgeIds: true });
        const layout = layoutGraph(g);
        const paths = g.edges.map(edge => edgePath(edge, g, layout.positions));
        expect(new Set(paths).size).toBe(g.edges.length);
        expect(paths.filter(path => path.includes(" C "))).toHaveLength(2);
        for (const path of paths) {
            expect(path).not.toMatch(/NaN|Infinity/);
            const numbers = path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number);
            for (let i = 0; i < numbers.length; i += 2) {
                expect(numbers[i]).toBeGreaterThanOrEqual(layout.bounds.x);
                expect(numbers[i]).toBeLessThanOrEqual(layout.bounds.x + layout.bounds.width);
                expect(numbers[i + 1]).toBeGreaterThanOrEqual(layout.bounds.y);
                expect(numbers[i + 1]).toBeLessThanOrEqual(layout.bounds.y + layout.bounds.height);
            }
        }
    });
    it("empty and maximum-node graphs have valid finite geometry", () => {
        for (const g of [graph([]), graph(Array.from({ length: 250 }, (_, i) => ({ source: i, target: i })))]) {
            const result = layoutGraph(g);
            expect([...result.positions.values()].every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
            expect(result.bounds.width).toBeGreaterThan(0);
            expect(result.bounds.height).toBeGreaterThan(0);
        }
    });
});
