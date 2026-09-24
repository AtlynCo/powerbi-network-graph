import { FocusMode, LIMITS } from "./graph";
import { isLayoutMode, LayoutMode } from "./layout";

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
}
export interface SavedViewV2 extends ViewState {
    version: 2;
    layout: LayoutMode;
    root: string;
    geometry: string;
}
export type SavedView = (ViewState & { version: 1 }) | SavedViewV2;

// A compact camera-compatibility fingerprint, not a security hash. Cache keys remain exact.
export function geometryFingerprint(key: string): string {
    const hashes = [2166136261, 2246822507, 3266489909, 668265263];
    for (let i = 0; i < key.length; i++) for (let j = 0; j < hashes.length; j++) {
        hashes[j] = Math.imul(hashes[j] ^ key.charCodeAt(i), 16777619 + j * 2);
    }
    return hashes.map(value => (value >>> 0).toString(16).padStart(8, "0")).join("");
}

export function encodeSavedView(state: SavedViewV2): string | null {
    const value = JSON.stringify(state);
    return parseSavedView(value) ? value : null;
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
    const text = (value: unknown): value is string => typeof value === "string" && value.length <= LIMITS.idLength + 2;
    const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1000000;
    const version = field("version"), focus = field("focus"), target = field("target"), search = field("search");
    const mode = field("mode"), view = field("view"), centerX = field("centerX"), centerY = field("centerY"), scale = field("scale");
    if (!text(focus) || !text(target) || !text(search) ||
        (mode !== "all" && mode !== "neighbors" && mode !== "incident" && mode !== "upstream" && mode !== "downstream" && mode !== "path") ||
        (view !== "auto" && view !== "split" && view !== "graph" && view !== "list") ||
        !finite(centerX) || !finite(centerY) || !finite(scale) || scale < 0.001 || scale > 8) return null;
    const common: ViewState = { focus, target, search, mode, view, centerX, centerY, scale };
    if (version === 1) return { version, ...common };
    const layout = field("layout"), root = field("root"), geometry = field("geometry");
    if (version !== 2 || !isLayoutMode(layout) || !text(root) || typeof geometry !== "string" || !/^[a-f0-9]{32}$/.test(geometry)) return null;
    return { version, ...common, layout, root, geometry };
}
