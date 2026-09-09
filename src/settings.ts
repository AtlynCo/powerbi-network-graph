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
    public override slices = [this.nodeColor, this.edgeColor, this.showLabels, this.labelSize];
}

export class Settings extends formattingSettings.Model {
    public appearance = new Appearance();
    public override cards = [this.appearance];
}
