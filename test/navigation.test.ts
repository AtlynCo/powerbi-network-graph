import { describe, expect, it } from "vitest";
import { encodeSavedView, geometryFingerprint, parseSavedView, SavedViewV2 } from "../src/navigation";
import { buildGraph } from "../src/graph";
import { resolveLayout } from "../src/layout";

const valid: SavedViewV2 = {
    version: 2, focus: "s:A", target: "s:B", mode: "neighbors", search: "", view: "split",
    centerX: 0, centerY: 0, scale: 1, layout: "radial", root: "s:A", geometry: geometryFingerprint("example")
};

describe("versioned local state", () => {
    it("round-trips v2, including an unavailable requested center, without truncation", () => {
        expect(parseSavedView(encodeSavedView(valid)!)).toEqual(valid);
        const missing = { ...valid, root: "s:not-loaded" };
        expect(parseSavedView(encodeSavedView(missing)!)).toEqual(missing);
    });
    it("accepts v1 for explicit Force migration without pretending it has a geometry token", () => {
        const legacy = { version: 1, focus: "s:A", target: "s:B", mode: "all", search: "", view: "auto", centerX: 50, centerY: 100, scale: 0.2 };
        expect(parseSavedView(JSON.stringify(legacy))).toEqual(legacy);
    });
    it("enforces the encoded 4,096-character boundary in both directions", () => {
        const encoded = encodeSavedView(valid)!;
        expect(parseSavedView(encoded + " ".repeat(4096 - encoded.length))).toEqual(valid);
        expect(parseSavedView(encoded + " ".repeat(4097 - encoded.length))).toBeNull();
        expect(encodeSavedView({ ...valid, focus: "\u0001".repeat(512), target: "\u0002".repeat(512), root: "\u0003".repeat(512) })).toBeNull();
    });
    it.each([
        { version: 3 }, { layout: "chord" }, { root: null }, { root: "s:".repeat(258) },
        { geometry: "" }, { geometry: "a".repeat(33) }, { scale: Infinity }, { centerX: NaN }, { search: "a".repeat(515) }
    ])("rejects invalid state %j", patch => {
        expect(parseSavedView(JSON.stringify({ ...valid, ...patch }))).toBeNull();
    });
    it("keys geometry by effective mode/root/topology, not weights, highlights or a missing request", () => {
        const graph = buildGraph([{ source: "A", target: "B", index: 0 }], { weighted: false, edgeIds: false, hasHighlights: false, partial: false });
        const keys = ["force", "circular", "radial"].map(mode => resolveLayout(graph, mode === "force" ? "force" : mode === "circular" ? "circular" : "radial").key);
        expect(new Set(keys.map(geometryFingerprint)).size).toBe(3);
        expect(resolveLayout(graph, "radial", "missing").key).toBe(resolveLayout(graph, "radial").key);
        expect(geometryFingerprint(resolveLayout(graph, "radial", "s:B").key)).not.toBe(geometryFingerprint(resolveLayout(graph, "radial", "s:A").key));
        graph.edges[0].weight = 999;
        graph.edges[0].highlighted = true;
        expect(resolveLayout(graph, "force").key).toBe(keys[0]);
    });
});
