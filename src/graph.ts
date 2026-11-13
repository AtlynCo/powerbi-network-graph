export const LIMITS = Object.freeze({ rows: 5000, nodes: 250, edges: 1000, idLength: 512, selection: 200, tooltipCell: 2048, tooltipCharacters: 1000000 });

export interface InputRow {
    source: unknown;
    target: unknown;
    type?: unknown;
    edgeId?: unknown;
    itemId?: unknown;
    weight?: unknown;
    highlight?: unknown;
    highlightActive?: boolean;
    index: number;
}

export interface GraphNode {
    id: string;
    label: string;
    isSource?: boolean;
    isTarget?: boolean;
    isFallbackBucket?: boolean;
    nonSelfSource?: boolean;
    nonSelfTarget?: boolean;
    totalWeight?: number;
    outgoingWeight?: number;
    incomingWeight?: number;
}
export interface GraphItem {
    /** Owner-scoped typed key, not an overview edge ID. */
    id: string;
    label: string;
    ownerId: string | null;
    ownerConflict?: boolean;
    /** Empty for mixed types; types retains every distinct delivered type. */
    type: string;
    types?: string[];
    rows: number[];
    weight: number | null;
    missingWeight: boolean;
    highlighted: boolean;
    highlightWeight: number | null;
}
export interface GraphItemEdge {
    id: string;
    source: string;
    itemId: string;
    target: string;
    type: string;
    rows: number[];
    weight: number | null;
    missingWeight: boolean;
    highlighted: boolean;
    highlightWeight: number | null;
}
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
    items?: GraphItem[];
    itemEdges?: GraphItemEdge[];
}
export interface GraphOptions {
    weighted: boolean; edgeIds: boolean; hasHighlights: boolean; partial: boolean;
    itemIds?: boolean; groupBlankTargets?: boolean; blankTargetLabel?: string;
}

export const FALLBACK_BUCKET_ID = "bucket:external";
export function sanitizeBlankTargetLabel(value: unknown): string {
    return typeof value === "string" ? value.trim().slice(0, 80).trim() || "External / unknown" : "External / unknown";
}
const blankId = (value: unknown): boolean => value == null || (typeof value === "string" && value.trim() === "");

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

export function sumContributions(values: readonly number[]): number | null {
    if (!values.length) return null;
    let total = 0;
    let correction = 0;
    for (const value of [...values].sort((a, b) => a - b)) {
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
    const itemRows: { row: InputRow; overviewId: string; itemId: string; source: string; target: string; typeId: string; type: string; label: string }[] = [];
    for (const row of rows.slice(0, LIMITS.rows)) {
        const source = stableId(row.source);
        const fallback = options.groupBlankTargets && blankId(row.target);
        const target = fallback ? FALLBACK_BUCKET_ID : stableId(row.target);
        const edgeId = options.edgeIds ? stableId(row.edgeId) : null;
        const itemId = options.itemIds ? (blankId(row.itemId) ? null : stableId(row.itemId)) : edgeId;
        const typeId = row.type == null ? "" : stableId(row.type);
        if (!source || !target || (options.edgeIds && !edgeId) || typeId === null ||
            (options.itemIds && !blankId(row.itemId) && !itemId)) {
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
        nodes.set(target, {
            id: target, label: fallback ? sanitizeBlankTargetLabel(options.blankTargetLabel) : String(row.target),
            ...(fallback ? { isFallbackBucket: true } : {})
        });
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
        if (itemId) itemRows.push({
            row, overviewId: id, itemId, source, target, typeId, type,
            label: String(options.itemIds ? row.itemId : row.edgeId)
        });
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
    for (const node of keptNodes.values()) {
        const outgoing = edges.filter(edge => edge.source === node.id);
        const incoming = edges.filter(edge => edge.target === node.id);
        node.isSource = outgoing.length > 0;
        node.isTarget = incoming.length > 0;
        node.nonSelfSource = outgoing.some(edge => edge.target !== node.id);
        node.nonSelfTarget = incoming.some(edge => edge.source !== node.id);
        const known = (list: GraphEdge[]): number | undefined =>
            list.some(edge => edge.weightOverflow) ? undefined : sumContributions(list.flatMap(edge => edge.weight === null ? [] : [edge.weight])) ?? undefined;
        node.outgoingWeight = known(outgoing);
        node.incomingWeight = known(incoming);
        node.totalWeight = known(edges.filter(edge => edge.source === node.id || edge.target === node.id));
    }
    // Build details only after ambiguity and topology caps. No omitted identity can leak into item selection.
    const keptEdgeIds = new Set(edges.map(edge => edge.id));
    const retained = itemRows.filter(entry => keptEdgeIds.has(entry.overviewId));
    const owners = new Map<string, Set<string>>();
    for (const entry of retained) {
        if (!owners.has(entry.itemId)) owners.set(entry.itemId, new Set());
        if (entry.target !== FALLBACK_BUCKET_ID) owners.get(entry.itemId)!.add(entry.target);
    }
    const items = new Map<string, GraphItem>();
    const itemEdges = new Map<string, GraphItemEdge>();
    const detailTotals = new Map<GraphItem | GraphItemEdge, { weights: number[]; highlights: number[] }>();
    for (const entry of retained) {
        const { row, source, target, type, typeId } = entry;
        const id = JSON.stringify([entry.itemId, target]);
        const item = items.get(id) ?? {
            id, label: entry.label, ownerId: target, ownerConflict: owners.get(entry.itemId)!.size > 1,
            type, types: [], rows: [], weight: null, missingWeight: false, highlighted: false, highlightWeight: null
        };
        if (!item.types!.includes(type)) item.types!.push(type);
        items.set(id, item);
        const itemEdgeId = JSON.stringify([source, id, typeId]);
        const itemEdge = itemEdges.get(itemEdgeId) ?? {
            id: itemEdgeId, source, itemId: id, target, type, rows: [], weight: null,
            missingWeight: false, highlighted: false, highlightWeight: null
        };
        itemEdges.set(itemEdgeId, itemEdge);
        for (const detail of [item, itemEdge]) {
            detail.rows.push(row.index);
            const totals = detailTotals.get(detail) ?? { weights: [], highlights: [] };
            if (options.weighted) {
                if (numericWeight(row.weight)) totals.weights.push(row.weight);
                else detail.missingWeight = true;
            }
            detail.highlighted ||= row.highlightActive ?? (row.highlight != null);
            if (numericWeight(row.highlight)) totals.highlights.push(row.highlight);
            detailTotals.set(detail, totals);
        }
    }
    for (const [detail, totals] of detailTotals) {
        detail.rows.sort((a, b) => a - b);
        detail.weight = sumContributions(totals.weights);
        detail.highlightWeight = sumContributions(totals.highlights);
        detail.missingWeight ||= totals.weights.length > 0 && detail.weight === null;
    }
    for (const item of items.values()) {
        item.types!.sort(compare);
        item.type = item.types!.length === 1 ? item.types![0] : "";
    }
    return {
        nodes: [...keptNodes.values()].sort((a, b) => compare(a.id, b.id)),
        edges, diagnostics, hasHighlights: options.hasHighlights, weighted: options.weighted,
        items: [...items.values()].sort((a, b) => compare(a.id, b.id)),
        itemEdges: [...itemEdges.values()].sort((a, b) => compare(a.id, b.id))
    };
}

export interface SelfLinkSummary {
    selfEdgeCount: number;
    selfRowCount: number;
    selfPairCount: number;
    selfWeight: number | null;
    drawnWeight: number | null;
}
export function summarizeSelfLinks(graph: Graph): SelfLinkSummary {
    const self = graph.edges.filter(edge => edge.source === edge.target);
    const drawn = graph.edges.filter(edge => edge.source !== edge.target);
    const total = (edges: GraphEdge[]): number | null => {
        if (edges.some(edge => edge.weightOverflow)) return null;
        return sumContributions(edges.flatMap(edge => edge.weight === null ? [] : [edge.weight])) ??
            (graph.weighted && edges.length === 0 ? 0 : null);
    };
    return {
        selfEdgeCount: self.length, selfRowCount: new Set(self.flatMap(edge => edge.rows)).size,
        selfPairCount: new Set(self.map(edge => JSON.stringify([edge.source, edge.target]))).size,
        selfWeight: total(self), drawnWeight: total(drawn)
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
