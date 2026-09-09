export const LIMITS = Object.freeze({ rows: 5000, nodes: 250, edges: 1000, idLength: 512, selection: 200 });

export interface InputRow {
    source: unknown;
    target: unknown;
    type?: unknown;
    edgeId?: unknown;
    weight?: unknown;
    highlight?: unknown;
    index: number;
}

export interface GraphNode { id: string; label: string }
export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: string;
    label: string;
    edgeId?: string;
    rows: number[];
    weight: number | null;
    missingWeight: boolean;
    highlighted: boolean;
    highlightWeight: number | null;
}
export interface Diagnostics {
    invalidIds: number;
    duplicateRows: number;
    ambiguousIds: number;
    missingWeights: number;
    omittedRows: number;
    omittedEdges: number;
    incomplete: boolean;
}
export interface Graph {
    nodes: GraphNode[];
    edges: GraphEdge[];
    diagnostics: Diagnostics;
    hasHighlights: boolean;
    weighted: boolean;
}
export interface GraphOptions { weighted: boolean; edgeIds: boolean; hasHighlights: boolean; partial: boolean }

export function stableId(value: unknown): string | null {
    if (typeof value === "string" && value.trim().length > 0 && value.length <= LIMITS.idLength) {
        return `s:${value}`;
    }
    if (typeof value === "number" && Number.isFinite(value)) return `n:${value}`;
    return null;
}

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const numericWeight = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0;

export function buildGraph(rows: readonly InputRow[], options: GraphOptions): Graph {
    const diagnostics: Diagnostics = {
        invalidIds: 0, duplicateRows: 0, ambiguousIds: 0, missingWeights: 0,
        omittedRows: Math.max(0, rows.length - LIMITS.rows), omittedEdges: 0,
        incomplete: options.partial || rows.length > LIMITS.rows
    };
    const groups = new Map<string, GraphEdge>();
    const nodes = new Map<string, GraphNode>();
    const ambiguous = new Set<string>();
    for (const row of rows.slice(0, LIMITS.rows)) {
        const source = stableId(row.source);
        const target = stableId(row.target);
        const edgeId = options.edgeIds ? stableId(row.edgeId) : null;
        const typeId = row.type == null ? "" : stableId(row.type);
        if (!source || !target || (options.edgeIds && !edgeId) || typeId === null) {
            diagnostics.invalidIds++;
            continue;
        }
        const type = row.type == null ? "" : String(row.type);
        const topology = JSON.stringify([source, target, typeId]);
        const id = edgeId ?? topology;
        const previous = groups.get(id);
        if (previous && previous.label !== topology) {
            ambiguous.add(id);
            continue;
        }
        nodes.set(source, { id: source, label: String(row.source) });
        nodes.set(target, { id: target, label: String(row.target) });
        const edge: GraphEdge = previous ?? {
            id, source, target, type, label: topology, edgeId: options.edgeIds ? String(row.edgeId) : undefined, rows: [], weight: null,
            missingWeight: false, highlighted: false, highlightWeight: null
        };
        if (previous) diagnostics.duplicateRows++;
        edge.rows.push(row.index);
        if (options.weighted) {
            if (numericWeight(row.weight) && Number.isFinite((edge.weight ?? 0) + row.weight)) {
                edge.weight = (edge.weight ?? 0) + row.weight;
            } else {
                edge.missingWeight = true;
                diagnostics.missingWeights++;
            }
        }
        if (row.highlight !== null && row.highlight !== undefined) edge.highlighted = true;
        if (numericWeight(row.highlight) && Number.isFinite((edge.highlightWeight ?? 0) + row.highlight)) {
            edge.highlightWeight = (edge.highlightWeight ?? 0) + row.highlight;
        }
        groups.set(id, edge);
    }
    diagnostics.ambiguousIds = ambiguous.size;
    for (const id of ambiguous) groups.delete(id);
    const keptNodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    for (const edge of [...groups.values()].sort((a, b) => compare(a.id, b.id))) {
        const newIds = [...new Set([edge.source, edge.target])].filter(id => !keptNodes.has(id));
        if (edges.length >= LIMITS.edges || keptNodes.size + newIds.length > LIMITS.nodes) {
            diagnostics.omittedEdges++;
            continue;
        }
        edges.push(edge);
        for (const id of newIds) keptNodes.set(id, nodes.get(id)!);
    }
    diagnostics.incomplete ||= diagnostics.invalidIds > 0 || diagnostics.ambiguousIds > 0 || diagnostics.omittedEdges > 0;
    return {
        nodes: [...keptNodes.values()].sort((a, b) => compare(a.id, b.id)),
        edges, diagnostics, hasHighlights: options.hasHighlights, weighted: options.weighted
    };
}

export type FocusMode = "all" | "neighbors" | "upstream" | "downstream";

export function reachable(graph: Graph, start: string, mode: FocusMode): Set<string> {
    if (mode === "all") return new Set(graph.nodes.map(node => node.id));
    if (!graph.nodes.some(node => node.id === start)) return new Set();
    const adjacency = new Map<string, Set<string>>();
    const add = (from: string, to: string): void => {
        if (!adjacency.has(from)) adjacency.set(from, new Set());
        adjacency.get(from)!.add(to);
    };
    for (const edge of graph.edges) {
        if (mode !== "upstream") add(edge.source, edge.target);
        if (mode !== "downstream") add(edge.target, edge.source);
    }
    const seen = new Set([start]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
        for (const id of adjacency.get(queue[i]) ?? []) {
            if (seen.has(id)) continue;
            seen.add(id);
            if (mode !== "neighbors") queue.push(id);
        }
    }
    return seen;
}

export function incidentRows(graph: Graph, nodeId: string): number[] {
    return [...new Set(graph.edges
        .filter(edge => edge.source === nodeId || edge.target === nodeId)
        .flatMap(edge => edge.rows))].sort((a, b) => a - b);
}
