import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type powerbi from "powerbi-visuals-api";
import { readData } from "../src/data";
import { buildGraph, indexGraph, reachable, shortestPath, type GraphOptions, type InputRow } from "../src/graph";
import { layoutGraph } from "../src/layout";
import { parseSavedView } from "../src/navigation";

const options: GraphOptions = { edgeIds: true, weighted: true, partial: false, hasHighlights: false };
const make = (rows: Omit<InputRow, "index">[]) => buildGraph(rows.map((row, index) => ({ ...row, index })), options);

describe("release independent topology oracles", () => {
    it("matches a hand-audited cyclic, reciprocal, loop, parallel and disconnected fixture", () => {
        const graph = make([
            { source: "A", target: "B", edgeId: "01", weight: 2 },
            { source: "A", target: "B", edgeId: "01", weight: 3 },
            { source: "A", target: "B", edgeId: "02", weight: 0 },
            { source: "B", target: "A", edgeId: "03", weight: 4 },
            { source: "B", target: "C", edgeId: "04", weight: 5 },
            { source: "C", target: "C", edgeId: "05", weight: 6 },
            { source: "D", target: "A", edgeId: "06", weight: 7 },
            { source: "X", target: "Y", edgeId: "07", weight: 8 }
        ]);
        expect(graph.edges.map(edge => [edge.id, edge.source, edge.target, edge.rows, edge.weight])).toEqual([
            ["s:01", "s:A", "s:B", [0, 1], 5], ["s:02", "s:A", "s:B", [2], 0],
            ["s:03", "s:B", "s:A", [3], 4], ["s:04", "s:B", "s:C", [4], 5],
            ["s:05", "s:C", "s:C", [5], 6], ["s:06", "s:D", "s:A", [6], 7],
            ["s:07", "s:X", "s:Y", [7], 8]
        ]);
        expect([...reachable(graph, "s:A", "upstream")].sort()).toEqual(["s:A", "s:B", "s:D"]);
        expect([...reachable(graph, "s:A", "downstream")].sort()).toEqual(["s:A", "s:B", "s:C"]);
        expect([...reachable(graph, "s:A", "incident")].sort()).toEqual(["s:A", "s:B", "s:D"]);
        expect(shortestPath(graph, "s:D", "s:C")).toEqual({ nodes: ["s:D", "s:A", "s:B", "s:C"], edges: ["s:06", "s:01", "s:04"] });
        expect(shortestPath(graph, "s:A", "s:X")).toEqual({ nodes: [], edges: [] });
        expect(shortestPath(graph, "s:A", "s:A")).toEqual({ nodes: ["s:A"], edges: [] });
        expect(indexGraph(graph).incident.get("s:C")).toEqual([4, 5]);
    });

    it("agrees with an independent all-pairs distance matrix, not another call to BFS", () => {
        const count = 16;
        let seed = 0xA71A2026;
        const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        const rows = Array.from({ length: count }, (_, id) => ({ source: id, target: id, edgeId: `loop-${id}`, weight: 1 }));
        const distances = Array.from({ length: count }, (_, i) => Array.from({ length: count }, (_, j) => i === j ? 0 : Infinity));
        for (let i = 0; i < count; i++) for (let j = 0; j < count; j++) {
            if (i !== j && random() < 0.12) {
                rows.push({ source: i, target: j, edgeId: `${i}-${j}`, weight: 1 });
                distances[i][j] = 1;
            }
        }
        for (let k = 0; k < count; k++) for (let i = 0; i < count; i++) for (let j = 0; j < count; j++) {
            distances[i][j] = Math.min(distances[i][j], distances[i][k] + distances[k][j]);
        }
        const graph = make(rows);
        for (let i = 0; i < count; i++) {
            const expected = distances[i].flatMap((distance, j) => Number.isFinite(distance) ? [`n:${j}`] : []).sort();
            expect([...reachable(graph, `n:${i}`, "downstream")].sort()).toEqual(expected);
            for (let j = 0; j < count; j++) {
                const path = shortestPath(graph, `n:${i}`, `n:${j}`);
                if (!Number.isFinite(distances[i][j])) { expect(path.nodes).toEqual([]); continue; }
                expect(path.edges.length).toBe(distances[i][j]);
                expect(path.nodes[0]).toBe(`n:${i}`);
                expect(path.nodes.at(-1)).toBe(`n:${j}`);
                path.edges.forEach((id, index) => {
                    const delivered = rows.find(row => `s:${row.edgeId}` === id)!;
                    expect([path.nodes[index], path.nodes[index + 1]]).toEqual([`n:${delivered.source}`, `n:${delivered.target}`]);
                });
            }
        }
    });

    it("breaks equal-length directed path ties by relationship ID, not target-node name, input order or weight", () => {
        const rows = [
            { source: "A", target: "B", edgeId: "11", weight: 0 },
            { source: "B", target: "D", edgeId: "21", weight: 0 },
            { source: "C", target: "D", edgeId: "30", weight: 9000 },
            { source: "A", target: "C", edgeId: "00", weight: 9000 },
            { source: "A", target: "A", edgeId: "loop", weight: 0 }
        ];
        for (const ordered of [rows, [...rows].reverse()]) {
            expect(shortestPath(make(ordered), "s:A", "s:D")).toEqual({ nodes: ["s:A", "s:C", "s:D"], edges: ["s:00", "s:30"] });
            expect(shortestPath(make(ordered), "s:D", "s:A")).toEqual({ nodes: [], edges: [] });
        }
        expect(shortestPath(make([...rows, { source: "A", target: "D", edgeId: "99", weight: 1e100 }]), "s:A", "s:D"))
            .toEqual({ nodes: ["s:A", "s:D"], edges: ["s:99"] });
    });

    it("matches an exact integer-sum oracle through contribution permutations and fails the whole overflowing sum", () => {
        const weights = [10000000000000000, 1, 1, 0];
        const exact = Number(10000000000000000n + 1n + 1n);
        for (const values of [weights, [...weights].reverse(), [1, 10000000000000000, 0, 1]]) {
            const graph = make(values.map(weight => ({ source: "A", target: "B", edgeId: "sum", weight })));
            expect(graph.edges[0].weight).toBe(exact);
            expect(graph.edges[0].rows).toEqual([0, 1, 2, 3]);
            expect(graph.edges[0].missingWeight).toBe(false);
        }
        for (const values of [[Number.MAX_VALUE, 0, Number.MAX_VALUE], [0, Number.MAX_VALUE, Number.MAX_VALUE]]) {
            const graph = make(values.map(weight => ({ source: "A", target: "B", edgeId: "sum", weight })));
            expect(graph.edges[0].weight).toBeNull();
            expect(graph.edges[0].weightOverflow).toBe(true);
            expect(graph.edges[0].missingWeight).toBe(true);
            expect(graph.edges[0].rows).toEqual([0, 1, 2]);
        }
    });

    it("retains all 5000 row identities at simultaneous 250-node / 1000-edge limits", () => {
        const edges = Array.from({ length: 1000 }, (_, i) => {
            const n = i % 250;
            const group = Math.floor(i / 250);
            return { source: group === 2 ? (n + 1) % 250 : n, target: group === 0 || group === 2 ? n : (n + 1) % 250, edgeId: `E${String(i).padStart(4, "0")}`, weight: 2 };
        });
        const graph = make(Array.from({ length: 5 }, () => edges).flat());
        expect(graph.nodes).toHaveLength(250);
        expect(graph.edges).toHaveLength(1000);
        expect(graph.diagnostics).toEqual({ invalidIds: 0, duplicateRows: 4000, ambiguousIds: 0, missingWeights: 0, omittedRows: 0, omittedEdges: 0, incomplete: false });
        graph.edges.forEach((edge, i) => {
            expect(edge.rows).toEqual([i, i + 1000, i + 2000, i + 3000, i + 4000]);
            expect(edge.weight).toBe(10);
        });
        expect(new Set(graph.edges.flatMap(edge => edge.rows)).size).toBe(5000);
        expect(graph.edges.filter(edge => edge.source === edge.target)).toHaveLength(250);
        expect([...reachable(graph, "n:0", "downstream")]).toHaveLength(250);
    });
});

describe("release independent geometry invariants", () => {
    it.each(["loop", "parallel", "reciprocal"])("keeps all 1000 %s edge IDs routed without geometry caps", kind => {
        const graph = make(Array.from({ length: 1000 }, (_, index) => ({
            source: kind === "reciprocal" && index % 2 ? "B" : "A",
            target: kind === "loop" || (kind === "reciprocal" && index % 2) ? "A" : "B",
            edgeId: String(index).padStart(4, "0"), weight: 1
        })));
        const layout = layoutGraph(graph);
        const paths = [...layout.routes.values()].map(route => route.path);
        expect(layout.routes.size).toBe(1000);
        expect(new Set(paths).size).toBe(1000);
        expect(paths.every(value => !/NaN|Infinity/.test(value))).toBe(true);
        for (const edge of graph.edges) {
            const route = layout.routes.get(edge.id)!;
            const from = layout.positions.get(edge.source)!;
            const to = layout.positions.get(edge.target)!;
            expect(Math.hypot(route.controls[0].x - from.x, route.controls[0].y - from.y)).toBeCloseTo(15, 7);
            expect(Math.hypot(route.controls.at(-1)!.x - to.x, route.controls.at(-1)!.y - to.y)).toBeCloseTo(kind === "loop" ? 19 : 21, 7);
            for (const point of route.controls) {
                expect(point.x).toBeGreaterThanOrEqual(layout.bounds.x);
                expect(point.y).toBeGreaterThanOrEqual(layout.bounds.y);
                expect(point.x).toBeLessThanOrEqual(layout.bounds.x + layout.bounds.width);
                expect(point.y).toBeLessThanOrEqual(layout.bounds.y + layout.bounds.height);
            }
        }
    });

    it("separates every pair of maximum-graph node centers by at least 72 layout units", () => {
        const graph = make(Array.from({ length: 250 }, (_, index) => ({ source: index, target: (index + 1) % 250, edgeId: index, weight: 1 })));
        const points = [...layoutGraph(graph).positions.values()];
        let minimum = Infinity;
        for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
            minimum = Math.min(minimum, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
        }
        expect(minimum).toBeGreaterThanOrEqual(72 - 1e-8);
    });
});

describe("release saved-view boundary contract", () => {
    const valid = { version: 1, focus: "s:A", target: "s:B", mode: "path", search: "A", view: "split", centerX: 10, centerY: -30, scale: 0.5 };
    it("round-trips a fixed external bookmark representation without mutating it", () => {
        expect(parseSavedView(JSON.stringify(valid))).toEqual(valid);
    });
    it.each([
        { scale: 0 }, { scale: 9 }, { centerX: null }, { centerY: 1000001 }, { version: 2 },
        { focus: false }, { target: "a".repeat(515) }, { search: "a".repeat(515) }, { mode: "impact" }, { view: "unknown" }
    ])("rejects invalid saved fields %j", fields => {
        expect(parseSavedView(JSON.stringify({ ...valid, ...fields }))).toBeNull();
    });
    it.each(["", "{", "null", "[]", "true", "0", " ".repeat(4097)])("rejects malformed saved state", value => {
        expect(parseSavedView(value)).toBeNull();
    });
});

describe("release nonfabricated highlight values", () => {
    it.each(["unbound", "weight-without-highlights", "zero-weight-highlight"])("separates tooltip highlight state from weight amount: %s", kind => {
        const categories = ["source", "target"].map((role, index) => ({
            source: { displayName: role, roles: { [role]: true }, type: { text: true } },
            values: index === 0 ? ["A", "B"] : ["B", "C"]
        }));
        const values: powerbi.DataViewValueColumn[] = [{
            source: { displayName: "Tooltip measure", roles: { tooltips: true }, type: { numeric: true } },
            values: [90, 80], highlights: [0, null]
        }];
        if (kind !== "unbound") values.push({
            source: { displayName: "Weight", roles: { weight: true }, type: { numeric: true } },
            values: [0, 10], ...(kind === "zero-weight-highlight" ? { highlights: [0, null] } : {})
        });
        const view: powerbi.DataView = {
            metadata: { columns: [...categories.map(column => column.source), ...values.map(column => column.source)] },
            categorical: { categories, values: values as powerbi.DataViewValueColumns }
        };
        const host = { createSelectionIdBuilder() { throw new Error("This data-only fixture intentionally has no native identities"); } } as unknown as powerbi.extensibility.visual.IVisualHost;
        const data = readData(view, host);
        expect(data.graph.edges.map(edge => edge.highlighted)).toEqual([true, false]);
        expect(data.hasWeightHighlights).toBe(kind === "zero-weight-highlight");
        expect(data.graph.edges.map(edge => edge.highlightWeight)).toEqual(kind === "zero-weight-highlight" ? [0, null] : [null, null]);
        expect(data.graph.edges.map(edge => edge.weight)).toEqual(kind === "unbound" ? [null, null] : [0, 10]);
    });
});

describe("release literal certification sample oracles", () => {
    it.each(["Services", "Accounts"])("keeps the independently audited %s contract", name => {
        const contract = JSON.parse(readFileSync(path.join(process.cwd(), "samples", "release", "sample-contract.json"), "utf8")) as {
            domains: { table: string; rows: [string, string, string, string, number | null, number, number][] }[];
        };
        const rows = contract.domains.find(domain => domain.table === name)!.rows;
        const graph = make(rows.map(([source, target, type, edgeId, weight]) => ({ source, target, type, edgeId, weight })));
        if (name === "Services") {
            expect(graph.nodes.map(node => node.label)).toEqual(["Alerts", "Archive", "Backup", "Gateway", "Inventory", "Ledger", "Orders", "Payments"]);
            expect(graph.edges.map(edge => edge.id)).toEqual(Array.from({ length: 14 }, (_, i) => `s:S${String(i + 1).padStart(2, "0")}`));
            expect(graph.diagnostics.incomplete).toBe(false);
            expect(shortestPath(graph, "s:Gateway", "s:Ledger")).toEqual({
                nodes: ["s:Gateway", "s:Orders", "s:Payments", "s:Ledger"], edges: ["s:S01", "s:S02", "s:S03"]
            });
        } else {
            expect(graph.nodes.map(node => node.label)).toEqual(["0001", "0002", "0003", "0004", "0005", "0006"]);
            expect(graph.edges.map(edge => edge.id)).toEqual(Array.from({ length: 13 }, (_, i) => `s:T${String(i + 1).padStart(2, "0")}`));
            expect(graph.diagnostics).toMatchObject({ duplicateRows: 1, ambiguousIds: 1, missingWeights: 2, omittedRows: 0, omittedEdges: 0, incomplete: true });
            expect(graph.edges.find(edge => edge.id === "s:T01")?.rows).toEqual([0, 10]);
            expect(graph.edges.find(edge => edge.id === "s:T01")?.weight).toBe(120);
            expect(graph.edges.find(edge => edge.id === "s:T11")?.weight).toBe(0);
            expect(graph.edges.find(edge => edge.id === "s:T12")?.weight).toBeNull();
            expect(graph.edges.find(edge => edge.id === "s:T13")?.weight).toBeNull();
            expect(indexGraph(graph).incident.get("s:0006")).toEqual([11, 12, 13]);
        }
    });
});
