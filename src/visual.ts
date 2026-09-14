import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { createFormatter, NetworkData, readData, tooltipValues } from "./data";
import { FocusMode, GraphEdge, GraphIndex, indexGraph, reachable, shortestPath } from "./graph";
import { Layout, layoutBounds, layoutGraph, topologySignature } from "./layout";
import { parseSavedView, SavedView, ViewPreference } from "./navigation";
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
    return !!id && typeof id === "object" && "includes" in id && typeof id.includes === "function" && "getKey" in id && typeof id.getKey === "function";
}

export class Visual implements powerbi.extensibility.visual.IVisual {
    private readonly host: Host;
    private readonly root: HTMLDivElement;
    private readonly toolbar = element("div", "network-toolbar");
    private readonly tools = element("details", "network-tools");
    private readonly status = element("div", "network-status");
    private readonly notice = element("div", "network-notice");
    private readonly body = element("div", "network-body");
    private readonly plot = element("div", "network-plot");
    private readonly caption = element("div", "network-caption");
    private readonly svg = svgElement("svg", { class: "network-svg", tabindex: "0", role: "group" });
    private readonly world = svgElement("g");
    private readonly list = element("div", "network-list");
    private readonly listContent = element("div", "network-list-content");
    private readonly pager = element("div", "network-pager");
    private readonly search = element("input");
    private readonly entity = element("select");
    private readonly focusMode = element("select");
    private readonly pathTarget = element("select");
    private readonly viewButton: HTMLButtonElement;
    private readonly selection: powerbi.extensibility.ISelectionManager;
    private readonly formatting: FormattingSettingsService;
    private readonly localization: powerbi.extensibility.ILocalizationManager;
    private settings = new Settings();
    private data: NetworkData;
    private layout: Layout;
    private index: GraphIndex;
    private visible = new Set<string>();
    private shownEdges: GraphEdge[] = [];
    private nodeElements = new Map<string, SVGGElement>();
    private edgeElements = new Map<string, SVGGElement>();
    private labels = new Map<string, { element: SVGTextElement; width: number }>();
    private descriptions = new Map<string, string>();
    private displayLabels = new Map<string, string>();
    private weightLabel: (value: powerbi.PrimitiveValue) => string;
    private selected: powerbi.visuals.ISelectionId[] = [];
    private selectedRows = new Set<number>();
    private focusId = "";
    private mode: FocusMode = "all";
    private targetId = "";
    private viewPreference: ViewPreference = "auto";
    private configuredView: ViewPreference = "auto";
    private savedViewValue: string | undefined;
    private compact: boolean | undefined;
    private toolsOpen = false;
    private tooltipTouch = false;
    private listMode: "entities" | "relationships" = "entities";
    private page = 0;
    private viewport = { width: 800, height: 500 };
    private lastPlotSize = { width: 800, height: 500 };
    private camera = { x: 0, y: 0, scale: 1 };
    private autoFit = true;
    private pointers = new Map<number, { x: number; y: number; startX: number; startY: number }>();
    private suppressClickUntil = 0;
    private readonly markerId = `atlyn-arrow-${++instance}`;
    private destroyed = false;
    private busy = false;
    private pendingClear = false;

    constructor(options?: powerbi.extensibility.visual.VisualConstructorOptions) {
        if (!options) throw new Error("Power BI visual constructor options are required.");
        this.host = options.host;
        this.selection = this.host.createSelectionManager();
        this.localization = this.host.createLocalizationManager();
        this.formatting = new FormattingSettingsService(this.localization);
        this.data = readData(undefined, this.host);
        this.layout = layoutGraph(this.data.graph);
        this.index = indexGraph(this.data.graph);
        this.weightLabel = createFormatter(undefined, this.host.locale);
        this.root = element("div", "atlyn-network");
        this.root.dir = /^(ar|he|fa|ur)(-|$)/i.test(this.host.locale) ? "rtl" : "ltr";
        this.root.setAttribute("aria-label", this.t("Title"));
        this.root.setAttribute("role", "region");
        this.root.lang = this.host.locale || "en-US";
        this.status.setAttribute("role", "status");
        this.status.setAttribute("aria-live", "polite");
        this.status.tabIndex = 0;
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
        help.addEventListener("toggle", () => {
            if (!this.destroyed && this.autoFit) this.fit();
        }, true);
        const header = element("div", "network-header");
        this.viewButton = this.button("ViewList", "toggle-view", () => {
            const current = this.currentView();
            this.viewPreference = current === "list" ? "graph" : current === "graph" && !this.compact ? "split" : "list";
            this.applyResponsive();
            if (this.autoFit) this.fit();
            else this.transform();
        });
        this.viewButton.setAttribute("aria-label", this.t("ToggleView"));
        header.append(help, this.viewButton);
        const tabs = element("div", "network-tabs");
        tabs.append(
            this.button("Entities", "entities", () => this.switchList("entities")),
            this.button("Relationships", "relationships", () => this.switchList("relationships"))
        );
        this.list.append(tabs, this.listContent, this.pager);
        this.svg.append(this.world);
        this.caption.tabIndex = 0;
        this.plot.append(this.svg, this.caption);
        this.body.append(this.plot, this.list);
        this.root.append(header, this.tools, this.status, this.notice, this.body);
        options.element.append(this.root);
        this.bindCamera();
        this.root.addEventListener("contextmenu", event => {
            event.preventDefault();
            if (!this.interactionsAllowed()) return;
            const clientX = "clientX" in event && typeof event.clientX === "number" ? event.clientX : 0;
            const clientY = "clientY" in event && typeof event.clientY === "number" ? event.clientY : 0;
            void this.hostAction(() => this.selection.showContextMenu({}, { x: clientX, y: clientY }))
                .catch(() => { if (!this.destroyed) this.notice.textContent = this.t("ContextFailed"); });
        });
        this.selection.registerOnSelectCallback(() => {
            void Promise.resolve().then(() => { if (!this.destroyed) this.syncSelection(); })
                .catch(() => { if (!this.destroyed) this.notice.textContent = this.t("SelectionFailed"); });
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
        const modes: [FocusMode, MessageKey][] = [["all", "All"], ["neighbors", "Neighbors"], ["incident", "Incident"], ["upstream", "Upstream"], ["downstream", "Downstream"], ["path", "Path"]];
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
        this.pathTarget.dataset.control = "path-target";
        this.pathTarget.setAttribute("aria-label", this.t("PathTarget"));
        this.pathTarget.hidden = true;
        this.pathTarget.addEventListener("change", () => {
            this.targetId = this.pathTarget.value;
            this.localFocusChanged();
        });
        this.toolbar.append(
            this.search, this.entity, this.focusMode, this.pathTarget,
            this.button("ResetFocus", "reset-focus", () => {
                this.mode = "all";
                this.focusMode.value = "all";
                this.search.value = "";
                this.localFocusChanged();
            }),
            this.button("Fit", "fit", () => { this.autoFit = true; this.fit(); }),
            this.button("ZoomIn", "zoom-in", () => this.zoom(1.25)),
            this.button("ZoomOut", "zoom-out", () => this.zoom(0.8)),
            this.button("ClearSelection", "clear-selection", () => this.clearSelection()),
            this.button("SaveView", "save-view", () => this.saveView())
        );
        const summary = element("summary");
        summary.textContent = this.t("Controls");
        this.tools.append(summary, this.toolbar);
        this.tools.addEventListener("toggle", () => {
            if (this.tools.open === this.toolsOpen) return;
            this.toolsOpen = this.tools.open;
            if (!this.destroyed && this.autoFit) this.fit();
        });
    }

    private currentView(): Exclude<ViewPreference, "auto"> {
        if (this.viewPreference !== "auto") return this.viewPreference;
        if (this.viewport.width < 180 || this.viewport.height < 150) return "list";
        return this.compact ? "graph" : "split";
    }

    private applyResponsive(): void {
        const compact = this.viewport.width < 700 || this.viewport.height < 320;
        if (this.compact !== compact) {
            this.tools.open = !compact;
            this.toolsOpen = this.tools.open;
        }
        this.compact = compact;
        this.root.classList.toggle("compact", compact);
        this.root.classList.toggle("tiny", this.viewport.width < 300 || this.viewport.height < 260);
        this.root.classList.toggle("micro", this.viewport.width < 180 || this.viewport.height < 150);
        const view = this.currentView();
        for (const mode of ["split", "graph", "list"]) this.root.classList.toggle(`view-${mode}`, mode === view);
        this.viewButton.textContent = this.t(view === "list" ? "ViewGraph" : view === "graph" && !compact ? "ViewSplit" : "ViewList");
        this.viewButton.title = `${this.t("ToggleView")}: ${this.t(view === "list" ? "ViewList" : view === "graph" ? "ViewGraph" : "ViewSplit")}`;
    }

    private saveView(): void {
        if (!this.interactionsAllowed()) {
            this.notice.textContent = this.t("InteractionsDisabled");
            return;
        }
        const size = this.plotSize();
        const state: SavedView = {
            version: 1, focus: this.focusId, target: this.targetId, mode: this.mode,
            search: this.search.value, view: this.viewPreference,
            centerX: (size.width / 2 - this.camera.x) / this.camera.scale,
            centerY: (size.height / 2 - this.camera.y) / this.camera.scale, scale: this.camera.scale
        };
        void Promise.resolve().then(() => {
            if (!this.destroyed) this.host.persistProperties({
                merge: [{ objectName: "navigation", selector: {}, properties: { savedView: JSON.stringify(state) } }]
            });
        }).then(() => {
            if (!this.destroyed) this.notice.textContent = this.t("SavedView");
        }).catch(() => {
            if (!this.destroyed) this.notice.textContent = this.t("SaveFailed");
        });
    }

    private restoreView(view: powerbi.DataView | undefined): SavedView | undefined {
        if (!view) return undefined;
        const value = view.metadata.objects?.navigation?.savedView;
        if (value === this.savedViewValue) return undefined;
        const state = typeof value === "string" ? parseSavedView(value) : null;
        this.savedViewValue = typeof value === "string" ? value : undefined;
        if (!state || (state.focus && !this.index.nodes.has(state.focus)) || (state.target && !this.index.nodes.has(state.target))) {
            this.mode = "all";
            this.search.value = "";
            this.viewPreference = this.configuredView;
            this.autoFit = true;
            if (value !== undefined) this.notice.textContent = this.t("BadSavedView");
            return undefined;
        }
        this.focusId = state.focus;
        this.targetId = state.target;
        this.mode = state.mode;
        this.search.value = state.search;
        this.viewPreference = state.view;
        this.autoFit = false;
        return state;
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
            if (!Number.isFinite(options.viewport.width) || !Number.isFinite(options.viewport.height)) throw new Error("Viewport dimensions must be finite.");
            this.hideTooltip();
            this.viewport = {
                width: Math.max(0, options.viewport.width),
                height: Math.max(0, options.viewport.height)
            };
            this.root.style.width = `${this.viewport.width}px`;
            this.root.style.height = `${this.viewport.height}px`;
            const view = options.dataViews?.[0];
            // Resize-only host calls may omit dataViews. Data updates without a view must clear stale data.
            if (view || (options.type & powerbi.VisualUpdateType.Data)) {
                this.data = readData(view, this.host);
                this.index = indexGraph(this.data.graph);
                this.refreshDisplayLabels();
                this.descriptions.clear();
                this.weightLabel = createFormatter(this.data.weightFormat, this.host.locale);
                this.settings = view ? this.formatting.populateFormattingSettingsModel(Settings, view) : new Settings();
            }
            const configured = this.settings.exploration.view.value.value;
            if (configured !== this.configuredView && (configured === "auto" || configured === "split" || configured === "graph" || configured === "list")) {
                this.configuredView = configured;
                this.viewPreference = configured;
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
            if (!this.index.nodes.has(this.targetId)) this.targetId = this.data.graph.nodes[this.data.graph.nodes.length - 1]?.id ?? "";
            const restored = this.restoreView(view);
            this.applyResponsive();
            this.populateEntities();
            this.applyTheme();
            this.renderGraph();
            this.renderList();
            this.syncSelection();
            this.renderStatus();
            if (restored) {
                const size = this.plotSize();
                this.camera = { scale: restored.scale, x: size.width / 2 - restored.centerX * restored.scale, y: size.height / 2 - restored.centerY * restored.scale };
                this.transform();
            } else if (this.autoFit) this.fit();
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
            this.pager.replaceChildren();
            this.data = readData(undefined, this.host);
            this.index = indexGraph(this.data.graph);
            this.layout = layoutGraph(this.data.graph);
            this.nodeElements.clear();
            this.edgeElements.clear();
            this.labels.clear();
            this.displayLabels.clear();
            this.visible.clear();
            this.shownEdges = [];
            this.mode = "all";
            this.focusId = "";
            this.targetId = "";
            this.populateEntities();
            this.caption.textContent = "";
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
        this.pathTarget.replaceChildren();
        for (const node of this.data.graph.nodes) {
            const option = element("option");
            option.value = node.id;
            option.textContent = this.nodeLabel(node.id);
            this.entity.append(option);
            this.pathTarget.append(option.cloneNode(true));
        }
        this.entity.value = this.focusId;
        this.pathTarget.value = this.targetId;
        this.focusMode.value = this.mode;
        this.pathTarget.hidden = this.mode !== "path";
        this.entity.disabled = !this.data.graph.nodes.length;
        this.focusMode.disabled = !this.data.graph.nodes.length;
        this.pathTarget.disabled = !this.data.graph.nodes.length;
    }

    private refreshDisplayLabels(): void {
        this.displayLabels.clear();
        const names = new Map<string, number>();
        for (const node of this.data.graph.nodes) names.set(node.label, (names.get(node.label) ?? 0) + 1);
        for (const node of this.data.graph.nodes) {
            const hasControl = Array.from(node.label).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
            let label = node.label.trim() !== node.label || hasControl ? JSON.stringify(node.label) : node.label;
            if (names.get(node.label)! > 1) label += ` [${this.t(node.id.startsWith("n:") ? "NumberId" : "TextId")}]`;
            this.displayLabels.set(node.id, label);
        }
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

    private refreshFocus(): void {
        const path = this.mode === "path" ? shortestPath(this.data.graph, this.focusId, this.targetId) : undefined;
        this.visible = path ? new Set(path.nodes) : reachable(this.data.graph, this.focusId, this.mode);
        const pathEdges = new Set(path?.edges);
        this.shownEdges = this.data.graph.edges.filter(edge =>
            this.visible.has(edge.source) && this.visible.has(edge.target) &&
            (this.mode !== "incident" || edge.source === this.focusId || edge.target === this.focusId) &&
            (!path || pathEdges.has(edge.id)));
    }

    private renderGraph(): void {
        this.refreshFocus();
        this.world.replaceChildren();
        this.nodeElements.clear();
        this.edgeElements.clear();
        this.labels.clear();
        const defs = svgElement("defs");
        const marker = svgElement("marker", {
            id: this.markerId, markerWidth: "8", markerHeight: "8",
            refX: "7", refY: "4", orient: "auto", markerUnits: "userSpaceOnUse"
        });
        marker.append(svgElement("path", { d: "M 0 0 L 8 4 L 0 8 z", fill: "var(--edge)" }));
        defs.append(marker);
        this.world.append(defs);
        const edges = this.shownEdges;
        const maxWeight = Math.max(1, ...this.data.graph.edges.map(edge => edge.weight ?? 0));
        for (const edge of edges) {
            const group = svgElement("g", { class: "network-edge", "data-edge-id": edge.id });
            const path = this.layout.routes.get(edge.id)!.path;
            const line = svgElement("path", {
                d: path, fill: "none", stroke: "var(--edge)",
                "stroke-width": edge.missingWeight || edge.weight === null ? "1.5" : String(1.5 + Math.sqrt(edge.weight / maxWeight) * 3),
                "marker-end": `url(#${this.markerId})`
            });
            const hit = svgElement("path", { d: path, fill: "none", stroke: "transparent", "stroke-width": "14", "vector-effect": "non-scaling-stroke", class: "edge-hit" });
            const title = svgElement("title");
            title.textContent = this.edgeDescription(edge);
            group.append(title, line, hit);
            group.addEventListener("click", event => {
                event.stopPropagation();
                if (event.detail === 0 || event.timeStamp > this.suppressClickUntil) this.selectRows(edge.rows, event);
            });
            group.addEventListener("pointerenter", event => this.showTooltip(edge, event.clientX, event.clientY, event.pointerType === "touch"));
            group.addEventListener("pointerleave", () => this.hideTooltip());
            this.bindContext(group, edge.rows);
            this.world.append(group);
            this.edgeElements.set(edge.id, group);
        }
        for (const node of this.data.graph.nodes.filter(node => this.visible.has(node.id))) {
            const point = this.layout.positions.get(node.id)!;
            const group = svgElement("g", {
                class: "network-node", "data-node-id": node.id,
                transform: `translate(${point.x},${point.y})`, role: "button",
                "aria-label": `${this.nodeLabel(node.id)}: ${this.t("SelectNode")}`
            });
            const circle = svgElement("circle", { r: "14", fill: "var(--node)", stroke: "var(--background)", "stroke-width": "2" });
            const title = svgElement("title");
            title.textContent = `${this.nodeLabel(node.id)}: ${this.t("SelectNode")}`;
            group.append(title, circle);
            if (this.settings.appearance.showLabels.value) {
                const label = svgElement("text", { x: "20", y: "5", fill: "var(--foreground)", "text-anchor": "middle" });
                const characters = [...this.nodeLabel(node.id)];
                label.textContent = characters.length > 24 ? `${characters.slice(0, 23).join("")}...` : this.nodeLabel(node.id);
                group.append(label);
                this.labels.set(node.id, { element: label, width: 0 });
            }
            group.addEventListener("click", event => {
                event.stopPropagation();
                if (event.detail === 0 || event.timeStamp > this.suppressClickUntil) this.selectRows(this.index.incident.get(node.id)!, event);
            });
            this.bindContext(group, []);
            this.world.append(group);
            this.nodeElements.set(node.id, group);
        }
        for (const label of this.labels.values()) {
            label.width = label.element.getComputedTextLength();
        }
    }

    private renderStatus(): void {
        const graph = this.data.graph;
        const diagnostics = graph.diagnostics;
        const messages: string[] = [];
        this.root.dataset.incomplete = String(diagnostics.incomplete);
        if (diagnostics.incomplete) messages.push(this.t("Incomplete"));
        if (this.data.bindingMissing) messages.push(this.t("Bind"));
        else if (!graph.edges.length) messages.push(this.t("Empty"));
        else messages.push(`${this.t("Loaded")}: ${graph.nodes.length} ${this.t("EntityCount")}, ${graph.edges.length} ${this.t("EdgeCount")}.`);
        const fields: [number, MessageKey][] = [
            [diagnostics.invalidIds, "InvalidIds"], [diagnostics.duplicateRows, "Duplicates"],
            [diagnostics.ambiguousIds, "Ambiguous"], [diagnostics.missingWeights, "MissingWeights"],
            [diagnostics.omittedRows, "OmittedRows"], [diagnostics.omittedEdges, "OmittedEdges"]
        ];
        for (const [count, key] of fields) if (count) messages.push(`${this.t(key)}: ${count}.`);
        if (this.data.identityMissing) messages.push(this.t("MissingIdentities"));
        if (this.data.tooltipLimited) messages.push(this.t("TooltipLimit"));
        if (this.mode !== "all") messages.push(this.t("FocusNotice"));
        if (this.mode === "path" && !this.visible.size) messages.push(this.t("NoPath"));
        if (!this.interactionsAllowed()) messages.push(this.t("InteractionsDisabled"));
        if (this.viewport.width < 180 || this.viewport.height < 150) messages.push(this.t("MicroHelp"));
        this.status.textContent = messages.join(" ");
        this.status.title = this.status.textContent;
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
        const matches = new Set(this.data.graph.nodes.filter(node => this.nodeLabel(node.id).toLocaleLowerCase(this.host.locale).includes(query)).map(node => node.id));
        const nodes = this.data.graph.nodes.filter(node => this.visible.has(node.id) && matches.has(node.id));
        const edges = this.shownEdges.filter(edge => matches.has(edge.source) || matches.has(edge.target));
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
                name.textContent = this.nodeLabel(node.id);
                name.dir = "auto";
                const actions = element("div", "list-actions");
                const focus = this.button("Focus", "focus-node", () => {
                    this.focusId = node.id;
                    this.entity.value = node.id;
                    this.mode = "neighbors";
                    this.focusMode.value = this.mode;
                    if (this.currentView() === "list") this.viewPreference = this.compact ? "graph" : "split";
                    this.applyResponsive();
                    this.localFocusChanged();
                    if (this.tools.open) this.entity.focus();
                    else this.svg.focus();
                });
                focus.dataset.focusKey = node.id;
                const rows = this.index.incident.get(node.id)!;
                const select = this.button("SelectNode", "select-node", event => this.selectRows(rows, event));
                select.dataset.nodeId = node.id;
                select.dataset.focusKey = node.id;
                select.setAttribute("aria-label", `${this.nodeLabel(node.id)}: ${this.t("SelectNode")}`);
                this.bindContext(select, []);
                const inspect = this.button("ShowIncident", "incident-node", () => {
                    this.focusId = node.id;
                    this.mode = "incident";
                    this.listMode = "relationships";
                    this.localFocusChanged();
                    this.listContent.querySelector<HTMLButtonElement>("button")?.focus();
                });
                inspect.dataset.focusKey = node.id;
                const counts = element("p", "entity-counts");
                const incoming = this.index.incoming.get(node.id)!;
                const outgoing = this.index.outgoing.get(node.id)!;
                const count = new Set([...incoming, ...outgoing].map(edge => edge.id)).size;
                counts.textContent = `${incoming.length} ${this.t("Incoming")} / ${outgoing.length} ${this.t("Outgoing")}; ${count} ${this.t("IncidentCount")}`;
                const native = relationshipSelection(rows, this.data.identities);
                if (!native.ok) {
                    select.setAttribute("aria-disabled", "true");
                    select.title = this.t(native.reason === "limit" ? "SelectionLimit" : "SelectionMissing");
                }
                actions.append(focus, inspect, select);
                row.append(name, counts, actions);
                items.append(row);
            }
        } else {
            for (const edge of edges.slice(start, start + PAGE_SIZE)) {
                const row = element("li");
                const select = this.button("SelectEdge", "select-edge", event => this.selectRows(edge.rows, event));
                select.textContent = this.edgeDescription(edge);
                select.dataset.edgeId = edge.id;
                select.dataset.focusKey = edge.id;
                const native = relationshipSelection(edge.rows, this.data.identities);
                if (!native.ok) {
                    select.setAttribute("aria-disabled", "true");
                    select.title = this.t(native.reason === "limit" ? "SelectionLimit" : "SelectionMissing");
                }
                select.addEventListener("focus", () => {
                    const rect = select.getBoundingClientRect();
                    this.showTooltip(edge, rect.left, rect.bottom);
                });
                select.addEventListener("blur", () => this.hideTooltip());
                this.bindContext(select, edge.rows);
                row.append(select);
                const details = tooltipValues(this.data, edge, this.host.locale, this.t("Multiple"), this.t("Missing"), this.t("TooltipLimit"));
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
            empty.textContent = this.t(this.mode === "path" && !this.visible.size ? "NoPath" : "NoResults");
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
        this.styleSelection(false);
    }

    private nodeLabel(id: string): string { return this.displayLabels.get(id) ?? this.index.nodes.get(id)?.label ?? id; }

    private edgeDescription(edge: GraphEdge): string {
        const cached = this.descriptions.get(edge.id);
        if (cached) return cached;
        const weight = !this.data.graph.weighted ? this.t("Unweighted") : edge.weightOverflow ? this.t("OverflowWeight") : `${this.t(edge.missingWeight ? "IncompleteWeight" : "Weight")}: ${edge.weight === null ? this.t("Missing") : this.weightLabel(edge.weight)}`;
        const text = `${this.nodeLabel(edge.source)} \u2192 ${this.nodeLabel(edge.target)}${edge.type ? ` [${edge.type}]` : ""}${edge.edgeId !== undefined ? `; ${this.t("Role_Edge")}: ${edge.edgeId}` : ""}; ${weight}`;
        this.descriptions.set(edge.id, text);
        return text;
    }

    private showTooltip(edge: GraphEdge, x: number, y: number, isTouch = false): void {
        if (this.destroyed) return;
        let enabled: boolean;
        try { enabled = this.host.tooltipService.enabled(); } catch {
            this.notice.textContent = this.t("TooltipFailed");
            return;
        }
        if (!enabled) return;
        const identities = relationshipSelection(edge.rows, this.data.identities);
        const items = [
            { displayName: this.t("Source"), value: this.nodeLabel(edge.source) },
            { displayName: this.t("Target"), value: this.nodeLabel(edge.target) },
            { displayName: this.t("Type"), value: edge.type || this.t("Missing") },
            { displayName: this.t("Details"), value: this.edgeDescription(edge) },
            { displayName: this.t("Rows"), value: String(edge.rows.length) },
            ...tooltipValues(this.data, edge, this.host.locale, this.t("Multiple"), this.t("Missing"), this.t("TooltipLimit"))
        ];
        if (this.data.hasWeightHighlights) items.push({
            displayName: this.t("Highlight"),
            value: edge.highlightWeight === null ? this.t("Missing") : this.weightLabel(edge.highlightWeight)
        });
        this.tooltipTouch = isTouch;
        try {
            this.host.tooltipService.show({
                coordinates: [x, y], isTouchEvent: isTouch, dataItems: items,
                identities: identities.ok ? identities.ids : []
            });
        } catch {
            this.notice.textContent = this.t("TooltipFailed");
        }
    }

    private hideTooltip(cleanup = false): void {
        if (this.destroyed && !cleanup) return;
        try { this.host.tooltipService.hide({ isTouchEvent: this.tooltipTouch, immediately: true }); } catch (error) {
            if (this.destroyed) throw error;
            this.notice.textContent = this.t("TooltipFailed");
        }
    }

    private bindContext(node: Element, rows: number[]): void {
        const show = (x: number, y: number): void => {
            if (!this.interactionsAllowed()) return;
            const result = relationshipSelection(rows, this.data.identities);
            const id = result.ok && result.ids.length === 1 ? result.ids[0] : {};
            void this.hostAction(() => this.selection.showContextMenu(id, { x, y }))
                .catch(() => { if (!this.destroyed) this.notice.textContent = this.t("ContextFailed"); });
        };
        node.addEventListener("contextmenu", event => {
            event.preventDefault();
            event.stopPropagation();
            const clientX = "clientX" in event && typeof event.clientX === "number" ? event.clientX : 0;
            const clientY = "clientY" in event && typeof event.clientY === "number" ? event.clientY : 0;
            show(clientX, clientY);
        });
        node.addEventListener("keydown", event => {
            if (event instanceof KeyboardEvent && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
                event.preventDefault();
                event.stopPropagation();
                const rect = node.getBoundingClientRect();
                show(rect.left, rect.bottom);
            }
        });
    }

    private interactionsAllowed(): boolean { return this.host.hostCapabilities?.allowInteractions !== false; }

    private hostAction<T>(action: () => powerbi.IPromise<T>): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.destroyed) { resolve(); return; }
            action().then(() => resolve(), error => reject(error));
        });
    }

    private selectRows(rows: number[], event: MouseEvent): void {
        if (!this.interactionsAllowed() || this.busy) {
            this.notice.textContent = this.t(this.busy ? "SelectionBusy" : "InteractionsDisabled");
            return;
        }
        const result = relationshipSelection(rows, this.data.identities);
        if (!result.ok) {
            this.notice.textContent = this.t(result.reason === "limit" ? "SelectionLimit" : "SelectionMissing");
            return;
        }
        this.busy = true;
        this.notice.textContent = "";
        void this.hostAction(() => this.selection.select(result.ids, event.ctrlKey || event.metaKey))
            .then(() => { if (!this.destroyed) this.syncSelection(); })
            .catch(() => { if (!this.destroyed) this.notice.textContent = this.t("SelectionFailed"); })
            .finally(() => {
                this.busy = false;
                if (this.pendingClear && !this.destroyed) { this.pendingClear = false; this.clearSelection(); }
            });
    }

    private clearSelection(): void {
        if (!this.interactionsAllowed() || this.busy) {
            if (this.busy) this.pendingClear = true;
            this.notice.textContent = this.t(this.busy ? "SelectionBusy" : "InteractionsDisabled");
            return;
        }
        this.busy = true;
        void this.hostAction(() => this.selection.clear())
            .then(() => { if (!this.destroyed) { this.notice.textContent = ""; this.syncSelection(); } })
            .catch(() => { if (!this.destroyed) this.notice.textContent = this.t("SelectionFailed"); })
            .finally(() => { this.busy = false; this.pendingClear = false; });
    }

    private syncSelection(): void {
        const incoming = this.selection.getSelectionIds();
        this.selected = incoming.filter(isSelectionId);
        if (incoming.length !== this.selected.length) this.notice.textContent = this.t("SelectionMissing");
        const keys = new Set(this.selected.map(id => id.getKey()));
        this.selectedRows.clear();
        if (this.selected.length) for (const [row, id] of this.data.identities) {
            if (keys.has(id.getKey()) || this.selected.some(selected => selected.includes(id))) this.selectedRows.add(row);
        }
        this.styleSelection();
    }

    private selectionState(rows: number[]): "true" | "false" | "mixed" {
        let count = 0;
        for (const row of rows) if (this.selectedRows.has(row)) count++;
        return count && count === rows.length ? "true" : count ? "mixed" : "false";
    }

    private styleSelection(graphMarks = true): void {
        const graph = this.data.graph;
        const query = this.search.value.trim().toLocaleLowerCase(this.host.locale);
        const nodes: (HTMLElement | SVGElement)[] = [
            ...(graphMarks ? this.nodeElements.values() : []),
            ...this.list.querySelectorAll<HTMLElement>("[data-node-id]")
        ];
        for (const node of nodes) {
            const id = node.dataset.nodeId!;
            const rows = this.index.incident.get(id) ?? [];
            const state = this.selectionState(rows);
            node.classList.toggle("selected", state !== "false");
            node.classList.toggle("local-focus", id === this.focusId && this.mode !== "all");
            node.classList.toggle("search-match", !!query && this.nodeLabel(id).toLocaleLowerCase(this.host.locale).includes(query));
            const highlighted = this.index.highlightedNodes.has(id);
            node.classList.toggle("dimmed", (this.selected.length > 0 && state === "false") || (graph.hasHighlights && !highlighted));
            node.setAttribute("aria-pressed", state);
        }
        const edges: (HTMLElement | SVGElement)[] = [
            ...(graphMarks ? this.edgeElements.values() : []),
            ...this.list.querySelectorAll<HTMLElement>("[data-edge-id]")
        ];
        for (const node of edges) {
            const edge = this.index.edges.get(node.dataset.edgeId!);
            if (!edge) continue;
            const state = this.selectionState(edge.rows);
            node.classList.toggle("selected", state !== "false");
            node.classList.toggle("dimmed", (this.selected.length > 0 && state === "false") || (graph.hasHighlights && !edge.highlighted));
            if (node instanceof HTMLButtonElement) node.setAttribute("aria-pressed", state);
        }
        if (graphMarks) this.placeLabels();
    }

    private placeLabels(): void {
        const size = this.plotSize();
        const scale = this.camera.scale;
        const fontSize = Math.max(8, Math.min(24, Number.isFinite(this.settings.appearance.labelSize.value) ? this.settings.appearance.labelSize.value : 12));
        const query = this.search.value.trim().toLocaleLowerCase(this.host.locale);
        const priority = (id: string): number => (id === this.focusId && this.mode !== "all" ? 8 : 0) +
            (this.selectionState(this.index.incident.get(id) ?? []) !== "false" ? 4 : 0) +
            (query && this.nodeLabel(id).toLocaleLowerCase(this.host.locale).includes(query) ? 2 : 0);
        const ordered = [...this.labels].sort(([a], [b]) => priority(b) - priority(a) || (a < b ? -1 : a > b ? 1 : 0));
        type Rectangle = { x: number; y: number; width: number; height: number };
        const overlaps = (a: Rectangle, b: Rectangle): boolean =>
            a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        const centers = new Map([...this.visible].map(id => {
            const point = this.layout.positions.get(id)!;
            return [id, { x: this.camera.x + point.x * scale, y: this.camera.y + point.y * scale }];
        }));
        const circles = [...centers.values()].map(point => ({
            x: point.x - 14 * scale - 2, y: point.y - 14 * scale - 2,
            width: 28 * scale + 4, height: 28 * scale + 4
        }));
        const placed: Rectangle[] = [];
        for (const [id, label] of ordered) {
            const center = centers.get(id)!;
            label.element.style.display = "";
            if (!label.width) label.width = label.element.getComputedTextLength();
            const width = label.width + 6;
            const height = fontSize + 6;
            const radius = 14 * scale + 6;
            const candidates: Rectangle[] = [
                { x: center.x + radius, y: center.y - height / 2, width, height },
                { x: center.x - width / 2, y: center.y + radius, width, height },
                { x: center.x - radius - width, y: center.y - height / 2, width, height },
                { x: center.x - width / 2, y: center.y - radius - height, width, height }
            ];
            const candidate = this.settings.appearance.avoidLabelOverlap.value ? candidates.find(rect =>
                rect.x >= 3 && rect.y >= 3 && rect.x + rect.width <= size.width - 3 && rect.y + rect.height <= size.height - 3 &&
                !circles.some(circle => overlaps(rect, circle)) && !placed.some(other => overlaps(rect, other))) : candidates[0];
            if (!candidate) { label.element.style.display = "none"; continue; }
            label.element.setAttribute("transform", `scale(${1 / scale})`);
            label.element.setAttribute("x", String(candidate.x + width / 2 - center.x));
            label.element.setAttribute("y", String(candidate.y + height / 2 + fontSize * 0.34 - center.y));
            placed.push(candidate);
        }
        this.svg.dataset.visibleLabels = String(placed.length);
        this.caption.textContent = this.mode === "path" && !this.visible.size ? this.t("NoPath") :
            `${this.t("Visible")}: ${this.visible.size}/${this.data.graph.nodes.length} ${this.t("EntityCount")}, ${this.shownEdges.length}/${this.data.graph.edges.length} ${this.t("EdgeCount")}. ` +
            (this.labels.size ? `${placed.length}/${this.labels.size} ${this.t("LabelsShown")}. ` : "") +
            (this.mode === "path" ? this.t("PathHelp") : this.visible.size > 40 || this.shownEdges.length > 100 ? this.t("DenseHelp") : "");
        this.caption.title = this.caption.textContent;
    }

    private localFocusChanged(): void {
        this.page = 0;
        this.autoFit = true;
        this.entity.value = this.focusId;
        this.focusMode.value = this.mode;
        this.pathTarget.hidden = this.mode !== "path";
        this.renderGraph();
        this.renderList();
        this.styleSelection();
        this.renderStatus();
        this.fit();
    }

    private plotSize(): { width: number; height: number } {
        const rect = this.svg.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) this.lastPlotSize = { width: rect.width, height: rect.height };
        return this.lastPlotSize;
    }

    private fit(): void {
        const bounds = layoutBounds({
            ...this.data.graph, nodes: this.data.graph.nodes.filter(node => this.visible.has(node.id)),
            edges: this.shownEdges
        }, this.layout.positions, this.layout.routes, 12, false);
        const size = this.plotSize();
        const margin = this.labels.size ? Math.min(size.width * 0.2, 24 + Math.max(0, ...[...this.labels.values()].map(label => label.width)) / 2) : 8;
        this.camera.scale = Math.min(2, Math.max(0.001, Math.min(Math.max(1, size.width - margin * 2) / bounds.width, Math.max(1, size.height - 16) / bounds.height) * 0.94));
        this.camera.x = size.width / 2 - (bounds.x + bounds.width / 2) * this.camera.scale;
        this.camera.y = size.height / 2 - (bounds.y + bounds.height / 2) * this.camera.scale;
        this.transform();
    }

    private zoom(factor: number, x?: number, y?: number): void {
        this.hideTooltip();
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
        this.placeLabels();
    }

    private bindCamera(): void {
        this.bindContext(this.svg, []);
        this.svg.addEventListener("wheel", event => {
            event.preventDefault();
            const rect = this.svg.getBoundingClientRect();
            this.zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - rect.left, event.clientY - rect.top);
        }, { passive: false });
        this.svg.addEventListener("pointerdown", event => {
            if (event.button !== 0) return;
            this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
            if (this.pointers.size > 1) {
                this.suppressClickUntil = event.timeStamp + 500;
                for (const id of this.pointers.keys()) this.svg.setPointerCapture(id);
            }
        });
        this.svg.addEventListener("pointermove", event => {
            const pointer = this.pointers.get(event.pointerId);
            if (!pointer) return;
            const before = [...this.pointers.values()].map(point => ({ ...point }));
            const previouslyMoved = Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > 4;
            const dx = event.clientX - (previouslyMoved ? pointer.x : pointer.startX);
            const dy = event.clientY - (previouslyMoved ? pointer.y : pointer.startY);
            pointer.x = event.clientX;
            pointer.y = event.clientY;
            if (this.pointers.size === 1 && Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) <= 4) return;
            event.preventDefault();
            if (!this.root.classList.contains("panning")) this.hideTooltip();
            this.root.classList.add("panning");
            this.svg.setPointerCapture(event.pointerId);
            this.suppressClickUntil = event.timeStamp + 500;
            if (before.length >= 2) {
                const after = [...this.pointers.values()];
                const rect = this.svg.getBoundingClientRect();
                const oldCenter = { x: (before[0].x + before[1].x) / 2 - rect.left, y: (before[0].y + before[1].y) / 2 - rect.top };
                const center = { x: (after[0].x + after[1].x) / 2 - rect.left, y: (after[0].y + after[1].y) / 2 - rect.top };
                const oldDistance = Math.max(1, Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y));
                const distance = Math.max(1, Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y));
                const scale = Math.max(0.001, Math.min(8, this.camera.scale * distance / oldDistance));
                const ratio = scale / this.camera.scale;
                this.camera.x = center.x - (oldCenter.x - this.camera.x) * ratio;
                this.camera.y = center.y - (oldCenter.y - this.camera.y) * ratio;
                this.camera.scale = scale;
            } else {
                this.camera.x += dx;
                this.camera.y += dy;
            }
            this.autoFit = false;
            this.transform();
        });
        const endPointer = (event: PointerEvent): void => {
            this.pointers.delete(event.pointerId);
            if (this.svg.hasPointerCapture(event.pointerId)) this.svg.releasePointerCapture(event.pointerId);
            if (!this.pointers.size) this.root.classList.remove("panning");
        };
        this.svg.addEventListener("pointerup", endPointer);
        this.svg.addEventListener("pointercancel", endPointer);
        this.svg.addEventListener("lostpointercapture", event => {
            this.pointers.delete(event.pointerId);
            if (!this.pointers.size) this.root.classList.remove("panning");
        });
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
        if (this.destroyed) return;
        this.destroyed = true;
        this.pendingClear = false;
        for (const id of this.pointers.keys()) if (this.svg.hasPointerCapture(id)) this.svg.releasePointerCapture(id);
        this.pointers.clear();
        this.nodeElements.clear();
        this.edgeElements.clear();
        this.labels.clear();
        this.descriptions.clear();
        this.displayLabels.clear();
        this.selectedRows.clear();
        this.selected = [];
        this.data = readData(undefined, this.host);
        this.index = indexGraph(this.data.graph);
        this.layout = layoutGraph(this.data.graph);
        this.root.remove();
        try { this.hideTooltip(true); } finally {
            this.selection.registerOnSelectCallback(() => { /* Host exposes no unregister API. */ });
        }
    }
}
