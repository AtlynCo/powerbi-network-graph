import { describe, expect, it } from "vitest";
import { geometryFingerprint, parseSavedView, SavedView } from "../src/navigation";

const legacy: SavedView = {
    version: 1, focus: "", target: "", mode: "all", search: "", view: "auto",
    centerX: 320, centerY: 320, scale: 1
};
describe("Circular saved views", () => {
    it("retains v1 compatibility and circular snapshots", () => {
        expect(parseSavedView(JSON.stringify(legacy))).toEqual(legacy);
        for (const detail of ["overview", "allItems", "source", "pair"] as const) {
            const state = { ...legacy, circularDetail: detail,
                ...(detail === "source" || detail === "pair" ? { circularSource: "s:A" } : {}),
                ...(detail === "pair" ? { circularTarget: "s:B", circularItem: '["s:B","s:item"]' } : {}) };
            expect(parseSavedView(JSON.stringify(state))).toEqual(state);
        }
    });
    it("rejects malformed or contradictory optional fields", () => {
        for (const fields of [
            { circularDetail: "unknown" }, { circularDetail: ["overview"] }, { mode: ["all"] }, { view: ["auto"] }, { circularDetail: "source" },
            { circularDetail: "pair", circularSource: "s:A" },
            { circularDetail: "overview", circularItem: "item" },
            { circularSource: "s:A" }, { circularDetail: "allItems", circularItem: 4 },
            { circularDetail: "allItems", circularItem: "x".repeat(2049) }
        ]) expect(parseSavedView(JSON.stringify({ ...legacy, ...fields }))).toBeNull();
    });
    it("validates v2 layout, center, geometry and circular detail together", () => {
        const state = {
            ...legacy, version: 2, layout: "radial", root: "s:A",
            geometry: geometryFingerprint("topology"), circularDetail: "pair",
            circularSource: "s:A", circularTarget: "s:B", circularItem: "item"
        };
        expect(parseSavedView(JSON.stringify(state))).toEqual(state);
        for (const fields of [
            { layout: "bad" }, { layout: ["radial"] }, { root: 1 }, { root: "x".repeat(600) },
            { geometry: "" }, { geometry: "z".repeat(32) }, { geometry: 3 },
            { circularTarget: "" }, { scale: 0 }, { centerX: 1000001 }
        ]) expect(parseSavedView(JSON.stringify({ ...state, ...fields }))).toBeNull();
    });
});
