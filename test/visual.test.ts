import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import powerbi from "powerbi-visuals-api";

vi.mock("powerbi-visuals-api", async (importOriginal) => {
    const mod = await importOriginal<Record<string, unknown>>();
    const api = {
        ...mod,
        VisualUpdateType: { Data: 2, Resize: 4, ViewMode: 8, Style: 16, ResizeEnd: 32, All: 62 },
        ViewMode: { View: 0, Edit: 1, InFocusEdit: 2 },
        visuals: {
            ValidatorType: { Min: 0, Max: 1 }
        }
    };
    return {
        ...api,
        default: api
    };
});

import { Visual } from "../src/visual";

function mockVisualHost() {
    const contextCalls: { id: unknown; position: { x: number; y: number } }[] = [];
    const selectionManager = {
        showContextMenu: vi.fn((id: unknown, position: { x: number; y: number }) => {
            contextCalls.push({ id, position });
            return Promise.resolve();
        }),
        registerOnSelectCallback: vi.fn(),
        getSelectionIds: vi.fn(() => []),
        select: vi.fn(() => Promise.resolve([])),
        clear: vi.fn(() => Promise.resolve())
    };
    const host = {
        locale: "en-US",
        hostCapabilities: { allowInteractions: true },
        createSelectionManager: vi.fn(() => selectionManager),
        createLocalizationManager: vi.fn(() => ({
            getDisplayName: (key: string) => key
        })),
        createSelectionIdBuilder: vi.fn(() => ({
            withCategory: vi.fn().mockReturnThis(),
            createSelectionId: vi.fn(() => ({
                hasIdentity: () => true,
                getKey: () => "test",
                includes: () => false
            }))
        })),
        colorPalette: {
            isHighContrast: false,
            foreground: { value: "#000000" },
            background: { value: "#ffffff" },
            foregroundSelected: { value: "#ff0000" },
            getColor: () => ({ value: "#007d87" })
        },
        tooltipService: {
            enabled: () => true,
            show: vi.fn(),
            hide: vi.fn(),
            move: vi.fn()
        },
        eventService: {
            renderingStarted: vi.fn(),
            renderingFinished: vi.fn(),
            renderingFailed: vi.fn()
        },
        persistProperties: vi.fn()
    } as unknown as powerbi.extensibility.visual.IVisualHost;

    return { host, selectionManager, contextCalls };
}

describe("Visual context menu and empty state", () => {
    it("attaches contextmenu listener to root container calling showContextMenu with empty id", () => {
        const { host, contextCalls } = mockVisualHost();
        const element = document.createElement("div");
        const visual = new Visual({ element, host });

        const root = element.querySelector<HTMLDivElement>(".atlyn-network");
        expect(root).not.toBeNull();

        // Dispatch contextmenu event on the root element
        const event = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 120,
            clientY: 240
        });
        root!.dispatchEvent(event);

        expect(contextCalls).toHaveLength(1);
        expect(contextCalls[0]).toEqual({
            id: {},
            position: { x: 120, y: 240 }
        });

        visual.destroy();
    });

    it("triggers context menu when right-clicking on empty background, header, or status", () => {
        const { host, contextCalls } = mockVisualHost();
        const element = document.createElement("div");
        const visual = new Visual({ element, host });

        const header = element.querySelector<HTMLDivElement>(".network-header");
        expect(header).not.toBeNull();
        header!.dispatchEvent(new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 50,
            clientY: 20
        }));

        expect(contextCalls).toHaveLength(1);
        expect(contextCalls[0]).toEqual({
            id: {},
            position: { x: 50, y: 20 }
        });

        visual.destroy();
    });

    it("displays prompt and clean empty state when required fields are missing", () => {
        const { host } = mockVisualHost();
        const element = document.createElement("div");
        const visual = new Visual({ element, host });

        visual.update({
            viewport: { width: 800, height: 600 },
            viewMode: powerbi.ViewMode.View,
            type: powerbi.VisualUpdateType.Data,
            dataViews: []
        });

        const status = element.querySelector<HTMLDivElement>(".network-status");
        expect(status?.textContent).toContain("Add Source ID and Target ID");

        const nodes = element.querySelectorAll(".network-node");
        const edges = element.querySelectorAll(".network-edge");
        expect(nodes).toHaveLength(0);
        expect(edges).toHaveLength(0);

        visual.destroy();
    });

    it("safely handles individual role drag (source only, target only, weight only)", () => {
        const { host } = mockVisualHost();
        const element = document.createElement("div");
        const visual = new Visual({ element, host });

        // Source only
        const sourceCol: powerbi.DataViewCategoryColumn = {
            source: { displayName: "Source ID", queryName: "source", roles: { source: true }, type: { text: true } },
            values: ["S1", "S2"],
            identity: [{ key: "s1" } as unknown as powerbi.DataViewScopeIdentity, { key: "s2" } as unknown as powerbi.DataViewScopeIdentity]
        };
        visual.update({
            viewport: { width: 800, height: 600 },
            viewMode: powerbi.ViewMode.View,
            type: powerbi.VisualUpdateType.Data,
            dataViews: [{
                metadata: { columns: [sourceCol.source] },
                categorical: { categories: [sourceCol] }
            }]
        });
        const status = element.querySelector<HTMLDivElement>(".network-status");
        expect(status?.textContent).toContain("Add Source ID and Target ID");
        expect(element.querySelectorAll(".network-node")).toHaveLength(0);

        // Target only
        const targetCol: powerbi.DataViewCategoryColumn = {
            source: { displayName: "Target ID", queryName: "target", roles: { target: true }, type: { text: true } },
            values: ["T1", "T2"],
            identity: [{ key: "t1" } as unknown as powerbi.DataViewScopeIdentity, { key: "t2" } as unknown as powerbi.DataViewScopeIdentity]
        };
        visual.update({
            viewport: { width: 800, height: 600 },
            viewMode: powerbi.ViewMode.View,
            type: powerbi.VisualUpdateType.Data,
            dataViews: [{
                metadata: { columns: [targetCol.source] },
                categorical: { categories: [targetCol] }
            }]
        });
        expect(status?.textContent).toContain("Add Source ID and Target ID");
        expect(element.querySelectorAll(".network-node")).toHaveLength(0);

        // Weight only
        const weightCol: powerbi.DataViewValueColumn = {
            source: { displayName: "Weight", queryName: "weight", roles: { weight: true }, type: { numeric: true } },
            values: [10, 20]
        };
        visual.update({
            viewport: { width: 800, height: 600 },
            viewMode: powerbi.ViewMode.View,
            type: powerbi.VisualUpdateType.Data,
            dataViews: [{
                metadata: { columns: [weightCol.source] },
                categorical: { values: [weightCol] as unknown as powerbi.DataViewValueColumns }
            }]
        });
        expect(status?.textContent).toContain("Add Source ID and Target ID");
        expect(element.querySelectorAll(".network-node")).toHaveLength(0);

        visual.destroy();
    });

    it("proves capabilities.json conditions accept individual role drags from a blank visual", () => {
        const capabilities = JSON.parse(readFileSync(path.join(process.cwd(), "capabilities.json"), "utf8"));
        const condition = capabilities.dataViewMappings[0].conditions[0];

        // Power BI condition evaluator:
        // An assignment { role: count } is accepted if all assigned counts <= max (and >= min if set),
        // and unassigned roles (count 0) have no min > 0.
        function isConditionMet(cond: Record<string, { min?: number; max?: number }>, assigned: Record<string, number>): boolean {
            for (const [role, rule] of Object.entries(cond)) {
                const count = assigned[role] ?? 0;
                if (rule.min !== undefined && count < rule.min) return false;
                if (rule.max !== undefined && count > rule.max) return false;
            }
            return true;
        }

        // Current capabilities: individual field drag from blank visual is accepted
        expect(isConditionMet(condition, { source: 1 })).toBe(true);
        expect(isConditionMet(condition, { target: 1 })).toBe(true);
        expect(isConditionMet(condition, { weight: 1 })).toBe(true);
        expect(isConditionMet(condition, { relationshipType: 1 })).toBe(true);
        expect(isConditionMet(condition, { edgeId: 1 })).toBe(true);
        expect(isConditionMet(condition, { tooltips: 1 })).toBe(true);

        // Incremental combinations are accepted
        expect(isConditionMet(condition, { source: 1, target: 1 })).toBe(true);
        expect(isConditionMet(condition, { source: 1, target: 1, weight: 1 })).toBe(true);

        // Exceeding max is rejected
        expect(isConditionMet(condition, { source: 2 })).toBe(false);
        expect(isConditionMet(condition, { target: 2 })).toBe(false);
        expect(isConditionMet(condition, { weight: 2 })).toBe(false);

        // Contrast: old 1.1.0.0 condition with min: 1 on source AND target rejected individual drags
        const oldCondition = {
            source: { min: 1, max: 1 },
            target: { min: 1, max: 1 },
            weight: { max: 1 }
        };
        expect(isConditionMet(oldCondition, { source: 1 })).toBe(false); // target min: 1 failed
        expect(isConditionMet(oldCondition, { target: 1 })).toBe(false); // source min: 1 failed
        expect(isConditionMet(oldCondition, { weight: 1 })).toBe(false); // both source and target min: 1 failed
    });
});
