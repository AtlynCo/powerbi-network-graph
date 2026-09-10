import assert from "node:assert/strict";

// The report artifact and its page-definition format have independent versions.
export const PBIR_ARTIFACT_VERSION = "4.0";
export const PBIR_DEFINITION_VERSION = "2.0.0";

export function assertReportVersions(artifact, definition) {
    assert.equal(artifact?.version, PBIR_ARTIFACT_VERSION, "definition.pbir must retain report artifact version 4.0");
    assert.equal(definition?.version, PBIR_DEFINITION_VERSION,
        "definition/version.json must use report definition version 2.0.0; 4.0.0 can hide pages in Desktop");
}
