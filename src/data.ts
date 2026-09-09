import powerbi from "powerbi-visuals-api";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { buildGraph, Graph, GraphEdge, InputRow, LIMITS } from "./graph";

export interface TooltipColumn {
    source: { displayName: string; format?: string };
    values: (powerbi.PrimitiveValue | null)[];
}

export interface NetworkData {
    graph: Graph;
    identities: Map<number, powerbi.visuals.ISelectionId>;
    identityMissing: boolean;
    weightFormat: string | undefined;
    tooltipColumns: TooltipColumn[];
    bindingMissing: boolean;
    hasWeightHighlights: boolean;
    tooltipOmissions: Map<number, Set<number>>;
    tooltipLimited: boolean;
}

export function readData(view: powerbi.DataView | undefined, host: powerbi.extensibility.visual.IVisualHost): NetworkData {
    const categories = view?.categorical?.categories ?? [];
    const source = categories.find(column => column.source.roles?.source);
    const target = categories.find(column => column.source.roles?.target);
    const type = categories.find(column => column.source.roles?.relationshipType);
    const edgeId = categories.find(column => column.source.roles?.edgeId);
    const values = view?.categorical?.values ?? [];
    const weight = values.find(column => column.source.roles?.weight);
    const tooltipSources = values.filter(column => column.source.roles?.tooltips);
    const highlightColumns = values.filter(column => column.highlights !== undefined);
    const rows: InputRow[] = [];
    const identities = new Map<number, powerbi.visuals.ISelectionId>();
    const identityCategories = categories.filter(column =>
        ["source", "target", "relationshipType", "edgeId"].some(role => column.source.roles?.[role]));
    const rowCount = Math.max(0, ...identityCategories.map(column => column.values.length));
    let identityMissing = false;
    if (source && target) {
        for (let index = 0; index < Math.min(rowCount, LIMITS.rows); index++) {
            rows.push({
                source: source.values[index], target: target.values[index], type: type?.values[index],
                edgeId: edgeId?.values[index], weight: weight?.values[index], index,
                highlight: weight?.highlights?.[index],
                highlightActive: highlightColumns.some(column => column.highlights?.[index] != null)
            });
        }
    }
    const graph = buildGraph(rows, {
        weighted: !!weight, edgeIds: !!edgeId, hasHighlights: highlightColumns.length > 0,
        partial: !!view?.metadata.segment
    });
    graph.diagnostics.omittedRows += Math.max(0, rowCount - LIMITS.rows);
    graph.diagnostics.incomplete ||= graph.diagnostics.omittedRows > 0;
    const representedRows = new Set(graph.edges.flatMap(edge => edge.rows));
    for (const index of representedRows) {
        if (identityCategories.every(column => column.identity?.[index])) {
            let builder = host.createSelectionIdBuilder();
            for (const column of identityCategories) builder = builder.withCategory(column, index);
            const identity = builder.createSelectionId();
            if (identity.hasIdentity()) identities.set(index, identity);
            else identityMissing = true;
        } else identityMissing = true;
    }
    let textBudget = LIMITS.tooltipCharacters;
    let tooltipLimited = tooltipSources.length > 8;
    const tooltipOmissions = new Map<number, Set<number>>();
    const tooltipColumns = tooltipSources.slice(0, 8).map((column, columnIndex): TooltipColumn => {
        const omitted = new Set<number>();
        tooltipOmissions.set(columnIndex, omitted);
        const invalidFormat = (column.source.format?.length ?? 0) > 4096;
        const values = Array.from({ length: Math.min(rowCount, LIMITS.rows) }, (_, index) => {
            if (!representedRows.has(index)) return null;
            const value = column.values[index];
            if (invalidFormat || (typeof value === "string" && (value.length > LIMITS.tooltipCell || value.length > textBudget))) {
                omitted.add(index);
                tooltipLimited = true;
                return null;
            }
            if (typeof value === "string") textBudget -= value.length;
            return value;
        });
        return {
            source: { displayName: column.source.displayName.slice(0, 512), format: invalidFormat ? undefined : column.source.format },
            values
        };
    });
    return {
        graph, identities, identityMissing, weightFormat: weight?.source.format,
        tooltipColumns, bindingMissing: !source || !target, hasWeightHighlights: !!weight?.highlights, tooltipOmissions, tooltipLimited
    };
}

export function formatValue(value: powerbi.PrimitiveValue, format: string | undefined, locale: string): string {
    return createFormatter(format, locale)(value);
}

export function createFormatter(format: string | undefined, locale: string): (value: powerbi.PrimitiveValue | null | undefined) => string {
    if (format && format.length > 4096) throw new Error("Model format exceeds the supported 4096-character limit.");
    const formatter = valueFormatter.create({ format, cultureSelector: locale });
    return value => formatter.format(value);
}

// Tooltip measures are not assumed additive. Show a common value or disclose the delivered value variation.
export function tooltipValues(data: NetworkData, edge: GraphEdge, locale: string, multiple: string, missing: string, limited = "Tooltip unavailable: text limit exceeded"): powerbi.extensibility.VisualTooltipDataItem[] {
    return data.tooltipColumns.map((column, index) => {
        if (edge.rows.some(row => data.tooltipOmissions.get(index)?.has(row))) {
            return { displayName: column.source.displayName, value: limited };
        }
        const format = createFormatter(column.source.format, locale);
        const values = new Set(edge.rows.map(index => format(column.values[index])));
        return {
            displayName: column.source.displayName.slice(0, 512),
            value: values.size === 1 ? ([...values][0] || missing).slice(0, 2048) : `${multiple} (${values.size})`
        };
    });
}
