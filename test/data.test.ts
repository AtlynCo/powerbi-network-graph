import { describe, expect, it, vi } from "vitest";
import type powerbi from "powerbi-visuals-api";
import { readData, tooltipValues } from "../src/data";

function category(role: string, values: powerbi.PrimitiveValue[], withIdentity = true): powerbi.DataViewCategoryColumn {
    return {
        source: { displayName: role, queryName: `test.${role}`, roles: { [role]: true }, type: { text: true } },
        values,
        identity: withIdentity ? values.map((_, index) => ({ key: `${role}:${index}` } as unknown as powerbi.DataViewScopeIdentity)) : undefined
    };
}
function measure(role: string, values: powerbi.PrimitiveValue[], highlights?: powerbi.PrimitiveValue[]): powerbi.DataViewValueColumn {
    return { source: { displayName: role, roles: { [role]: true }, type: { numeric: true }, format: "0.00" }, values, highlights };
}
function view(categories: powerbi.DataViewCategoryColumn[], values: powerbi.DataViewValueColumn[] = [], partial = false): powerbi.DataView {
    return {
        metadata: { columns: [...categories.map(column => column.source), ...values.map(column => column.source)], ...(partial ? { segment: {} } : {}) },
        categorical: { categories, values: values as powerbi.DataViewValueColumns }
    };
}
function mockHost() {
    const calls: { role: string; index: number }[][] = [];
    return {
        calls,
        host: {
            locale: "en-US",
            createSelectionIdBuilder: vi.fn(() => {
                const parts: { role: string; index: number }[] = [];
                calls.push(parts);
                const builder = {
                    withCategory(column: powerbi.DataViewCategoryColumn, index: number) {
                        parts.push({ role: column.source.displayName, index });
                        return builder;
                    },
                    createSelectionId: () => ({
                        hasIdentity: () => true, getKey: () => JSON.stringify(parts),
                        includes: () => false
                    })
                };
                return builder;
            })
        } as unknown as powerbi.extensibility.visual.IVisualHost
    };
}

describe("Power BI categorical data adapter", () => {
    it("explains missing bindings instead of using a fallback graph", () => {
        const { host } = mockHost();
        expect(readData(undefined, host).bindingMissing).toBe(true);
        expect(readData(view([]), host).bindingMissing).toBe(true);
        const sourceOnly = readData(view([category("source", ["A"])]), host);
        expect(sourceOnly.bindingMissing).toBe(true);
        expect(sourceOnly.graph.edges).toHaveLength(0);
        expect(sourceOnly.graph.nodes).toHaveLength(0);
        const targetOnly = readData(view([category("target", ["B"])]), host);
        expect(targetOnly.bindingMissing).toBe(true);
        expect(targetOnly.graph.edges).toHaveLength(0);
        expect(targetOnly.graph.nodes).toHaveLength(0);
    });
    it("builds native identities from all grouping roles, never measure values", () => {
        const { host, calls } = mockHost();
        const data = readData(view([
            category("source", ["A", "A"]), category("target", ["B", "B"]),
            category("relationshipType", ["uses", "uses"]), category("edgeId", ["e", "e"])
        ], [measure("weight", [0, 2])]), host);
        expect(calls).toEqual([0, 1].map(index => ["source", "target", "relationshipType", "edgeId"].map(role => ({ role, index }))));
        expect(data.identities.size).toBe(2);
        expect(data.identityMissing).toBe(false);
        expect(data.graph.edges[0].rows).toEqual([0, 1]);
        expect(data.graph.edges[0].weight).toBe(2);
        expect(data.weightFormat).toBe("0.00");
    });
    it("does not invent identity for incomplete categories", () => {
        const { host, calls } = mockHost();
        const data = readData(view([category("source", ["A"]), category("target", ["B"], false)]), host);
        expect(data.graph.edges).toHaveLength(1);
        expect(data.identityMissing).toBe(true);
        expect(data.identities.size).toBe(0);
        expect(calls).toHaveLength(0);
    });
    it("flags unequal role arrays as invalid delivered rows rather than inventing endpoints", () => {
        const { host } = mockHost();
        const data = readData(view([category("source", ["A", "B"]), category("target", ["C"])]), host);
        expect(data.graph.edges).toHaveLength(1);
        expect(data.graph.diagnostics.invalidIds).toBe(1);
        expect(data.graph.diagnostics.incomplete).toBe(true);
    });
    it("counts target-only trailing malformed rows as well as source-only ones", () => {
        const { host } = mockHost();
        const data = readData(view([category("source", ["A"]), category("target", ["B", "C", "D"])]), host);
        expect(data.graph.edges).toHaveLength(1);
        expect(data.graph.diagnostics.invalidIds).toBe(2);
        expect(data.identityMissing).toBe(false);
        expect(data.graph.diagnostics.incomplete).toBe(true);
    });
    it("honors metadata.segment without requesting another segment", () => {
        const { host } = mockHost();
        const data = readData(view([category("source", ["A"]), category("target", ["B"])], [], true), host);
        expect(data.graph.diagnostics.incomplete).toBe(true);
        expect(data.graph.weighted).toBe(false);
    });
    it("bounds adapter work and reports the exact delivered excess rows", () => {
        const { host, calls } = mockHost();
        const data = readData(view([category("source", Array(5003).fill("A")), category("target", Array(5003).fill("B"))]), host);
        expect(data.graph.edges[0].rows).toHaveLength(5000);
        expect(data.graph.diagnostics.omittedRows).toBe(3);
        expect(calls).toHaveLength(5000);
    });
    it("detects highlight presence in optional tooltip measures without pruning topology", () => {
        const { host } = mockHost();
        const data = readData(view([category("source", ["A", "B"]), category("target", ["B", "C"])], [measure("tooltips", [3, 4], [0, null])]), host);
        expect(data.graph.hasHighlights).toBe(true);
        expect(data.graph.edges.map(edge => edge.highlighted)).toEqual([true, false]);
        expect(data.graph.edges).toHaveLength(2);
    });
    it("does not add heterogeneous tooltip measures and bounds tooltip columns", () => {
        const { host } = mockHost();
        const data = readData(view(
            [category("source", ["A", "A"]), category("target", ["B", "B"])],
            [measure("tooltips", [2, 7]), ...Array.from({ length: 10 }, () => measure("tooltips", [3, 3]))]
        ), host);
        expect(data.tooltipColumns).toHaveLength(8);
        const items = tooltipValues(data, data.graph.edges[0], "en-US", "Multiple delivered values", "Missing");
        expect(items[0].value).toBe("Multiple delivered values (2)");
        expect(items[1].value).toContain("3");
    });
});
