import powerbi from "powerbi-visuals-api";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { buildGraph, Graph, GraphEdge, InputRow, LIMITS } from "./graph";

export interface NetworkData {
    graph: Graph;
    identities: Map<number, powerbi.visuals.ISelectionId>;
    identityMissing: boolean;
    weightFormat: string | undefined;
    tooltipColumns: powerbi.DataViewValueColumn[];
    bindingMissing: boolean;
}

export function readData(view: powerbi.DataView | undefined, host: powerbi.extensibility.visual.IVisualHost): NetworkData {
    const categories = view?.categorical?.categories ?? [];
    const source = categories.find(column => column.source.roles?.source);
    const target = categories.find(column => column.source.roles?.target);
    const type = categories.find(column => column.source.roles?.relationshipType);
    const edgeId = categories.find(column => column.source.roles?.edgeId);
    const values = view?.categorical?.values ?? [];
    const weight = values.find(column => column.source.roles?.weight);
    const tooltipColumns = values.filter(column => column.source.roles?.tooltips).slice(0, 8);
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
                highlight: weight?.highlights ? weight.highlights[index] :
                    highlightColumns.some(column => column.highlights?.[index] != null) ? 1 : null
            });
            if (identityCategories.every(column => column.identity?.[index])) {
                let builder = host.createSelectionIdBuilder();
                for (const column of identityCategories) builder = builder.withCategory(column, index);
                const identity = builder.createSelectionId();
                if (identity.hasIdentity()) identities.set(index, identity);
                else identityMissing = true;
            } else identityMissing = true;
        }
    }
    const graph = buildGraph(rows, {
        weighted: !!weight, edgeIds: !!edgeId, hasHighlights: highlightColumns.length > 0,
        partial: !!view?.metadata.segment
    });
    graph.diagnostics.omittedRows += Math.max(0, rowCount - LIMITS.rows);
    graph.diagnostics.incomplete ||= graph.diagnostics.omittedRows > 0;
    return { graph, identities, identityMissing, weightFormat: weight?.source.format, tooltipColumns, bindingMissing: !source || !target };
}

export function formatValue(value: powerbi.PrimitiveValue, format: string | undefined, locale: string): string {
    return valueFormatter.create({ format, cultureSelector: locale }).format(value);
}

// Tooltip measures are not assumed additive. Show a common value or disclose the delivered value variation.
export function tooltipValues(data: NetworkData, edge: GraphEdge, locale: string, multiple: string, missing: string): powerbi.extensibility.VisualTooltipDataItem[] {
    return data.tooltipColumns.map(column => {
        const values = new Set(edge.rows.map(index => formatValue(column.values[index], column.source.format, locale)));
        return {
            displayName: column.source.displayName.slice(0, 512),
            value: values.size === 1 ? ([...values][0] || missing).slice(0, 2048) : `${multiple} (${values.size})`
        };
    });
}
