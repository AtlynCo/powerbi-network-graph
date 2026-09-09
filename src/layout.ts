import { Graph, GraphEdge, GraphNode } from "./graph";

export interface Point { x: number; y: number }
export interface Bounds { x: number; y: number; width: number; height: number }
export interface EdgeRoute { path: string; controls: Point[] }
export interface Layout { positions: Map<string, Point>; bounds: Bounds; signature: string; routes: Map<string, EdgeRoute> }

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

// Fixed iteration counts and topology-only input: no random seed, clocks, timers or live simulation.
export function layoutGraph(graph: Graph): Layout {
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
