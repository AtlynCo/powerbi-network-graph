import powerbi from "powerbi-visuals-api";
import { LIMITS } from "./graph";

export type SelectionResult =
    { ok: true; ids: powerbi.visuals.ISelectionId[] } |
    { ok: false; reason: "missing" | "limit" };

export function relationshipSelection(rows: readonly number[], identities: ReadonlyMap<number, powerbi.visuals.ISelectionId>): SelectionResult {
    const unique = new Map<string, powerbi.visuals.ISelectionId>();
    if (rows.length === 0) return { ok: false, reason: "missing" };
    for (const row of rows) {
        const identity = identities.get(row);
        if (!identity || !identity.hasIdentity()) return { ok: false, reason: "missing" };
        unique.set(identity.getKey(), identity);
    }
    if (unique.size > LIMITS.selection) return { ok: false, reason: "limit" };
    return { ok: true, ids: [...unique.values()] };
}
