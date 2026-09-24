import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildGraph, incidentRows } from "../src/graph";
import { layoutGraph } from "../src/layout";

const fixture = JSON.parse(readFileSync(path.join("test", "fixtures", "microsoft-sankey.json"), "utf8")) as {
    provenance: { workbookSha256: string; workbookBytes: number; sheet: string; commit: string };
    columns: string[];
    rows: [string, string, number][];
};
const graph = () => buildGraph(fixture.rows.map(([source, target, weight], index) => ({ source, target, weight, index })), {
    weighted: true, edgeIds: false, hasHighlights: false, partial: false
});

describe("Microsoft-linked workbook: Sankey Chart relationship path only", () => {
    it("pins the attributed workbook, sheet, fields and exact nine supplied records", () => {
        expect(fixture.provenance.workbookSha256).toBe("c17157c21cb99e1946dedca29e47a8f877fd0aaeadb57d2ba6ee8bcaec2b70e1");
        expect(fixture.provenance.workbookBytes).toBe(236914);
        expect(fixture.provenance.sheet).toBe("Sankey Chart");
        expect(fixture.provenance.commit).toBe("21c5f65b4ee4f9d0a755175b0884c20be949bcb4");
        expect(fixture.columns).toEqual(["Origin City", "Destination City", "Passenger Volume"]);
        expect(fixture.rows).toEqual([
            ["Seattle", "Chicago", 360], ["San Francisco", "Chicago", 765], ["Los Angeles", "Chicago", 1200],
            ["Seattle", "Houston", 420], ["San Francisco", "Houston", 390], ["Los Angeles", "New York", 240],
            ["Seattle", "New York", 1275], ["San Francisco", "Newark", 1470], ["Los Angeles", "Miami", 855]
        ]);
    });
    it("preserves weighted pairs, all row indices and loaded incident groups without invented Edge IDs", () => {
        const result = graph();
        expect(result.nodes.map(node => node.label)).toEqual(["Chicago", "Houston", "Los Angeles", "Miami", "New York", "Newark", "San Francisco", "Seattle"]);
        expect(result.edges).toHaveLength(9);
        expect(result.edges.reduce((sum, edge) => sum + edge.weight!, 0)).toBe(6975);
        fixture.rows.forEach(([source, target, weight], index) => {
            const edge = result.edges.find(edge => edge.source === `s:${source}` && edge.target === `s:${target}`)!;
            expect(edge.weight).toBe(weight);
            expect(edge.rows).toEqual([index]);
            expect(edge.edgeId).toBeUndefined();
        });
        expect(incidentRows(result, "s:Seattle")).toEqual([0, 3, 6]);
        expect(incidentRows(result, "s:Chicago")).toEqual([0, 1, 2]);
        expect(result.diagnostics.incomplete).toBe(false);
    });
    it.each(["force", "circular", "radial"] as const)("renders the unchanged dataset in %s without altering identities", mode => {
        const result = graph();
        const before = JSON.stringify(result);
        const layout = layoutGraph(result, mode);
        expect(layout.positions.size).toBe(8);
        expect(layout.routes.size).toBe(9);
        expect(new Set([...layout.routes.values()].map(route => route.path)).size).toBe(9);
        expect([...layout.positions.values()].every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
        if (mode === "radial") {
            expect(layout.root).toBe("s:Chicago");
            expect(Object.fromEntries([...layout.polar!].map(([id, node]) => [id.slice(2), node.depth]))).toEqual({
                Chicago: 0, Houston: 2, "Los Angeles": 1, Miami: 2, "New York": 2, Newark: 2, "San Francisco": 1, Seattle: 1
            });
        }
        expect(JSON.stringify(result)).toBe(before);
    });
});
