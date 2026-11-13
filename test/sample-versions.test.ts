import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertReportVersions, PBIR_ARTIFACT_VERSION, PBIR_DEFINITION_VERSION } from "../scripts/sample-report-versions.mjs";

describe("independent PBIR artifact and report-definition versions", () => {
    it("keeps the unified visual and npm versions synchronized", () => {
        const visual = JSON.parse(readFileSync("pbiviz.json", "utf8"));
        const metadata = JSON.parse(readFileSync("package.json", "utf8"));
        const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
        expect(visual.visual.version).toBe("1.2.0.0");
        expect(metadata.version).toBe("1.2.0");
        expect(lock.version).toBe(metadata.version);
        expect(lock.packages[""].version).toBe(metadata.version);
    });
    it("keeps the artifact at 4.0 and the page-definition format at 2.0.0", () => {
        expect(PBIR_ARTIFACT_VERSION).toBe("4.0");
        expect(PBIR_DEFINITION_VERSION).toBe("2.0.0");
        expect(() => assertReportVersions({ version: "4.0" }, { version: "2.0.0" })).not.toThrow();
    });

    it.each(["4.0.0", "4.0", "2.0", "", null, undefined])("rejects report definition version %s even if a schema accepts it", version => {
        expect(() => assertReportVersions({ version: "4.0" }, { version })).toThrow(/definition\/version.json.*2\.0\.0/);
    });

    it.each(["2.0.0", "4.0.0", undefined])("rejects changing artifact version to %s", version => {
        expect(() => assertReportVersions({ version }, { version: "2.0.0" })).toThrow(/definition.pbir.*4\.0/);
    });

    it("checks the actual authored sample rather than only constants", () => {
        const report = path.join(process.cwd(), "samples", "release", "Network.Report");
        const artifact = JSON.parse(readFileSync(path.join(report, "definition.pbir"), "utf8"));
        const definition = JSON.parse(readFileSync(path.join(report, "definition", "version.json"), "utf8"));
        expect(artifact.version).toBe("4.0");
        expect(definition.version).toBe("2.0.0");
        expect(() => assertReportVersions(artifact, definition)).not.toThrow();
    });
});
