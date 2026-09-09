import { Graph, GraphEdge } from "./graph";

export interface Point { x: number; y: number }
export interface Bounds { x: number; y: number; width: number; height: number }
export interface Layout { positions: Map<string, Point>; bounds: Bounds; signature: string }

export function topologySignature(graph: Graph): string {
    return JSON.stringify([graph.nodes.map(node => node.id), graph.edges.map(edge => [edge.id, edge.source, edge.target])]);
}

// Fixed iterations, sorted topology, and topology-only forces keep highlights and resize from moving entities.
export function layoutGraph(graph: Graph): Layout {
    const positions = new Map<string, Point>();
    const count = graph.nodes.length;
    const radius = Math.max(100, Math.sqrt(count) * 48);
    graph.nodes.forEach((node, i) => positions.set(node.id, {
        x: Math.cos(i * Math.PI * 2 / count) * radius,
        y: Math.sin(i * Math.PI * 2 / count) * radius
    }));
    const points = [...positions.values()];
    const indices = new Map(graph.nodes.map((node, i) => [node.id, i]));
    for (let iteration = 0; iteration < 90; iteration++) {
        const forces = points.map(() => ({ x: 0, y: 0 }));
        for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
                const dx = points[i].x - points[j].x;
                const dy = points[i].y - points[j].y;
                const distance = Math.max(1, Math.hypot(dx, dy));
                const force = Math.min(30, 9000 / (distance * distance));
                forces[i].x += dx / distance * force;
                forces[i].y += dy / distance * force;
                forces[j].x -= dx / distance * force;
                forces[j].y -= dy / distance * force;
            }
        }
        for (const edge of graph.edges) {
            if (edge.source === edge.target) continue;
            const i = indices.get(edge.source)!;
            const j = indices.get(edge.target)!;
            const dx = points[j].x - points[i].x;
            const dy = points[j].y - points[i].y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            const force = (distance - 115) * 0.012;
            forces[i].x += dx / distance * force;
            forces[i].y += dy / distance * force;
            forces[j].x -= dx / distance * force;
            forces[j].y -= dy / distance * force;
        }
        const cooling = 1 - iteration / 100;
        points.forEach((point, i) => {
            point.x = Math.max(-2000, Math.min(2000, point.x + Math.max(-12, Math.min(12, forces[i].x - point.x * 0.004)) * cooling));
            point.y = Math.max(-2000, Math.min(2000, point.y + Math.max(-12, Math.min(12, forces[i].y - point.y * 0.004)) * cooling));
        });
    }
    return {
        positions,
        bounds: layoutBounds(graph, positions),
        signature: topologySignature(graph)
    };
}

export function layoutBounds(graph: Graph, positions: Map<string, Point>): Bounds {
    const coordinates = graph.nodes.map(node => positions.get(node.id)!);
    for (const edge of graph.edges) {
        // Bezier curves lie within their control-point convex hull; include arrows and every loop in fit.
        const numbers = (edgePath(edge, graph, positions).match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) ?? []).map(Number);
        for (let i = 0; i < numbers.length; i += 2) coordinates.push({ x: numbers[i], y: numbers[i + 1] });
    }
    const x = Math.min(0, ...coordinates.map(point => point.x)) - 50;
    const y = Math.min(0, ...coordinates.map(point => point.y)) - 50;
    return {
        x, y,
        width: Math.max(0, ...coordinates.map(point => point.x)) + 420 - x,
        height: Math.max(0, ...coordinates.map(point => point.y)) + 50 - y
    };
}

export function edgePath(edge: GraphEdge, graph: Graph, positions: Map<string, Point>): string {
    const source = positions.get(edge.source)!;
    const target = positions.get(edge.target)!;
    const peers = graph.edges.filter(other => other.source === edge.source && other.target === edge.target);
    const index = peers.findIndex(other => other.id === edge.id);
    if (edge.source === edge.target) {
        const radius = 30 + index * 4;
        // End above the node perimeter so the arrow remains visible.
        return `M ${source.x - 10} ${source.y - 9} C ${source.x - radius * 2} ${source.y - radius * 2}, ${source.x + radius * 2} ${source.y - radius * 2}, ${source.x + 10} ${source.y - 12}`;
    }
    const reciprocal = graph.edges.some(other => other.source === edge.target && other.target === edge.source);
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const offset = reciprocal ? 28 + index * 15 : (index - (peers.length - 1) / 2) * 24;
    const control = { x: (source.x + target.x) / 2 - dy / distance * offset, y: (source.y + target.y) / 2 + dx / distance * offset };
    const startLength = Math.max(1, Math.hypot(control.x - source.x, control.y - source.y));
    const endLength = Math.max(1, Math.hypot(target.x - control.x, target.y - control.y));
    return `M ${source.x + (control.x - source.x) / startLength * 15} ${source.y + (control.y - source.y) / startLength * 15} Q ${control.x} ${control.y}, ${target.x - (target.x - control.x) / endLength * 21} ${target.y - (target.y - control.y) / endLength * 21}`;
}
