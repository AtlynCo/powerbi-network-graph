import { FocusMode, LIMITS } from "./graph";

export type ViewPreference = "auto" | "split" | "graph" | "list";
export interface SavedView {
    version: 1;
    focus: string;
    target: string;
    mode: FocusMode;
    search: string;
    view: ViewPreference;
    centerX: number;
    centerY: number;
    scale: number;
    circularDetail?: "overview" | "allItems" | "source" | "pair";
    circularSource?: string;
    circularTarget?: string;
    circularItem?: string;
}

export function parseSavedView(value: string): SavedView | null {
    if (value.length > 4096) return null;
    let state: unknown;
    try { state = JSON.parse(value); } catch (error) {
        if (error instanceof SyntaxError) return null;
        throw error;
    }
    if (!state || typeof state !== "object") return null;
    const field = (key: string): unknown => Reflect.get(state, key);
    const text = (key: string): boolean => typeof field(key) === "string" && String(field(key)).length <= LIMITS.idLength + 2;
    const finite = (key: string): boolean => typeof field(key) === "number" && Number.isFinite(field(key)) && Math.abs(Number(field(key))) <= 1000000;
    if (field("version") !== 1 || !["focus", "target", "search"].every(text) ||
        typeof field("mode") !== "string" || !["all", "neighbors", "incident", "upstream", "downstream", "path"].includes(String(field("mode"))) ||
        typeof field("view") !== "string" || !["auto", "split", "graph", "list"].includes(String(field("view"))) ||
        !["centerX", "centerY", "scale"].every(finite) || Number(field("scale")) < 0.001 || Number(field("scale")) > 8) return null;
    const detail = field("circularDetail");
    if (detail !== undefined && (typeof detail !== "string" || !["overview", "allItems", "source", "pair"].includes(detail))) return null;
    for (const key of ["circularSource", "circularTarget", "circularItem"]) {
        const value = field(key);
        if (value !== undefined && (typeof value !== "string" || !value.length ||
            value.length > (key === "circularItem" ? 2048 : LIMITS.idLength + 2))) return null;
    }
    if ((detail === "source" || detail === "pair") && !field("circularSource")) return null;
    if (detail === "pair" && !field("circularTarget")) return null;
    if (field("circularSource") !== undefined && detail !== "source" && detail !== "pair") return null;
    if (field("circularTarget") !== undefined && detail !== "pair") return null;
    if (field("circularItem") !== undefined && (detail === undefined || detail === "overview")) return null;
    return state as SavedView;
}
