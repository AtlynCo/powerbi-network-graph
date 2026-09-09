import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { formatValue, NetworkData, readData, tooltipValues } from "./data";
import { FocusMode, GraphEdge, incidentRows, reachable } from "./graph";
import { edgePath, Layout, layoutBounds, layoutGraph, topologySignature } from "./layout";
import { relationshipSelection } from "./selection";
import { Settings } from "./settings";
import { ar, en, MessageKey } from "./strings";
import { thirdPartyNotices } from "./thirdPartyNotices";
import "../style/visual.less";

type Host = powerbi.extensibility.visual.IVisualHost;
const NS = "http://www.w3.org/2000/svg";
const PAGE_SIZE = 25;
let instance = 0;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
}
function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string> = {}): SVGElementTagNameMap[K] {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
}
function isSelectionId(id: powerbi.extensibility.ISelectionId): id is powerbi.visuals.ISelectionId {
    return "includes" in id && typeof id.includes === "function" && "getKey" in id && typeof id.getKey === "function";
}

export class Visual implements powerbi.extensibility.visual.IVisual {
    private readonly host: Host;
    private readonly root: HTMLDivElement;
    private readonly toolbar = element("div", "network-toolbar");
    private readonly status = element("div", "network-status");
    private readonly notice = element("div", "network-notice");
    private readonly body = element("div", "network-body");
    private readonly svg = svgElement("svg", { class: "network-svg", tabindex: "0", role: "group" });
    private readonly world = svgElement("g");
    private readonly list = element("div", "network-list");
    private readonly listContent = element("div", "network-list-content");
    private readonly pager = element("div", "network-pager");
    private readonly search = element("input");
    private readonly entity = element("select");
    private readonly focusMode = element("select");
    private readonly selection: powerbi.extensibility.ISelectionManager;
    private readonly formatting: FormattingSettingsService;
    private readonly localization: powerbi.extensibility.ILocalizationManager;
    private settings = new Settings();
    private data: NetworkData;
    private layout: Layout;
    private selected: powerbi.visuals.ISelectionId[] = [];
    private focusId = "";
    private mode: FocusMode = "all";
    private listMode: "entities" | "relationships" = "entities";
    private page = 0;
    private viewport = { width: 800, height: 500 };
    private camera = { x: 0, y: 0, scale: 1 };
    private autoFit = true;
    private dragging: { id: number; x: number; y: number } | undefined;
    private readonly markerId = `atlyn-arrow-${++instance}`;
    private destroyed = false;
    private busy = false;

    constructor(options?: powerbi.extensibility.visual.VisualConstructorOptions) {
        if (!options) throw new Error("Power BI visual constructor options are required.");
        this.host = options.host;
        this.selection = this.host.createSelectionManager();
        this.localization = this.host.createLocalizationManager();
        this.formatting = new FormattingSettingsService(this.localization);
        this.data = readData(undefined, this.host);
        this.layout = layoutGraph(this.data.graph);
        this.root = element("div", "atlyn-network");
        this.root.dir = /^(ar|he|fa|ur)(-|$)/i.test(this.host.locale) ? "rtl" : "ltr";
        this.root.setAttribute("aria-label", this.t("Title"));
        this.root.setAttribute("role", "region");
        this.root.lang = this.host.locale || "en-US";
        this.status.setAttribute("role", "status");
        this.status.setAttribute("aria-live", "polite");
        this.notice.setAttribute("role", "alert");
        this.svg.setAttribute("aria-label", this.t("GraphHelp"));
        this.buildToolbar();
        const help = element("details", "network-help");
        const summary = element("summary");
        summary.textContent = this.t("Title");
        const instructions = element("p");
        instructions.textContent = `${this.t("SelectionHelp")} ${this.t("GraphHelp")} ${this.t("ContextScope")}`;
        const legal = element("details");
        const legalTitle = element("summary");
        legalTitle.textContent = this.t("ThirdPartyLicenses");
        const legalText = element("pre", "network-licenses");
        legalText.tabIndex = 0;
        legalText.dir = "ltr";
        legalText.setAttribute("aria-label", this.t("ThirdPartyLicenses"));
        legalText.textContent = thirdPartyNotices;
        legal.append(legalTitle, legalText);
        help.append(summary, instructions, legal);
        const tabs = element("div", "network-tabs");
        tabs.append(
            this.button("Entities", "entities", () => this.switchList("entities")),
            this.button("Relationships", "relationships", () => this.switchList("relationships"))
        );
        this.list.append(tabs, this.listContent, this.pager);
        this.svg.append(this.world);
        this.body.append(this.svg, this.list);
        this.root.append(help, this.toolbar, this.status, this.notice, this.body);
        options.element.append(this.root);
        this.bindCamera();
        this.selection.registerOnSelectCallback(() => {
            if (!this.destroyed) this.syncSelection();
        });
        this.root.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                event.preventDefault();
                this.clearSelection();
            }
        });
    }

    private t(key: MessageKey): string {
        const translated = this.localization.getDisplayName(key);
        return translated && translated !== key ? translated : (/^ar(-|$)/i.test(this.host.locale) ? ar : en)[key];
    }

    private button(key: MessageKey, action: string, handler: (event: MouseEvent) => void): HTMLButtonElement {
        const button = element("button");
        button.type = "button";
        button.textContent = this.t(key);
        button.dataset.action = action;
        button.title = this.t(key);
        button.addEventListener("click", handler);
        return button;
    }

    private buildToolbar(): void {
        this.search.type = "search";
        this.search.maxLength = 512;
        this.search.placeholder = this.t("Search");
        this.search.setAttribute("aria-label", this.t("Search"));
        this.search.addEventListener("input", () => {
            this.page = 0;
            this.renderList();
            this.styleSelection();
        });
        this.entity.dataset.control = "entity";
        this.entity.setAttribute("aria-label", this.t("Entity"));
        this.entity.addEventListener("change", () => {
            this.focusId = this.entity.value;
            if (this.mode === "all") this.mode = "neighbors";
            this.focusMode.value = this.mode;
            this.localFocusChanged();
        });
        this.focusMode.dataset.control = "focus-mode";
        this.focusMode.setAttribute("aria-label", this.t("FocusMode"));
        const modes: [FocusMode, MessageKey][] = [["all", "All"], ["neighbors", "Neighbors"], ["upstream", "Upstream"], ["downstream", "Downstream"]];
        for (const [value, key] of modes) {
            const option = element("option");
            option.value = value;
            option.textContent = this.t(key);
            this.focusMode.append(option);
        }
        this.focusMode.addEventListener("change", () => {
            const selected = modes.find(([value]) => value === this.focusMode.value);
            if (!selected) return;
            this.mode = selected[0];
            this.localFocusChanged();
        });
        this.toolbar.append(
            this.search, this.entity, this.focusMode,
            this.button("ResetFocus", "reset-focus", () => {
                this.mode = "all";
                this.focusMode.value = "all";
                this.search.value = "";
                this.localFocusChanged();
            }),
            this.button("Fit", "fit", () => { this.autoFit = true; this.fit(); }),
            this.button("ZoomIn", "zoom-in", () => this.zoom(1.25)),
            this.button("ZoomOut", "zoom-out", () => this.zoom(0.8)),
            this.button("ClearSelection", "clear-selection", () => this.clearSelection())
        );
    }

    public update(options: powerbi.extensibility.visual.VisualUpdateOptions): void {
        if (this.destroyed) return;
        this.host.eventService.renderingStarted(options);
        this.root.setAttribute("aria-busy", "true");
        this.status.textContent = this.t("Loading");
        this.notice.textContent = "";
        const active = document.activeElement;
        const focusKey = active instanceof HTMLElement && this.list.contains(active) ?
            { action: active.dataset.action, key: active.dataset.focusKey } : undefined;
        try {
            this.viewport = {
                width: Math.max(0, options.viewport.width),
                height: Math.max(0, options.viewport.height)
            };
            this.root.style.width = `${this.viewport.width}px`;
            this.root.style.height = `${this.viewport.height}px`;
            this.root.classList.toggle("compact", this.viewport.width < 600);
            this.root.classList.toggle("tiny", this.viewport.width < 300 || this.viewport.height < 260);
            const view = options.dataViews?.[0];
            // Resize-only host calls may omit dataViews. Data updates without a view must clear stale data.
            if (view || (options.type & powerbi.VisualUpdateType.Data)) {
                this.data = readData(view, this.host);
                this.settings = view ? this.formatting.populateFormattingSettingsModel(Settings, view) : new Settings();
            }
            const changed = topologySignature(this.data.graph) !== this.layout.signature;
            if (changed) {
                this.layout = layoutGraph(this.data.graph);
                this.page = 0;
                this.autoFit = true;
            }
            if (!this.data.graph.nodes.some(node => node.id === this.focusId)) {
                this.focusId = this.data.graph.nodes[0]?.id ?? "";
                this.mode = "all";
                this.focusMode.value = "all";
            }
            this.populateEntities();
            this.applyTheme();
            this.renderGraph();
            this.renderList();
            this.syncSelection();
            this.renderStatus();
            if (this.autoFit) this.fit();
            else this.transform();
            if (focusKey && !active?.isConnected) {
                const controls = [...this.list.querySelectorAll<HTMLButtonElement>("button")];
                const restored = controls.find(control => control.dataset.action === focusKey.action && control.dataset.focusKey === focusKey.key);
                (restored ?? controls[0])?.focus();
            }
            this.root.setAttribute("aria-busy", "false");
            this.host.eventService.renderingFinished(options);
        } catch (error) {
            // The host must receive a terminal lifecycle event, including formatter or host-service failures.
            this.world.replaceChildren();
            this.listContent.replaceChildren();
            this.status.textContent = "";
            this.notice.textContent = this.t("RenderFailed");
            this.root.setAttribute("aria-busy", "false");
            this.host.eventService.renderingFailed(options, error instanceof Error ? error.message : this.t("RenderFailed"));
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formatting.buildFormattingModel(this.settings);
    }

    private populateEntities(): void {
        this.entity.replaceChildren();
        for (const node of this.data.graph.nodes) {
            const option = element("option");
            option.value = node.id;
            option.textContent = node.label;
            this.entity.append(option);
        }
        this.entity.value = this.focusId;
        this.entity.disabled = !this.data.graph.nodes.length;
        this.focusMode.disabled = !this.data.graph.nodes.length;
    }

    private applyTheme(): void {
        const palette = this.host.colorPalette;
        const highContrast = palette.isHighContrast;
        let invalid = false;
        const color = (value: unknown, fallback: string): string => {
            if (typeof value === "string" && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) return value;
            invalid = true;
            return fallback;
        };
        this.root.classList.toggle("high-contrast", highContrast);
        this.root.style.setProperty("--background", highContrast ? color(palette.background.value, "#FFFFFF") : "#FFFFFF");
        this.root.style.setProperty("--foreground", highContrast ? color(palette.foreground.value, "#000000") : "#172D3D");
        this.root.style.setProperty("--node", highContrast ? color(palette.foreground.value, "#000000") : color(this.settings.appearance.nodeColor.value?.value, "#007D87"));
        this.root.style.setProperty("--edge", highContrast ? color(palette.foreground.value, "#000000") : color(this.settings.appearance.edgeColor.value?.value, "#596579"));
        this.root.style.setProperty("--accent", highContrast ? color(palette.foregroundSelected.value, "#000000") : "#A64000");
        const size = this.settings.appearance.labelSize.value;
        invalid ||= !Number.isFinite(size) || size < 8 || size > 24;
        this.root.style.setProperty("--label-size", `${Number.isFinite(size) ? Math.max(8, Math.min(24, size)) : 12}px`);
        if (invalid) this.notice.textContent = this.t("InvalidAppearance");
    }

    private visibleIds(): Set<string> { return reachable(this.data.graph, this.focusId, this.mode); }

    private visibleEdges(): GraphEdge[] {
        const ids = this.visibleIds();
        return this.data.graph.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target));
    }

    private renderGraph(): void {
        this.world.replaceChildren();
        const defs = svgElement("defs");
        const marker = svgElement("marker", {
            id: this.markerId, markerWidth: "8", markerHeight: "8",
            refX: "7", refY: "4", orient: "auto", markerUnits: "userSpaceOnUse"
        });
        marker.append(svgElement("path", { d: "M 0 0 L 8 4 L 0 8 z", fill: "var(--edge)" }));
        defs.append(marker);
        this.world.append(defs);
        const edges = this.visibleEdges();
        const maxWeight = Math.max(1, ...this.data.graph.edges.map(edge => edge.weight ?? 0));
        for (const edge of edges) {
            const group = svgElement("g", { class: "network-edge", "data-edge-id": edge.id });
            const path = edgePath(edge, this.data.graph, this.layout.positions);
            const line = svgElement("path", {
                d: path, fill: "none", stroke: "var(--edge)",
                "stroke-width": edge.missingWeight || edge.weight === null ? "1.5" : String(1.5 + Math.sqrt(edge.weight / maxWeight) * 3),
                "marker-end": `url(#${this.markerId})`
            });
            const hit = svgElement("path", { d: path, fill: "none", stroke: "transparent", "stroke-width": "14", class: "edge-hit" });
            const title = svgElement("title");
            title.textContent = this.edgeDescription(edge);
            group.append(title, line, hit);
            group.addEventListener("click", event => { event.stopPropagation(); this.selectRows(edge.rows, event); });
            group.addEventListener("pointerenter", event => this.showTooltip(edge, event.clientX, event.clientY));
            group.addEventListener("pointerleave", () => this.hideTooltip());
            this.bindContext(group, edge.rows);
            this.world.append(group);
        }
        const visible = this.visibleIds();
        for (const node of this.data.graph.nodes.filter(node => visible.has(node.id))) {
            const point = this.layout.positions.get(node.id)!;
            const group = svgElement("g", {
                class: "network-node", "data-node-id": node.id,
                transform: `translate(${point.x},${point.y})`, role: "button",
                "aria-label": `${node.label}: ${this.t("SelectNode")}`
            });
            const circle = svgElement("circle", { r: "14", fill: "var(--node)", stroke: "var(--background)", "stroke-width": "2" });
            const title = svgElement("title");
            title.textContent = `${node.label}: ${this.t("SelectNode")}`;
            group.append(title, circle);
            if (this.settings.appearance.showLabels.value) {
                const label = svgElement("text", { x: "20", y: "5", fill: "var(--foreground)", direction: "ltr" });
                label.textContent = node.label.length > 24 ? `${node.label.slice(0, 23)}...` : node.label;
                group.append(label);
            }
            group.addEventListener("click", event => { event.stopPropagation(); this.selectRows(incidentRows(this.data.graph, node.id), event); });
            this.bindContext(group, []);
            this.world.append(group);
        }
    }

    private renderStatus(): void {
        const graph = this.data.graph;
        const diagnostics = graph.diagnostics;
        const messages: string[] = [];
        if (this.data.bindingMissing) messages.push(this.t("Bind"));
        else if (!graph.edges.length) messages.push(this.t("Empty"));
        else messages.push(`${this.t("Loaded")}: ${graph.nodes.length} ${this.t("EntityCount")}, ${graph.edges.length} ${this.t("EdgeCount")}.`);
        if (diagnostics.incomplete) messages.push(this.t("Incomplete"));
        const fields: [number, MessageKey][] = [
            [diagnostics.invalidIds, "InvalidIds"], [diagnostics.duplicateRows, "Duplicates"],
            [diagnostics.ambiguousIds, "Ambiguous"], [diagnostics.missingWeights, "MissingWeights"],
            [diagnostics.omittedRows, "OmittedRows"], [diagnostics.omittedEdges, "OmittedEdges"]
        ];
        for (const [count, key] of fields) if (count) messages.push(`${this.t(key)}: ${count}.`);
        if (this.data.identityMissing) messages.push(this.t("MissingIdentities"));
        if (this.mode !== "all") messages.push(this.t("FocusNotice"));
        this.status.textContent = messages.join(" ");
    }

    private switchList(mode: "entities" | "relationships"): void {
        this.listMode = mode;
        this.page = 0;
        this.renderList();
    }

    private renderList(): void {
        this.listContent.replaceChildren();
        this.pager.replaceChildren();
        this.list.querySelectorAll<HTMLButtonElement>(".network-tabs button").forEach(button => {
            button.setAttribute("aria-pressed", String(button.dataset.action === this.listMode));
        });
        const query = this.search.value.toLocaleLowerCase(this.host.locale).trim();
        const visible = this.visibleIds();
        const matches = new Set(this.data.graph.nodes.filter(node => node.label.toLocaleLowerCase(this.host.locale).includes(query)).map(node => node.id));
        const nodes = this.data.graph.nodes.filter(node => visible.has(node.id) && matches.has(node.id));
        const edges = this.visibleEdges().filter(edge => matches.has(edge.source) || matches.has(edge.target));
        const count = this.listMode === "entities" ? nodes.length : edges.length;
        const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
        this.page = Math.max(0, Math.min(this.page, pages - 1));
        const start = this.page * PAGE_SIZE;
        const items = element("ul");
        items.setAttribute("aria-label", this.t(this.listMode === "entities" ? "Entities" : "Relationships"));
        if (this.listMode === "entities") {
            for (const node of nodes.slice(start, start + PAGE_SIZE)) {
                const row = element("li");
                const name = element("strong");
                name.textContent = node.label;
                name.dir = "auto";
                const actions = element("div", "list-actions");
                const focus = this.button("Focus", "focus-node", () => {
                    this.focusId = node.id;
                    this.entity.value = node.id;
                    this.mode = "neighbors";
                    this.focusMode.value = this.mode;
                    this.localFocusChanged();
                    this.entity.focus();
                });
                focus.dataset.focusKey = node.id;
                const select = this.button("SelectNode", "select-node", event => this.selectRows(incidentRows(this.data.graph, node.id), event));
                select.dataset.nodeId = node.id;
                select.dataset.focusKey = node.id;
                select.setAttribute("aria-label", `${node.label}: ${this.t("SelectNode")}`);
                this.bindContext(select, []);
                actions.append(focus, select);
                row.append(name, actions);
                items.append(row);
            }
        } else {
            for (const edge of edges.slice(start, start + PAGE_SIZE)) {
                const row = element("li");
                const select = this.button("SelectEdge", "select-edge", event => this.selectRows(edge.rows, event));
                select.textContent = this.edgeDescription(edge);
                select.dataset.edgeId = edge.id;
                select.dataset.focusKey = edge.id;
                select.addEventListener("focus", () => {
                    const rect = select.getBoundingClientRect();
                    this.showTooltip(edge, rect.left, rect.bottom);
                });
                select.addEventListener("blur", () => this.hideTooltip());
                this.bindContext(select, edge.rows);
                row.append(select);
                const details = tooltipValues(this.data, edge, this.host.locale, this.t("Multiple"), this.t("Missing"));
                if (details.length) {
                    const values = element("p");
                    values.textContent = details.map(item => `${item.displayName}: ${item.value}`).join("; ");
                    row.append(values);
                }
                items.append(row);
            }
        }
        items.addEventListener("keydown", event => {
            const buttons = [...items.querySelectorAll<HTMLButtonElement>("button")];
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            let next: number | undefined;
            if (event.key === "ArrowDown") next = Math.min(index + 1, buttons.length - 1);
            if (event.key === "ArrowUp") next = Math.max(0, index - 1);
            if (event.key === "Home") next = 0;
            if (event.key === "End") next = buttons.length - 1;
            if (next !== undefined) { event.preventDefault(); buttons[next]?.focus(); }
        });
        this.listContent.append(items);
        if (!count) {
            const empty = element("p");
            empty.textContent = this.t("NoResults");
            this.listContent.append(empty);
        }
        const movePage = (delta: number): void => {
            this.page += delta;
            this.renderList();
            this.listContent.querySelector<HTMLButtonElement>("button")?.focus();
        };
        const previous = this.button("Previous", "previous", () => movePage(-1));
        const next = this.button("Next", "next", () => movePage(1));
        previous.disabled = this.page === 0;
        next.disabled = this.page >= pages - 1;
        const label = element("span");
        label.textContent = `${this.t("Page")} ${this.page + 1} / ${pages} (${count})`;
        this.pager.append(previous, label, next);
        this.styleSelection();
    }

    private nodeLabel(id: string): string { return this.data.graph.nodes.find(node => node.id === id)?.label ?? id; }

    private edgeDescription(edge: GraphEdge): string {
        const weight = !this.data.graph.weighted ? this.t("Unweighted") : `${this.t(edge.missingWeight ? "IncompleteWeight" : "Weight")}: ${edge.weight === null ? this.t("Missing") : formatValue(edge.weight, this.data.weightFormat, this.host.locale)}`;
        return `${this.nodeLabel(edge.source)} \u2192 ${this.nodeLabel(edge.target)}${edge.type ? ` [${edge.type}]` : ""}${edge.edgeId !== undefined ? `; ${this.t("Role_Edge")}: ${edge.edgeId}` : ""}; ${weight}`;
    }

    private showTooltip(edge: GraphEdge, x: number, y: number): void {
        if (!this.host.tooltipService.enabled()) return;
        const identities = relationshipSelection(edge.rows, this.data.identities);
        const items = [
            { displayName: this.t("Source"), value: this.nodeLabel(edge.source) },
            { displayName: this.t("Target"), value: this.nodeLabel(edge.target) },
            { displayName: this.t("Type"), value: edge.type || this.t("Missing") },
            { displayName: this.t("Details"), value: this.edgeDescription(edge) },
            { displayName: this.t("Rows"), value: String(edge.rows.length) },
            ...tooltipValues(this.data, edge, this.host.locale, this.t("Multiple"), this.t("Missing"))
        ];
        if (this.data.graph.hasHighlights) items.push({
            displayName: this.t("Highlight"),
            value: edge.highlightWeight === null ? this.t("Missing") : formatValue(edge.highlightWeight, this.data.weightFormat, this.host.locale)
        });
        this.host.tooltipService.show({
            coordinates: [x, y], isTouchEvent: false, dataItems: items,
            identities: identities.ok ? identities.ids : []
        });
    }

    private hideTooltip(): void { this.host.tooltipService.hide({ isTouchEvent: false, immediately: true }); }

    private bindContext(node: Element, rows: number[]): void {
        const show = (x: number, y: number): void => {
            if (!this.interactionsAllowed()) return;
            const result = relationshipSelection(rows, this.data.identities);
            const id = result.ok && result.ids.length === 1 ? result.ids[0] : {};
            void Promise.resolve(this.selection.showContextMenu(id, { x, y }))
                .catch(() => { if (!this.destroyed) this.notice.textContent = this.t("ContextFailed"); });
        };
        node.addEventListener("contextmenu", event => {
            event.preventDefault();
            event.stopPropagation();
            if (event instanceof MouseEvent) show(event.clientX, event.clientY);
        });
        node.addEventListener("keydown", event => {
            if (event instanceof KeyboardEvent && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
                event.preventDefault();
                const rect = node.getBoundingClientRect();
                show(rect.left, rect.bottom);
            }
        });
    }

    private interactionsAllowed(): boolean { return this.host.hostCapabilities?.allowInteractions !== false; }

    private selectRows(rows: number[], event: MouseEvent): void {
        if (!this.interactionsAllowed() || this.busy) return;
        const result = relationshipSelection(rows, this.data.identities);
        if (!result.ok) {
            this.notice.textContent = this.t(result.reason === "limit" ? "SelectionLimit" : "SelectionMissing");
            return;
        }
        this.busy = true;
        this.notice.textContent = "";
        void Promise.resolve(this.selection.select(result.ids, event.ctrlKey || event.metaKey))
            .then(() => { if (!this.destroyed) this.syncSelection(); })
            .catch(() => { if (!this.destroyed) this.notice.textContent = this.t("SelectionFailed"); })
            .finally(() => { this.busy = false; });
    }

    private clearSelection(): void {
        if (!this.interactionsAllowed() || this.busy) return;
        this.busy = true;
        void Promise.resolve(this.selection.clear())
            .then(() => { if (!this.destroyed) { this.notice.textContent = ""; this.syncSelection(); } })
            .catch(() => { if (!this.destroyed) this.notice.textContent = this.t("SelectionFailed"); })
            .finally(() => { this.busy = false; });
    }

    private syncSelection(): void {
        this.selected = this.selection.getSelectionIds().filter(isSelectionId);
        this.styleSelection();
    }

    private selectionState(rows: number[]): "true" | "false" | "mixed" {
        const flags = rows.map(row => {
            const id = this.data.identities.get(row);
            return id && this.selected.some(selected => selected.includes(id));
        });
        return flags.every(Boolean) && flags.length > 0 ? "true" : flags.some(Boolean) ? "mixed" : "false";
    }

    private styleSelection(): void {
        const graph = this.data.graph;
        const query = this.search.value.trim().toLocaleLowerCase(this.host.locale);
        for (const node of this.root.querySelectorAll<HTMLElement | SVGElement>("[data-node-id]")) {
            const id = node.dataset.nodeId!;
            const rows = incidentRows(graph, id);
            const state = this.selectionState(rows);
            node.classList.toggle("selected", state !== "false");
            node.classList.toggle("local-focus", id === this.focusId && this.mode !== "all");
            node.classList.toggle("search-match", !!query && this.nodeLabel(id).toLocaleLowerCase(this.host.locale).includes(query));
            const highlighted = graph.edges.some(edge => (edge.source === id || edge.target === id) && edge.highlighted);
            node.classList.toggle("dimmed", (this.selected.length > 0 && state === "false") || (graph.hasHighlights && !highlighted));
            node.setAttribute("aria-pressed", state);
        }
        for (const node of this.root.querySelectorAll<HTMLElement | SVGElement>("[data-edge-id]")) {
            const edge = graph.edges.find(edge => edge.id === node.dataset.edgeId);
            if (!edge) continue;
            const state = this.selectionState(edge.rows);
            node.classList.toggle("selected", state !== "false");
            node.classList.toggle("dimmed", (this.selected.length > 0 && state === "false") || (graph.hasHighlights && !edge.highlighted));
            if (node instanceof HTMLButtonElement) node.setAttribute("aria-pressed", state);
        }
    }

    private localFocusChanged(): void {
        this.page = 0;
        this.autoFit = true;
        this.renderGraph();
        this.renderList();
        this.renderStatus();
        this.fit();
    }

    private plotSize(): { width: number; height: number } {
        const rect = this.svg.getBoundingClientRect();
        return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
    }

    private fit(): void {
        let bounds = this.layout.bounds;
        if (this.mode !== "all") {
            const visible = this.visibleIds();
            bounds = layoutBounds({
                ...this.data.graph, nodes: this.data.graph.nodes.filter(node => visible.has(node.id)),
                edges: this.visibleEdges()
            }, this.layout.positions);
        }
        const size = this.plotSize();
        this.camera.scale = Math.min(2, Math.max(0.001, Math.min(size.width / bounds.width, size.height / bounds.height) * 0.94));
        this.camera.x = size.width / 2 - (bounds.x + bounds.width / 2) * this.camera.scale;
        this.camera.y = size.height / 2 - (bounds.y + bounds.height / 2) * this.camera.scale;
        this.transform();
    }

    private zoom(factor: number, x?: number, y?: number): void {
        const size = this.plotSize();
        const anchorX = x ?? size.width / 2;
        const anchorY = y ?? size.height / 2;
        const scale = Math.max(0.001, Math.min(8, this.camera.scale * factor));
        const ratio = scale / this.camera.scale;
        this.camera.x = anchorX - (anchorX - this.camera.x) * ratio;
        this.camera.y = anchorY - (anchorY - this.camera.y) * ratio;
        this.camera.scale = scale;
        this.autoFit = false;
        this.transform();
    }

    private transform(): void {
        this.world.setAttribute("transform", `translate(${this.camera.x},${this.camera.y}) scale(${this.camera.scale})`);
    }

    private bindCamera(): void {
        this.bindContext(this.svg, []);
        this.svg.addEventListener("wheel", event => {
            event.preventDefault();
            const rect = this.svg.getBoundingClientRect();
            this.zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - rect.left, event.clientY - rect.top);
        }, { passive: false });
        this.svg.addEventListener("pointerdown", event => {
            if (event.button !== 0 || (event.target instanceof Element && event.target.closest(".network-node, .network-edge"))) return;
            this.dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
            this.svg.setPointerCapture(event.pointerId);
        });
        this.svg.addEventListener("pointermove", event => {
            if (!this.dragging || event.pointerId !== this.dragging.id) return;
            this.camera.x += event.clientX - this.dragging.x;
            this.camera.y += event.clientY - this.dragging.y;
            this.dragging.x = event.clientX;
            this.dragging.y = event.clientY;
            this.autoFit = false;
            this.transform();
        });
        this.svg.addEventListener("pointerup", () => { this.dragging = undefined; });
        this.svg.addEventListener("pointercancel", () => { this.dragging = undefined; });
        this.svg.addEventListener("keydown", event => {
            const movement: Record<string, [number, number]> = { ArrowLeft: [30, 0], ArrowRight: [-30, 0], ArrowUp: [0, 30], ArrowDown: [0, -30] };
            if (movement[event.key]) {
                event.preventDefault();
                this.camera.x += movement[event.key][0];
                this.camera.y += movement[event.key][1];
                this.autoFit = false;
                this.transform();
            } else if (event.key === "+" || event.key === "=" || event.key === "-") {
                event.preventDefault();
                this.zoom(event.key === "-" ? 0.8 : 1.25);
            } else if (event.key === "Home") {
                event.preventDefault();
                this.autoFit = true;
                this.fit();
            }
        });
    }

    public destroy(): void {
        this.destroyed = true;
        this.hideTooltip();
        this.selection.registerOnSelectCallback(() => { /* Host exposes no unregister API. */ });
        this.dragging = undefined;
        this.root.remove();
    }
}
