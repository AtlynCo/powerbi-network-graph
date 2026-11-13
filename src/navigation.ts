import { FocusMode, LIMITS } from "./graph";
import type { LayoutMode } from "./settings";

export type ViewPreference = "auto" | "split" | "graph" | "list";
interface ViewState {
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
export type SavedView = ViewState & ({ version: 1 } | { version: 2; layout: LayoutMode; root: string; geometry: string });

export function geometryFingerprint(key: string): string {
    const hashes = [2166136261, 2246822507, 3266489909, 668265263];
    for (let i = 0; i < key.length; i++) for (let j = 0; j < hashes.length; j++) {
        hashes[j] = Math.imul(hashes[j] ^ key.charCodeAt(i), 16777619 + j * 2);
    }
    return hashes.map(value => (value >>> 0).toString(16).padStart(8, "0")).join("");
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
    if (![1, 2].includes(Number(field("version"))) || !["focus", "target", "search"].every(text) ||
        typeof field("mode") !== "string" || !["all", "neighbors", "incident", "upstream", "downstream", "path"].includes(String(field("mode"))) ||
        typeof field("view") !== "string" || !["auto", "split", "graph", "list"].includes(String(field("view"))) ||
        !["centerX", "centerY", "scale"].every(finite) || Number(field("scale")) < 0.001 || Number(field("scale")) > 8) return null;
    if (field("version") === 2 && (
        !["force", "circular", "radial"].includes(String(field("layout"))) || typeof field("layout") !== "string" ||
        !text("root") || typeof field("geometry") !== "string" || !/^[a-f0-9]{32}$/.test(String(field("geometry")))
    )) return null;
    if (field("version") !== 1 && field("version") !== 2) return null;
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
