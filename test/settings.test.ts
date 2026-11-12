import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type powerbi from "powerbi-visuals-api";
import Ajv from "ajv";

vi.mock("powerbi-visuals-api", async importOriginal => {
    const api = { ...await importOriginal<Record<string, unknown>>(), visuals: { ValidatorType: { Min: 0, Max: 1 } } };
    return { ...api, default: api };
});
import { formattingSettings, FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { hideSelfLinks, parseCircularSettings, resolveColorMode, Settings } from "../src/settings";
import { ar, en } from "../src/strings";

const json = (filename: string) => JSON.parse(readFileSync(path.join(process.cwd(), filename), "utf8"));

describe("circular settings and localized contracts", () => {
    it("keeps safe backward-compatible defaults and resolves automatic self-links/colors by layout mode", () => {
        expect(parseCircularSettings()).toEqual({
            layoutMode: "force", circularOrder: "alphabetical", selfLinks: "auto", groupBlankTargets: false,
            blankTargetLabel: "External / unknown", colorMode: "auto", roleRings: true
        });
        expect(hideSelfLinks("force")).toBe(false);
        expect(hideSelfLinks("circular")).toBe(true);
        expect(hideSelfLinks("force", "hide")).toBe(true);
        expect(hideSelfLinks("circular", "show")).toBe(false);
        expect(resolveColorMode("force")).toBe("uniform");
        expect(resolveColorMode("circular")).toBe("source");
        expect(resolveColorMode("force", "relationshipType")).toBe("relationshipType");
    });
    it("sanitizes invalid enums, booleans and bounded trimmed labels without coercion", () => {
        const invalid = {
            exploration: { layoutMode: "unknown", circularOrder: false, selfLinks: 0, groupBlankTargets: "true", blankTargetLabel: " \t " },
            appearance: { colorMode: "unknown", roleRings: 0 }
        } as unknown as powerbi.DataViewObjects;
        expect(parseCircularSettings(invalid)).toEqual(parseCircularSettings());
        expect(parseCircularSettings({ exploration: { blankTargetLabel: "  Outside  " } }).blankTargetLabel).toBe("Outside");
        expect(parseCircularSettings({ exploration: { blankTargetLabel: "x".repeat(100) } }).blankTargetLabel).toHaveLength(80);
        expect(parseCircularSettings({
            exploration: { layoutMode: "circular", circularOrder: "weight", selfLinks: "show", groupBlankTargets: true },
            appearance: { colorMode: "source", roleRings: false }
        })).toMatchObject({ layoutMode: "circular", circularOrder: "weight", selfLinks: "show", groupBlankTargets: true, colorMode: "source", roleRings: false });
    });
    it("builds modern formatting cards with matching capability slices and sanitized model values", () => {
        const capabilities = json("capabilities.json");
        const service = new FormattingSettingsService();
        const model = service.populateFormattingSettingsModel(Settings, {
            metadata: { columns: [], objects: { exploration: { blankTargetLabel: "x".repeat(100), layoutMode: "circular" } } }
        });
        const result = service.buildFormattingModel(model);
        expect(result.cards).toHaveLength(2);
        expect(model.exploration.blankTargetLabel.value).toHaveLength(80);
        expect(model.exploration.layoutMode.value.value).toBe("circular");
        for (const card of model.cards) {
            for (const slice of card.slices) {
                expect(capabilities.objects[card.name].properties[slice.name]).toBeDefined();
                expect(en).toHaveProperty(slice.displayNameKey!);
                if (slice instanceof formattingSettings.ItemDropdown) {
                    const options = capabilities.objects[card.name].properties[slice.name].type.enumeration;
                    expect(slice.items.map(item => item.value)).toEqual(options.map((item: { value: string }) => item.value));
                    for (const item of slice.items) expect(en).toHaveProperty(item.displayNameKey!);
                }
            }
        }
    });
    it("preserves every existing role, optional binding and certification capability contract", () => {
        const capabilities = json("capabilities.json");
        const schema = json("node_modules/powerbi-visuals-api/schema.capabilities.json");
        const validate = new Ajv({ allErrors: true }).compile(schema);
        expect(validate(capabilities), JSON.stringify(validate.errors)).toBe(true);
        expect(capabilities.dataRoles.map((role: { name: string }) => role.name))
            .toEqual(["source", "target", "weight", "relationshipType", "edgeId", "itemId", "tooltips"]);
        expect(capabilities.privileges).toEqual([]);
        expect(capabilities.supportsHighlight).toBe(true);
        expect(capabilities.supportsMultiVisualSelection).toBe(true);
        expect(capabilities.dataViewMappings[0].conditions[0].itemId).toEqual({ max: 1 });
        expect(capabilities.dataViewMappings[0].categorical.categories.select).toContainEqual({ for: { in: "itemId" } });
        for (const role of capabilities.dataRoles) expect(en).toHaveProperty(role.displayNameKey);
    });
    it("keeps English and Arabic runtime/resources exactly in sync with no empty translations", () => {
        expect(json("stringResources/en-US/resources.resjson")).toEqual(en);
        expect(json("stringResources/ar-SA/resources.resjson")).toEqual(ar);
        expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
        expect(Object.values(ar).every(value => value.trim().length > 0)).toBe(true);
    });
});
