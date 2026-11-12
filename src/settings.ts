import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import powerbi from "powerbi-visuals-api";
import { sanitizeBlankTargetLabel } from "./graph";

export type LayoutMode = "force" | "circular";
export type CircularOrder = "alphabetical" | "weight";
export type SelfLinks = "auto" | "show" | "hide";
export type ColorMode = "auto" | "source" | "relationshipType" | "uniform";
export interface CircularSettings {
    layoutMode: LayoutMode;
    circularOrder: CircularOrder;
    selfLinks: SelfLinks;
    groupBlankTargets: boolean;
    blankTargetLabel: string;
    colorMode: ColorMode;
    roleRings: boolean;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
    return values.includes(value as T) ? value as T : fallback;
}

export function parseCircularSettings(objects?: powerbi.DataViewObjects): CircularSettings {
    const exploration = objects?.exploration;
    const appearance = objects?.appearance;
    return {
        layoutMode: enumValue(exploration?.layoutMode, ["force", "circular"], "force"),
        circularOrder: enumValue(exploration?.circularOrder, ["alphabetical", "weight"], "alphabetical"),
        selfLinks: enumValue(exploration?.selfLinks, ["auto", "show", "hide"], "auto"),
        groupBlankTargets: exploration?.groupBlankTargets === true,
        blankTargetLabel: sanitizeBlankTargetLabel(exploration?.blankTargetLabel),
        colorMode: enumValue(appearance?.colorMode, ["auto", "source", "relationshipType", "uniform"], "auto"),
        roleRings: typeof appearance?.roleRings === "boolean" ? appearance.roleRings : true
    };
}

export function hideSelfLinks(mode: LayoutMode, selfLinks: SelfLinks = "auto"): boolean {
    return selfLinks === "hide" || (selfLinks === "auto" && mode === "circular");
}

export function resolveColorMode(mode: LayoutMode, colorMode: ColorMode = "auto"): Exclude<ColorMode, "auto"> {
    return colorMode === "auto" ? (mode === "circular" ? "source" : "uniform") : colorMode;
}

class Appearance extends formattingSettings.SimpleCard {
    public override name = "appearance";
    public override displayNameKey = "Appearance";
    public nodeColor = new formattingSettings.ColorPicker({
        name: "nodeColor", displayNameKey: "NodeColor", value: { value: "#007D87" }
    });
    public edgeColor = new formattingSettings.ColorPicker({
        name: "edgeColor", displayNameKey: "EdgeColor", value: { value: "#596579" }
    });
    public showLabels = new formattingSettings.ToggleSwitch({
        name: "showLabels", displayNameKey: "ShowLabels", value: true
    });
    public labelSize = new formattingSettings.NumUpDown({
        name: "labelSize", displayNameKey: "LabelSize", value: 12,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 24 }
        }
    });
    public avoidLabelOverlap = new formattingSettings.ToggleSwitch({
        name: "avoidLabelOverlap", displayNameKey: "AvoidLabelOverlap", value: true
    });
    public colorMode = new formattingSettings.ItemDropdown({
        name: "colorMode", displayNameKey: "ColorMode", value: { value: "auto", displayNameKey: "ColorAuto" },
        items: [
            { value: "auto", displayNameKey: "ColorAuto" }, { value: "source", displayNameKey: "ColorSource" },
            { value: "relationshipType", displayNameKey: "ColorType" }, { value: "uniform", displayNameKey: "ColorUniform" }
        ]
    });
    public roleRings = new formattingSettings.ToggleSwitch({
        name: "roleRings", displayNameKey: "RoleRings", value: true
    });
    public override slices = [this.nodeColor, this.edgeColor, this.showLabels, this.labelSize, this.avoidLabelOverlap, this.colorMode, this.roleRings];
    public override onPreProcess(): void {
        const mode = enumValue(this.colorMode.value.value, ["auto", "source", "relationshipType", "uniform"], "auto");
        this.colorMode.value = this.colorMode.items.find(item => item.value === mode)!;
        this.roleRings.value = typeof this.roleRings.value === "boolean" ? this.roleRings.value : true;
    }
}

class Exploration extends formattingSettings.SimpleCard {
    public override name = "exploration";
    public override displayNameKey = "Exploration";
    public view = new formattingSettings.ItemDropdown({
        name: "view", displayNameKey: "InitialView", value: { value: "auto", displayName: "Automatic" },
        items: [
            { value: "auto", displayNameKey: "ViewAuto" }, { value: "split", displayNameKey: "ViewSplit" },
            { value: "graph", displayNameKey: "ViewGraph" }, { value: "list", displayNameKey: "ViewList" }
        ]
    });
    public layoutMode = new formattingSettings.ItemDropdown({
        name: "layoutMode", displayNameKey: "LayoutMode", value: { value: "force", displayNameKey: "LayoutForce" },
        items: [{ value: "force", displayNameKey: "LayoutForce" }, { value: "circular", displayNameKey: "LayoutCircular" }]
    });
    public circularOrder = new formattingSettings.ItemDropdown({
        name: "circularOrder", displayNameKey: "CircularOrder", value: { value: "alphabetical", displayNameKey: "OrderAlphabetical" },
        items: [{ value: "alphabetical", displayNameKey: "OrderAlphabetical" }, { value: "weight", displayNameKey: "OrderWeight" }]
    });
    public selfLinks = new formattingSettings.ItemDropdown({
        name: "selfLinks", displayNameKey: "SelfLinks", value: { value: "auto", displayNameKey: "SelfAuto" },
        items: [
            { value: "auto", displayNameKey: "SelfAuto" }, { value: "show", displayNameKey: "SelfShow" },
            { value: "hide", displayNameKey: "SelfHide" }
        ]
    });
    public groupBlankTargets = new formattingSettings.ToggleSwitch({
        name: "groupBlankTargets", displayNameKey: "GroupBlankTargets", value: false
    });
    public blankTargetLabel = new formattingSettings.TextInput({
        name: "blankTargetLabel", displayNameKey: "BlankTargetLabel", value: "External / unknown", placeholder: "External / unknown"
    });
    public override slices = [this.view, this.layoutMode, this.circularOrder, this.selfLinks, this.groupBlankTargets, this.blankTargetLabel];
    public override onPreProcess(): void {
        const parsed = parseCircularSettings({ exploration: {
            layoutMode: this.layoutMode.value.value, circularOrder: this.circularOrder.value.value,
            selfLinks: this.selfLinks.value.value, groupBlankTargets: this.groupBlankTargets.value,
            blankTargetLabel: this.blankTargetLabel.value
        } });
        this.layoutMode.value = this.layoutMode.items.find(item => item.value === parsed.layoutMode)!;
        this.circularOrder.value = this.circularOrder.items.find(item => item.value === parsed.circularOrder)!;
        this.selfLinks.value = this.selfLinks.items.find(item => item.value === parsed.selfLinks)!;
        this.groupBlankTargets.value = parsed.groupBlankTargets;
        this.blankTargetLabel.value = parsed.blankTargetLabel;
    }
}

export class Settings extends formattingSettings.Model {
    public appearance = new Appearance();
    public exploration = new Exploration();
    public override cards = [this.appearance, this.exploration];
}
