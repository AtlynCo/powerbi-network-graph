import { Graph, GraphEdge, GraphNode } from "./graph";

export interface Point { x: number; y: number }
export interface Bounds { x: number; y: number; width: number; height: number }
export interface EdgeRoute { path: string; controls: Point[] }
export type LayoutMode = "force" | "circular" | "radial";
export interface PolarNode { center: Point; radius: number; angle: number; depth: number; root: string }
export interface Layout {
    positions: Map<string, Point>; bounds: Bounds; signature: string; routes: Map<string, EdgeRoute>;
    polar?: Map<string, PolarNode>; root?: string; roots?: string[];
}
export interface ResolvedLayout { mode: LayoutMode; root: string; missingRoot: boolean; key: string }

export function isLayoutMode(value: unknown): value is LayoutMode {
    return value === "force" || value === "circular" || value === "radial";
}

export function topologySignature(graph: Graph): string {
    return JSON.stringify([graph.nodes.map(node => node.id), graph.edges.map(edge => [edge.id, edge.source, edge.target])]);
}

function components(graph: Graph): GraphNode[][] {
    const adjacency = new Map(graph.nodes.map(node => [node.id, new Set<string>()]));
    const nodes = new Map(graph.nodes.map(node => [node.id, node]));
    for (const edge of graph.edges) {
        adjacency.get(edge.source)!.add(edge.target);
        adjacency.get(edge.target)!.add(edge.source);
    }
    const seen = new Set<string>();
    const groups: GraphNode[][] = [];
    for (const node of graph.nodes) {
        if (seen.has(node.id)) continue;
        const queue = [node.id];
        seen.add(node.id);
        for (let i = 0; i < queue.length; i++) {
            for (const id of adjacency.get(queue[i])!) if (!seen.has(id)) { seen.add(id); queue.push(id); }
        }
        groups.push(queue.map(id => nodes.get(id)!).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    }
    return groups;
}

export function layoutGraph(graph: Graph, mode: LayoutMode = "force", root = ""): Layout {
    if (mode === "force") return layoutForceGraph(graph);
    return layoutPolarGraph(graph, resolveLayout(graph, mode, root));
}

// Keep the original force geometry and router unchanged for existing reports.
function layoutForceGraph(graph: Graph): Layout {
    const positions = new Map<string, Point>();
    const groups = components(graph);
    const packed: { nodes: GraphNode[]; positions: Map<string, Point>; bounds: Bounds }[] = [];
    for (const nodes of groups) {
        const count = nodes.length;
        const local = new Map<string, Point>(nodes.map((node, i) => [node.id, {
            x: Math.cos(i * 2.399963229728653) * Math.sqrt(i) * 85,
            y: Math.sin(i * 2.399963229728653) * Math.sqrt(i) * 85
        }]));
        const points = [...local.values()];
        const indices = new Map(nodes.map((node, i) => [node.id, i]));
        const edges = graph.edges.filter(edge => indices.has(edge.source));
        const pairs = new Map<string, [number, number]>();
        for (const edge of edges) {
            if (edge.source === edge.target) continue;
            const i = indices.get(edge.source)!;
            const j = indices.get(edge.target)!;
            pairs.set(JSON.stringify([Math.min(i, j), Math.max(i, j)]), [Math.min(i, j), Math.max(i, j)]);
        }
        const springs = [...pairs.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        for (let iteration = 0; iteration < 120 && count > 1; iteration++) {
            const forces = points.map(() => ({ x: 0, y: 0 }));
            for (let i = 0; i < count; i++) {
                for (let j = i + 1; j < count; j++) {
                    const dx = points[i].x - points[j].x;
                    const dy = points[i].y - points[j].y;
                    const distance = Math.max(0.1, Math.hypot(dx, dy));
                    const force = Math.min(45, 16000 / (distance * distance)) + Math.max(0, 72 - distance) * 0.5;
                    forces[i].x += dx / distance * force;
                    forces[i].y += dy / distance * force;
                    forces[j].x -= dx / distance * force;
                    forces[j].y -= dy / distance * force;
                }
            }
            // Multiple business relationships do not become extra physical springs that collapse their endpoints.
            for (const [i, j] of springs) {
                const dx = points[j].x - points[i].x;
                const dy = points[j].y - points[i].y;
                const distance = Math.max(0.1, Math.hypot(dx, dy));
                const force = (distance - 135) * 0.022;
                forces[i].x += dx / distance * force;
                forces[i].y += dy / distance * force;
                forces[j].x -= dx / distance * force;
                forces[j].y -= dy / distance * force;
            }
            const cooling = 1 - iteration / 145;
            points.forEach((point, i) => {
                point.x += Math.max(-14, Math.min(14, forces[i].x - point.x * 0.004)) * cooling;
                point.y += Math.max(-14, Math.min(14, forces[i].y - point.y * 0.004)) * cooling;
            });
        }
        let nearest = Infinity;
        for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
            nearest = Math.min(nearest, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
        }
        const scale = Number.isFinite(nearest) ? Math.max(1, 72 / Math.max(0.1, nearest)) : 1;
        points.forEach(point => { point.x *= scale; point.y *= scale; });
        packed.push({ nodes, positions: local, bounds: layoutBounds({ ...graph, nodes, edges }, local) });
    }
    const shelfWidth = Math.max(300, Math.sqrt(packed.reduce((sum, group) => sum + (group.bounds.width + 60) * (group.bounds.height + 60), 0)));
    let x = 0;
    let y = 0;
    let height = 0;
    for (const group of packed) {
        if (x > 0 && x + group.bounds.width > shelfWidth) { x = 0; y += height + 60; height = 0; }
        for (const node of group.nodes) {
            const point = group.positions.get(node.id)!;
            positions.set(node.id, { x: point.x - group.bounds.x + x, y: point.y - group.bounds.y + y });
        }
        x += group.bounds.width + 60;
        height = Math.max(height, group.bounds.height);
    }
    const orderedPositions = new Map(graph.nodes.map(node => [node.id, positions.get(node.id)!]));
    const routes = routeGraph(graph, orderedPositions);
    return { positions: orderedPositions, bounds: layoutBounds(graph, orderedPositions, routes), signature: topologySignature(graph), routes };
}

export function routeGraph(graph: Graph, positions: Map<string, Point>): Map<string, EdgeRoute> {
    const peers = new Map<string, GraphEdge[]>();
    for (const edge of graph.edges) {
        const key = JSON.stringify([edge.source, edge.target]);
        if (!peers.has(key)) peers.set(key, []);
        peers.get(key)!.push(edge);
    }
    const routes = new Map<string, EdgeRoute>();
    for (const group of peers.values()) {
        group.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        group.forEach((edge, index) => {
            const source = positions.get(edge.source)!;
            const target = positions.get(edge.target)!;
            if (edge.source === edge.target) {
                const angle = -Math.PI / 2 + (index % 12) * Math.PI / 6;
                const radius = 34 + 8 * Math.log1p(Math.floor(index / 12));
                const polar = (angle: number, radius: number): Point => ({ x: source.x + Math.cos(angle) * radius, y: source.y + Math.sin(angle) * radius });
                const start = polar(angle - 0.48, 15);
                const a = polar(angle - 0.7, radius * 2);
                const b = polar(angle + 0.7, radius * 2);
                const end = polar(angle + 0.48, 19);
                routes.set(edge.id, { path: `M ${start.x} ${start.y} C ${a.x} ${a.y}, ${b.x} ${b.y}, ${end.x} ${end.y}`, controls: [start, a, b, end] });
                return;
            }
            const reciprocal = peers.has(JSON.stringify([edge.target, edge.source]));
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const distance = Math.max(0.1, Math.hypot(dx, dy));
            const lane = index - (group.length - 1) / 2;
            const offset = reciprocal ? 30 + 28 * Math.log1p(index) : Math.sign(lane) * 30 * Math.log1p(Math.abs(lane));
            const control = { x: (source.x + target.x) / 2 - dy / distance * offset, y: (source.y + target.y) / 2 + dx / distance * offset };
            const startLength = Math.max(0.1, Math.hypot(control.x - source.x, control.y - source.y));
            const endLength = Math.max(0.1, Math.hypot(target.x - control.x, target.y - control.y));
            const start = { x: source.x + (control.x - source.x) / startLength * 15, y: source.y + (control.y - source.y) / startLength * 15 };
            const end = { x: target.x - (target.x - control.x) / endLength * 21, y: target.y - (target.y - control.y) / endLength * 21 };
            routes.set(edge.id, { path: `M ${start.x} ${start.y} Q ${control.x} ${control.y}, ${end.x} ${end.y}`, controls: [start, control, end] });
        });
    }
    return routes;
}

export function layoutBounds(graph: Graph, positions: Map<string, Point>, routes = routeGraph(graph, positions), labelSize = 12, showLabels = true): Bounds {
    const coordinates: Point[] = [];
    for (const node of graph.nodes) {
        const point = positions.get(node.id)!;
        const label = showLabels ? 22 + Math.min(26, [...node.label].length + 3) * labelSize * 0.8 : 24;
        coordinates.push({ x: point.x - label, y: point.y - labelSize * 2 - 20 }, { x: point.x + label, y: point.y + labelSize * 2 + 20 });
    }
    for (const edge of graph.edges) coordinates.push(...routes.get(edge.id)!.controls);
    if (!coordinates.length) return { x: -50, y: -50, width: 100, height: 100 };
    const x = Math.min(...coordinates.map(point => point.x)) - 12;
    const y = Math.min(...coordinates.map(point => point.y)) - 12;
    return { x, y, width: Math.max(...coordinates.map(point => point.x)) + 12 - x, height: Math.max(...coordinates.map(point => point.y)) + 12 - y };
}

export function edgePath(edge: GraphEdge, graph: Graph, positions: Map<string, Point>): string {
    return routeGraph(graph, positions).get(edge.id)!.path;
}

const compareId = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const TAU = Math.PI * 2;
const RING_GAP = 96;
const PORT_GAP = 28;
const polarPoint = (center: Point, radius: number, angle: number): Point =>
    ({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
const ringRadius = (count: number): number => count < 2 ? 0 : Math.max(72, 36 / Math.sin(Math.PI / count));

function undirected(graph: Graph): Map<string, Set<string>> {
    const adjacency = new Map(graph.nodes.map(node => [node.id, new Set<string>()]));
    for (const edge of graph.edges) if (edge.source !== edge.target) {
        adjacency.get(edge.source)!.add(edge.target);
        adjacency.get(edge.target)!.add(edge.source);
    }
    return adjacency;
}

function polarComponents(graph: Graph): GraphNode[][] {
    return components(graph).sort((a, b) => b.length - a.length || compareId(a[0].id, b[0].id));
}

function automaticRoot(nodes: GraphNode[], adjacency: Map<string, Set<string>>): string {
    return [...nodes].sort((a, b) => adjacency.get(b.id)!.size - adjacency.get(a.id)!.size || compareId(a.id, b.id))[0]?.id ?? "";
}

export function resolveLayout(graph: Graph, mode: LayoutMode, requestedRoot = ""): ResolvedLayout {
    const missingRoot = mode === "radial" && !!requestedRoot && !graph.nodes.some(node => node.id === requestedRoot);
    const root = mode !== "radial" ? "" : requestedRoot && !missingRoot ? requestedRoot :
        automaticRoot(polarComponents(graph)[0] ?? [], undirected(graph));
    return {
        mode, root, missingRoot,
        key: mode === "force" ? topologySignature(graph) : JSON.stringify(["polar-1", mode, root, topologySignature(graph)])
    };
}

function layoutPolarGraph(graph: Graph, resolved: ResolvedLayout): Layout {
    const positions = new Map<string, Point>();
    const polar = new Map<string, PolarNode>();
    const roots: string[] = [];
    const adjacency = undirected(graph);
    const groups = resolved.mode === "circular" ? [[...graph.nodes].sort((a, b) => compareId(a.id, b.id))] : polarComponents(graph);
    const packed: { nodes: GraphNode[]; bounds: Bounds }[] = [];
    for (const nodes of groups) {
        if (!nodes.length) continue;
        const root = resolved.mode === "circular" ? "" : nodes.some(node => node.id === resolved.root) ? resolved.root : automaticRoot(nodes, adjacency);
        if (root) roots.push(root);
        const depths = new Map<string, number>();
        if (root) {
            depths.set(root, 0);
            const queue = [root];
            for (let i = 0; i < queue.length; i++) for (const next of adjacency.get(queue[i])!) {
                if (depths.has(next)) continue;
                depths.set(next, depths.get(queue[i])! + 1);
                queue.push(next);
            }
        } else for (const node of nodes) depths.set(node.id, 0);
        const levels = new Map<number, GraphNode[]>();
        for (const node of nodes) {
            const depth = depths.get(node.id)!;
            if (!levels.has(depth)) levels.set(depth, []);
            levels.get(depth)!.push(node);
        }
        let radius = 0;
        for (const depth of [...levels.keys()].sort((a, b) => a - b)) {
            const level = levels.get(depth)!;
            radius = depth === 0 ? ringRadius(level.length) : Math.max(radius + RING_GAP, ringRadius(level.length));
            level.forEach((node, index) => {
                const angle = -Math.PI / 2 + TAU * index / level.length;
                const center = { x: 0, y: 0 };
                polar.set(node.id, { center, radius, angle, depth, root });
                positions.set(node.id, polarPoint(center, radius, angle));
            });
        }
        const ids = new Set(nodes.map(node => node.id));
        const localGraph = { ...graph, nodes, edges: graph.edges.filter(edge => ids.has(edge.source)) };
        packed.push({ nodes, bounds: layoutBounds(localGraph, positions, routePolarGraph(localGraph, positions, polar)) });
    }
    if (resolved.mode === "radial") {
        const shelf = Math.max(300, Math.sqrt(packed.reduce((sum, group) => sum + (group.bounds.width + 96) * (group.bounds.height + 96), 0)));
        let x = 0, y = 0, height = 0;
        for (const group of packed) {
            if (x && x + group.bounds.width > shelf) { x = 0; y += height + 96; height = 0; }
            const center = { x: x - group.bounds.x, y: y - group.bounds.y };
            for (const node of group.nodes) {
                const point = positions.get(node.id)!;
                positions.set(node.id, { x: point.x + center.x, y: point.y + center.y });
                polar.get(node.id)!.center = center;
            }
            x += group.bounds.width + 96;
            height = Math.max(height, group.bounds.height);
        }
    }
    const routes = routePolarGraph(graph, positions, polar);
    return { positions, polar, routes, root: resolved.root, roots, signature: resolved.key, bounds: layoutBounds(graph, positions, routes) };
}

// Empty annular corridors avoid ALL glyphs, including nodes hidden by local focus.
// Ports are 28 units from their ring, lanes are >=32; radial ring gaps are >=96.
// Distinct per-ID lanes remain bounded even for 1,000 parallel edges (not a readability promise).
function routePolarGraph(graph: Graph, positions: Map<string, Point>, polar: Map<string, PolarNode>): Map<string, EdgeRoute> {
    const peers = new Map<string, GraphEdge[]>();
    for (const edge of graph.edges) {
        const key = JSON.stringify([edge.source, edge.target].sort(compareId));
        if (!peers.has(key)) peers.set(key, []);
        peers.get(key)!.push(edge);
    }
    const routes = new Map<string, EdgeRoute>();
    for (const group of peers.values()) {
        group.sort((a, b) => compareId(a.id, b.id));
        group.forEach((edge, index) => {
            const a = polar.get(edge.source)!;
            const b = polar.get(edge.target)!;
            const fraction = (index + 1) / (group.length + 1);
            if (edge.source === edge.target) {
                const center = positions.get(edge.source)!;
                const angle = a.angle + index * 2.399963229728653;
                const start = polarPoint(center, 15, angle - 0.55);
                const first = polarPoint(center, 28 + 4 * fraction, angle - 0.8);
                const second = polarPoint(center, 28 + 4 * fraction, angle + 0.8);
                const end = polarPoint(center, 21, angle + 0.55);
                routes.set(edge.id, {
                    path: `M ${start.x} ${start.y} C ${first.x} ${first.y}, ${second.x} ${second.y}, ${end.x} ${end.y}`,
                    controls: [start, first, second, end]
                });
                return;
            }
            const center = a.center;
            const lane = (a.radius === b.radius ? a.radius + 48 : (a.radius + b.radius) / 2) + 32 * (fraction - 0.5);
            const angleA = a.radius ? a.angle : b.angle - 0.35;
            const angleB = b.radius ? b.angle : a.angle + 0.35;
            const signA = Math.sign(lane - a.radius), signB = Math.sign(lane - b.radius);
            const portA = a.radius + signA * PORT_GAP, portB = b.radius + signB * PORT_GAP;
            const turnA = angleA + (8 + 8 * fraction) / portA;
            const turnB = angleB - (8 + 8 * fraction) / portB;
            const start = polarPoint(center, a.radius + signA * 15, angleA);
            const end = polarPoint(center, b.radius + signB * 21, angleB);
            const parts = [`M ${start.x} ${start.y}`];
            const controls = [start];
            const line = (point: Point): void => { parts.push(`L ${point.x} ${point.y}`); controls.push(point); };
            const arc = (radius: number, from: number, to: number): void => {
                const delta = ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
                if (Math.abs(delta) < 1e-12) return;
                const end = polarPoint(center, radius, from + delta);
                parts.push(`A ${radius} ${radius} 0 0 ${delta > 0 ? 1 : 0} ${end.x} ${end.y}`);
                for (let quadrant = 0; quadrant < 4; quadrant++) {
                    const angle = quadrant * Math.PI / 2;
                    const distance = ((delta > 0 ? angle - from : from - angle) % TAU + TAU) % TAU;
                    if (distance <= Math.abs(delta)) controls.push(polarPoint(center, radius, angle));
                }
                controls.push(end);
            };
            line(polarPoint(center, portA, angleA));
            arc(portA, angleA, turnA);
            line(polarPoint(center, lane, turnA));
            arc(lane, turnA, turnB);
            line(polarPoint(center, portB, turnB));
            arc(portB, turnB, angleB);
            line(end);
            routes.set(edge.id, { path: parts.join(" "), controls });
        });
    }
    return routes;
}
