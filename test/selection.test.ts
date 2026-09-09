import { describe, expect, it } from "vitest";
import type powerbi from "powerbi-visuals-api";
import { relationshipSelection } from "../src/selection";

const id = (key: string, valid = true) => ({
    getKey: () => key, hasIdentity: () => valid
}) as powerbi.visuals.ISelectionId;

describe("complete native relationship identity selection", () => {
    it("unions duplicate native keys without losing distinct rows", () => {
        const a = id("a"), b = id("b");
        expect(relationshipSelection([0, 1, 2, 0], new Map([[0, a], [1, b], [2, a]]))).toEqual({ ok: true, ids: [a, b] });
    });
    it("rejects the entire action if any row has missing/invalid identity", () => {
        expect(relationshipSelection([], new Map())).toEqual({ ok: false, reason: "missing" });
        expect(relationshipSelection([0, 1], new Map([[0, id("a")]]))).toEqual({ ok: false, reason: "missing" });
        expect(relationshipSelection([0], new Map([[0, id("a", false)]]))).toEqual({ ok: false, reason: "missing" });
    });
    it("allows 200 unique identities but never silently truncates 201", () => {
        const identities = new Map(Array.from({ length: 201 }, (_, i) => [i, id(String(i))]));
        expect(relationshipSelection([...identities.keys()].slice(0, 200), identities).ok).toBe(true);
        expect(relationshipSelection([...identities.keys()], identities)).toEqual({ ok: false, reason: "limit" });
    });
    it("applies the cap after deduplication rather than to delivered row count", () => {
        const same = id("same");
        const identities = new Map(Array.from({ length: 500 }, (_, i) => [i, same]));
        expect(relationshipSelection([...identities.keys()], identities)).toEqual({ ok: true, ids: [same] });
    });
});
