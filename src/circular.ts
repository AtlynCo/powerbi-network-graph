import { Graph, GraphEdge, GraphItem, GraphItemEdge, GraphNode, summarizeSelfLinks, sumContributions, SelfLinkSummary } from "./graph";
import type { Bounds, EdgeRoute, Layout, Point } from "./layout";
import type { CircularOrder, SelfLinks } from "./settings";

export const CIRCULAR_CENTER: Readonly<Point> = Object.freeze({ x: 320, y: 320 });
export const MAX_STROKE = 9;
export const CIRCULAR_PALETTE = Object.freeze([
    "#0078d4", "#9e1c47", "#657f1b", "#986828", "#0086b3", "#d9631e",
    "#6e44b5", "#b82573", "#1b7f46", "#b2620f", "#d64e45", "#582936"
]);
export interface CircularOptions {
    circularOrder?: CircularOrder;
    hideSelfLinks?: boolean;
    selfLinks?: SelfLinks;
    roleRings?: boolean;
    avoidLabelOverlap?: boolean;
    darkSurface?: boolean;
}
export interface CircularDetailOptions extends CircularOptions {
    focusSource?: string;
    focusPair?: readonly [string, string];
    selectedItemId?: string;
    allItems?: boolean;
}
export interface CircleGuide { cx: number; cy: number; r: number }
export interface CircularLabel extends Point {
    angle: number;
    rotation: number;
    hemisphere: "top" | "bottom" | "left" | "right";
    textAnchor: "middle" | "start" | "end";
}
export interface CircularNodePlacement {
    node: GraphNode;
    point: Point;
    angle: number;
    coreRadius: number;
    haloRadius: number | null;
    sourceStrokeWidth: number;
    isSource: boolean;
    isTarget: boolean;
    isFallbackBucket: boolean;
    label: CircularLabel;
    badgeNumber?: number;
}
export interface CircularBaseLayout extends Layout {
    guide: CircleGuide;
    orderedNodes: GraphNode[];
    nodes: Map<string, CircularNodePlacement>;
    colors: Map<string, string>;
    usesBadges: boolean;
}
export interface CircularOverviewLayout extends CircularBaseLayout {
    renderedEdges: GraphEdge[];
    selfLinks: SelfLinkSummary;
}
export interface CircularItemPlacement {
    item: GraphItem;
    point: Point;
    angle: number;
    coreRadius: number;
    label: CircularLabel;
}
export interface OwnershipTether {
    itemId: string;
    ownerId: string;
    route: EdgeRoute;
    color: string;
    dotted: true;
    muted: boolean;
}
export interface CircularDetailLayout extends CircularBaseLayout {
    innerGuide: CircleGuide;
    visibleItems: GraphItem[];
    itemPositions: Map<string, Point>;
    itemNodes: Map<string, CircularItemPlacement>;
    renderedItemEdges: GraphItemEdge[];
    ownershipTethers: OwnershipTether[];
    strokeMax: number;
}

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const normalizedLabel = (node: GraphNode): string => node.label.normalize("NFKC").trim().toLowerCase();
const alphabetical = (a: GraphNode, b: GraphNode): number =>
    compare(normalizedLabel(a), normalizedLabel(b)) || compare(a.id, b.id);
const angleAt = (index: number, count: number): number => -Math.PI / 2 + 2 * Math.PI * index / Math.max(1, count);
const diagramHideSelfLinks = (options: CircularOptions): boolean => options.hideSelfLinks ?? options.selfLinks !== "show";
const polar = (angle: number, radius: number): Point => ({
    x: CIRCULAR_CENTER.x + Math.cos(angle) * radius,
    y: CIRCULAR_CENTER.y + Math.sin(angle) * radius
});

/** Known incident non-self contributions only. Missing/unweighted amounts never become unit weights. */
export function orderCircularNodes(graph: Graph, order: CircularOrder = "alphabetical"): GraphNode[] {
    const weights = new Map(graph.nodes.map(node => [node.id, [] as number[]]));
    for (const edge of graph.edges) if (edge.source !== edge.target && edge.weight !== null) {
        weights.get(edge.source)?.push(edge.weight);
        weights.get(edge.target)?.push(edge.weight);
    }
    const totals = new Map([...weights].map(([id, values]) => [id, sumContributions(values) ?? (values.length ? Number.MAX_VALUE : 0)]));
    return [...graph.nodes].sort((a, b) =>
        Number(!!a.isFallbackBucket) - Number(!!b.isFallbackBucket) ||
        (order === "weight" ? (totals.get(b.id)! - totals.get(a.id)!) : 0) || alphabetical(a, b));
}

/** FNV-1a slots are independent of the currently filtered set, unlike ordinal host palettes. */
export function circularColor(id: string, darkSurface = false, isFallbackBucket = false): string {
    if (isFallbackBucket) return "#6b7280";
    let hash = 2166136261;
    for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619) >>> 0;
    const slot = hash % 36;
    const base = CIRCULAR_PALETTE[slot % CIRCULAR_PALETTE.length];
    const rgb = [1, 3, 5].map(offset => Number.parseInt(base.slice(offset, offset + 2), 16));
    // Three palette families; lift luminance on dark surfaces without muddying light colors.
    const mix = darkSurface ? 0.38 + Math.floor(slot / 12) * 0.08 : Math.floor(slot / 12) * 0.06;
    return `#${rgb.map(value => Math.round(value + (255 - value) * mix).toString(16).padStart(2, "0")).join("")}`;
}

export function circularSignature(graph: Graph, options: CircularDetailOptions = {}, detail = false): string {
    return JSON.stringify([
        "circular", detail ? "detail" : "overview",
        options.circularOrder ?? "alphabetical", diagramHideSelfLinks(options), options.selfLinks ?? "auto",
        options.roleRings ?? true, options.avoidLabelOverlap ?? true, options.darkSurface ?? false,
        graph.nodes.map(node => [node.id, node.label, !!node.isFallbackBucket]),
        graph.edges.map(edge => [edge.id, edge.source, edge.target, options.circularOrder === "weight" ? edge.weight : null]),
        detail ? [
            options.focusSource ?? null, options.focusPair ?? null, options.selectedItemId ?? null, options.allItems ?? false,
            (graph.items ?? []).map(item => [item.id, item.label, item.ownerId, item.weight]),
            (graph.itemEdges ?? []).map(edge => [edge.id, edge.source, edge.itemId, edge.target, edge.weight])
        ] : null
    ]);
}

function outerLabel(angle: number, radius: number): CircularLabel {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const vertical = Math.abs(dx) < 0.25;
    return {
        ...polar(angle, radius + 34), angle, rotation: 0,
        hemisphere: vertical ? (dy < 0 ? "top" : "bottom") : (dx > 0 ? "right" : "left"),
        textAnchor: vertical ? "middle" : (dx > 0 ? "start" : "end")
    };
}

export function radialItemLabel(point: Point): CircularLabel {
    const angle = Math.atan2(point.y - CIRCULAR_CENTER.y, point.x - CIRCULAR_CENTER.x);
    const degrees = angle * 180 / Math.PI;
    const flip = Math.abs(degrees) > 90;
    return {
        ...polar(angle, Math.max(0, Math.hypot(point.x - 320, point.y - 320) - 15)), angle,
        rotation: flip ? degrees + 180 : degrees,
        hemisphere: Math.cos(angle) < 0 ? "left" : "right", textAnchor: flip ? "start" : "end"
    };
}

function outerNodes(graph: Graph, options: CircularOptions, radius: number, core: number, halo: number,
    activeEdges: readonly { source: string; target: string }[]): CircularBaseLayout {
    const orderedNodes = orderCircularNodes(graph, options.circularOrder);
    const positions = new Map<string, Point>();
    const nodes = new Map<string, CircularNodePlacement>();
    const colors = new Map<string, string>();
    const usesBadges = (options.avoidLabelOverlap ?? true) &&
        (orderedNodes.length > 16 || 2 * Math.PI * radius / Math.max(1, orderedNodes.length) < 34);
    const sources = new Set(activeEdges.map(edge => edge.source));
    const targets = new Set(activeEdges.map(edge => edge.target));
    orderedNodes.forEach((node, index) => {
        const angle = angleAt(index, orderedNodes.length);
        const point = polar(angle, radius);
        const isSource = sources.has(node.id);
        const isTarget = targets.has(node.id);
        positions.set(node.id, point);
        colors.set(node.id, circularColor(node.id, options.darkSurface, node.isFallbackBucket));
        nodes.set(node.id, {
            node, point, angle, coreRadius: core,
            haloRadius: (options.roleRings ?? true) && isTarget ? halo : null,
            sourceStrokeWidth: (options.roleRings ?? true) && isSource ? 3 : 2,
            isSource, isTarget, isFallbackBucket: !!node.isFallbackBucket,
            label: outerLabel(angle, radius), ...(usesBadges ? { badgeNumber: index + 1 } : {})
        });
    });
    return {
        positions, nodes, orderedNodes, colors, usesBadges, guide: { cx: 320, cy: 320, r: radius },
        routes: new Map(), bounds: { x: 0, y: 0, width: 640, height: 640 }, signature: ""
    };
}

function inset(point: Point, toward: Point, radius: number): Point {
    const dx = toward.x - point.x;
    const dy = toward.y - point.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1e-9) return { x: point.x, y: point.y - radius };
    return { x: point.x + dx / distance * radius, y: point.y + dy / distance * radius };
}
function quadratic(source: Point, target: Point, control: Point, ra: number, rb: number): EdgeRoute {
    const start = inset(source, control, ra);
    const end = inset(target, control, rb);
    return { path: `M ${start.x} ${start.y} Q ${control.x} ${control.y}, ${end.x} ${end.y}`, controls: [start, control, end] };
}
function petal(node: CircularNodePlacement, index: number): EdgeRoute {
    const angle = node.angle;
    const relative = (delta: number, radius: number): Point => ({
        x: node.point.x + Math.cos(angle + delta) * radius,
        y: node.point.y + Math.sin(angle + delta) * radius
    });
    const reach = 70 + 16 * Math.log1p(index);
    const start = relative(-0.55, 28);
    const a = relative(-0.65, reach);
    const b = relative(0.65, reach);
    const end = relative(0.55, node.haloRadius === null ? 32 : 38);
    return { path: `M ${start.x} ${start.y} C ${a.x} ${a.y}, ${b.x} ${b.y}, ${end.x} ${end.y}`, controls: [start, a, b, end] };
}

/** Bounds include controls, both rings and finite label extents, so camera fitting cannot clip outward loops. */
function circularBounds(layout: CircularBaseLayout, extraPoints: Point[] = []): Bounds {
    const points: Point[] = [{ x: 0, y: 0 }, { x: 640, y: 640 }, ...extraPoints];
    for (const node of layout.nodes.values()) {
        if (node.badgeNumber) continue;
        const width = Math.min(80, [...node.node.label].length) * 8;
        const start = node.label.textAnchor === "end" ? node.label.x - width :
            node.label.textAnchor === "middle" ? node.label.x - width / 2 : node.label.x;
        points.push({ x: start, y: node.label.y - 16 }, { x: start + width, y: node.label.y + 16 });
    }
    for (const route of layout.routes.values()) points.push(...route.controls);
    const x = Math.min(...points.map(point => point.x)) - 12;
    const y = Math.min(...points.map(point => point.y)) - 12;
    return { x, y, width: Math.max(...points.map(point => point.x)) + 12 - x, height: Math.max(...points.map(point => point.y)) + 12 - y };
}

export function layoutCircularOverview(graph: Graph, options: CircularOptions = {}): CircularOverviewLayout {
    const renderedEdges = graph.edges.filter(edge => !diagramHideSelfLinks(options) || edge.source !== edge.target);
    const layout = outerNodes(graph, options, 245, 19, 24, renderedEdges);
    const peers = new Map<string, GraphEdge[]>();
    for (const edge of renderedEdges) {
        const key = JSON.stringify([edge.source, edge.target].sort(compare));
        if (!peers.has(key)) peers.set(key, []);
        peers.get(key)!.push(edge);
    }
    for (const group of peers.values()) {
        group.sort((a, b) => compare(a.id, b.id));
        group.forEach((edge, index) => {
            const source = layout.nodes.get(edge.source)!;
            const target = layout.nodes.get(edge.target)!;
            if (edge.source === edge.target) {
                layout.routes.set(edge.id, petal(source, index));
                return;
            }
            // Canonical chord orientation separates reciprocal and typed parallel edges consistently.
            const [a, b] = [source.node.id, target.node.id].sort(compare).map(id => layout.positions.get(id)!);
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            const lane = index - (group.length - 1) / 2;
            const offset = group.length === 1 ? 0 : Math.sign(lane) * (14 + 8 * Math.log1p(Math.abs(lane)));
            const control = { x: 320 - (b.y - a.y) / length * offset, y: 320 + (b.x - a.x) / length * offset };
            layout.routes.set(edge.id, quadratic(source.point, target.point, control, 28, target.haloRadius === null ? 32 : 38));
        });
    }
    layout.bounds = circularBounds(layout);
    layout.signature = circularSignature(graph, options);
    return { ...layout, renderedEdges, selfLinks: summarizeSelfLinks(graph) };
}

export function densityStrokeMax(count: number): number {
    return count > 16 ? Math.max(1.5, MAX_STROKE * Math.sqrt(16 / count)) : MAX_STROKE;
}

export function layoutCircularDetail(graph: Graph, options: CircularDetailOptions = {}): CircularDetailLayout {
    // Focus is always directed. Explicit item selection intersects focus rather than broadening native selection.
    const eligible = (graph.itemEdges ?? []).filter(edge =>
        (!diagramHideSelfLinks(options) || edge.source !== edge.target) &&
        (!options.focusSource || edge.source === options.focusSource) &&
        (!options.focusPair || (edge.source === options.focusPair[0] && edge.target === options.focusPair[1])) &&
        (!options.selectedItemId || edge.itemId === options.selectedItemId));
    const relevant = new Set(eligible.map(edge => edge.itemId));
    const orderedNodes = orderCircularNodes(graph, options.circularOrder);
    const ownerIndices = new Map(orderedNodes.filter(node => !node.isFallbackBucket).map((node, index) => [node.id, index]));
    const ownerOrder = (item: GraphItem): number => ownerIndices.get(item.ownerId ?? "") ?? orderedNodes.length;
    const visibleItems = (graph.items ?? []).filter(item => relevant.has(item.id) ||
        item.id === options.selectedItemId || (options.allItems && !options.focusSource && !options.focusPair && !options.selectedItemId))
        .sort((a, b) => ownerOrder(a) - ownerOrder(b) || (b.weight ?? 0) - (a.weight ?? 0) || compare(a.id, b.id));
    const visibleIds = new Set(visibleItems.map(item => item.id));
    const renderedItemEdges = eligible.filter(edge => visibleIds.has(edge.itemId));
    const layout = outerNodes(graph, options, 250, 17, 23, renderedItemEdges);
    const itemPositions = new Map<string, Point>();
    const itemNodes = new Map<string, CircularItemPlacement>();
    const ownershipTethers: OwnershipTether[] = [];
    const labelPoints: Point[] = [];
    visibleItems.forEach((item, index) => {
        const angle = angleAt(index, visibleItems.length);
        const point = polar(angle, 185);
        const label = radialItemLabel(point);
        itemPositions.set(item.id, point);
        itemNodes.set(item.id, { item, point, angle, coreRadius: 10, label });
        const extent = 15 + Math.min(80, [...item.label].length) * 8;
        labelPoints.push(polar(angle, Math.max(0, 185 - extent)), { x: label.x - 16, y: label.y - 16 }, { x: label.x + 16, y: label.y + 16 });
        const owner = item.ownerId ? layout.nodes.get(item.ownerId) : undefined;
        if (owner) {
            const start = inset(owner.point, point, 24);
            const end = inset(point, owner.point, 12);
            ownershipTethers.push({
                itemId: item.id, ownerId: owner.node.id, color: layout.colors.get(owner.node.id)!,
                dotted: true, muted: owner.isFallbackBucket,
                route: { path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`, controls: [start, end] }
            });
        }
    });
    const peers = new Map<string, GraphItemEdge[]>();
    for (const edge of renderedItemEdges) {
        const key = JSON.stringify([edge.source, edge.itemId]);
        if (!peers.has(key)) peers.set(key, []);
        peers.get(key)!.push(edge);
    }
    for (const group of peers.values()) {
        group.sort((a, b) => compare(a.id, b.id));
        group.forEach((edge, index) => {
            const source = layout.positions.get(edge.source)!;
            const target = itemPositions.get(edge.itemId)!;
            const midpoint = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const length = Math.hypot(dx, dy);
            const lane = index - (group.length - 1) / 2;
            const offset = 6 * Math.sign(lane) * Math.log1p(Math.abs(lane));
            // The blended control remains inside the inner ring; arrows always approach items outward.
            const control = { x: 0.65 * 320 + 0.35 * midpoint.x - dy / length * offset, y: 0.65 * 320 + 0.35 * midpoint.y + dx / length * offset };
            const cx = control.x - 320;
            const cy = control.y - 320;
            const scale = Math.min(1, 150 / Math.max(1, Math.hypot(cx, cy)));
            control.x = 320 + cx * scale;
            control.y = 320 + cy * scale;
            layout.routes.set(edge.id, quadratic(source, target, control, 26, 12));
        });
    }
    for (const tether of ownershipTethers) labelPoints.push(...tether.route.controls);
    layout.bounds = circularBounds(layout, labelPoints);
    layout.signature = circularSignature(graph, options, true);
    return {
        ...layout, innerGuide: { cx: 320, cy: 320, r: 185 }, visibleItems, itemPositions, itemNodes,
        renderedItemEdges, ownershipTethers, strokeMax: densityStrokeMax(renderedItemEdges.length)
    };
}
