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
});
