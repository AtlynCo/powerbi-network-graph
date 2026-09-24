import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import powerbi from "powerbi-visuals-api";

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
    public override slices = [this.nodeColor, this.edgeColor, this.showLabels, this.labelSize, this.avoidLabelOverlap];
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
    public layout = new formattingSettings.ItemDropdown({
        name: "layout", displayNameKey: "InitialLayout", value: { value: "force", displayName: "Force" },
        items: [
            { value: "force", displayNameKey: "LayoutForce" },
            { value: "circular", displayNameKey: "LayoutCircular" },
            { value: "radial", displayNameKey: "LayoutRadial" }
        ]
    });
    public override slices = [this.view, this.layout];
}

export class Settings extends formattingSettings.Model {
    public appearance = new Appearance();
    public exploration = new Exploration();
    public override cards = [this.appearance, this.exploration];
}
