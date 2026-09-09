export const LIMITS = Object.freeze({ rows: 5000, nodes: 250, edges: 1000, idLength: 512, selection: 200, tooltipCell: 2048, tooltipCharacters: 1000000 });

export interface InputRow {
    source: unknown;
    target: unknown;
    type?: unknown;
    edgeId?: unknown;
    weight?: unknown;
    highlight?: unknown;
    highlightActive?: boolean;
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
    weightOverflow?: boolean;
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

function sumContributions(values: number[]): number | null {
    if (!values.length) return null;
    let total = 0;
    let correction = 0;
    for (const value of values.sort((a, b) => a - b)) {
        const adjusted = value - correction;
        const next = total + adjusted;
        if (!Number.isFinite(next)) return null;
        correction = (next - total) - adjusted;
        total = next;
    }
    return total;
}

export function buildGraph(rows: readonly InputRow[], options: GraphOptions): Graph {
    const diagnostics: Diagnostics = {
        invalidIds: 0, duplicateRows: 0, ambiguousIds: 0, missingWeights: 0,
        omittedRows: Math.max(0, rows.length - LIMITS.rows), omittedEdges: 0,
        incomplete: options.partial || rows.length > LIMITS.rows
    };
    const groups = new Map<string, GraphEdge>();
    const nodes = new Map<string, GraphNode>();
    const ambiguous = new Set<string>();
    const contributions = new Map<string, { weights: number[]; highlights: number[] }>();
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
        const totals = contributions.get(id) ?? { weights: [], highlights: [] };
        if (options.weighted) {
            if (numericWeight(row.weight)) {
                totals.weights.push(row.weight);
            } else {
                edge.missingWeight = true;
                diagnostics.missingWeights++;
            }
        }
        edge.highlighted ||= row.highlightActive ?? (row.highlight !== null && row.highlight !== undefined);
        if (numericWeight(row.highlight)) totals.highlights.push(row.highlight);
        contributions.set(id, totals);
        groups.set(id, edge);
    }
    diagnostics.ambiguousIds = ambiguous.size;
    for (const id of ambiguous) groups.delete(id);
    for (const edge of groups.values()) {
        const totals = contributions.get(edge.id)!;
        edge.weight = sumContributions(totals.weights);
        edge.highlightWeight = sumContributions(totals.highlights);
        if (totals.weights.length && edge.weight === null) {
            edge.weightOverflow = true;
            edge.missingWeight = true;
            diagnostics.missingWeights++;
        }
    }
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

export type FocusMode = "all" | "neighbors" | "upstream" | "downstream" | "incident" | "path";

export function reachable(graph: Graph, start: string, mode: FocusMode, target?: string): Set<string> {
    if (mode === "path") return new Set(shortestPath(graph, start, target ?? "").nodes);
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
            if (mode !== "neighbors" && mode !== "incident") queue.push(id);
        }
    }
    return seen;
}

export function incidentRows(graph: Graph, nodeId: string): number[] {
    return [...new Set(graph.edges
        .filter(edge => edge.source === nodeId || edge.target === nodeId)
        .flatMap(edge => edge.rows))].sort((a, b) => a - b);
}

export interface GraphIndex {
    nodes: Map<string, GraphNode>;
    edges: Map<string, GraphEdge>;
    incident: Map<string, number[]>;
    incoming: Map<string, GraphEdge[]>;
    outgoing: Map<string, GraphEdge[]>;
    highlightedNodes: Set<string>;
}

export function indexGraph(graph: Graph): GraphIndex {
    const nodes = new Map(graph.nodes.map(node => [node.id, node]));
    const incoming = new Map(graph.nodes.map(node => [node.id, [] as GraphEdge[]]));
    const outgoing = new Map(graph.nodes.map(node => [node.id, [] as GraphEdge[]]));
    const incident = new Map(graph.nodes.map(node => [node.id, new Set<number>()]));
    const highlightedNodes = new Set<string>();
    for (const edge of graph.edges) {
        incoming.get(edge.target)!.push(edge);
        outgoing.get(edge.source)!.push(edge);
        for (const id of new Set([edge.source, edge.target])) {
            for (const row of edge.rows) incident.get(id)!.add(row);
            if (edge.highlighted) highlightedNodes.add(id);
        }
    }
    return {
        nodes, incoming, outgoing, highlightedNodes,
        edges: new Map(graph.edges.map(edge => [edge.id, edge])),
        incident: new Map([...incident].map(([id, rows]) => [id, [...rows].sort((a, b) => a - b)]))
    };
}

export function shortestPath(graph: Graph, start: string, target: string): { nodes: string[]; edges: string[] } {
    const index = indexGraph(graph);
    if (!index.nodes.has(start) || !index.nodes.has(target)) return { nodes: [], edges: [] };
    const previous = new Map<string, { node: string; edge: string }>();
    const seen = new Set([start]);
    const queue = [start];
    for (let i = 0; i < queue.length && !seen.has(target); i++) {
        for (const edge of index.outgoing.get(queue[i])!) {
            if (seen.has(edge.target)) continue;
            seen.add(edge.target);
            previous.set(edge.target, { node: queue[i], edge: edge.id });
            queue.push(edge.target);
        }
    }
    if (!seen.has(target)) return { nodes: [], edges: [] };
    const nodes = [target];
    const edges: string[] = [];
    for (let id = target; id !== start;) {
        const step = previous.get(id)!;
        edges.push(step.edge);
        nodes.push(step.node);
        id = step.node;
    }
    return { nodes: nodes.reverse(), edges: edges.reverse() };
}
