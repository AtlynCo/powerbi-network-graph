# Atlyn Network — authored offline sample

**Target:** `1.1.0.0`, GUID `AtlynNetworkAB24C68297094C32AF64D50D92C01711`, API `5.11.0`.
**Evidence status:** authored PBIP/PBIR/TMDL, locally schema/referential validated. **Not natively opened, refreshed, saved as PBIX, or Microsoft certified.**

This is a complete source project, not a placeholder or instructions to build an empty report. It contains two graph pages with real field projections, type slicers, relationship detail tables, explanatory text, and a third hints page. Both graphs reference the embedded private custom visual. Eight semantic-model tables, fourteen DAX measures and six single-direction relationships are authored. All data partitions use literal `#table` expressions; they read no CSV, workbook, URL, database or sibling directory.

## Report version correction, 2026-09-10

| File/property | Required value | Meaning |
| --- | --- | --- |
| `Network.Report\definition.pbir` → `version` | `"4.0"` | Report artifact format; preserved |
| `Network.Report\definition\version.json` → `version` | `"2.0.0"` | Report/page-definition format; corrected from `"4.0.0"` |

These are independent formats, not alternative spellings of one version.
The coordinator's single-variable native A/B in Desktop 2.157 found that
`4.0.0` in the second file passed JSON schema checks but silently loaded no
report pages; `2.0.0` restored the other sample's pages. This Network source
now uses the corrected value, but **Network native acceptance remains with
the coordinator**. The public schema URI versions and `definition.pbism`
are separate and unchanged.

The generator uses distinct constants in `scripts\sample-report-versions.mjs`;
both JavaScript and PowerShell validators reject the wrong format versions.
`test\sample-versions.test.ts` covers the original mistake, swapped/invalid
versions, and the actual generated files. The correction does not change the
visual version or rebuild its PBIVIZ: the embedded SDK bytes still have SHA-256
`a291552f2b459da622513ece4eec440226693de1fbd7f91020ac4f441e2c1514`.
Earlier frozen handoffs remain intact and are superseded only for sample
report metadata by the separately delivered corrected handoff.

## Open and use — manual native gate

1. Open `Network.pbip` in a current Power BI Desktop. Enable PBIP, enhanced report format (PBIR) and TMDL preview features if your Desktop version requires them. Respect the organization's custom-visual policy; do not bypass it.
2. **Refresh** the semantic model. Microsoft documents that a cache-free PBIP opens with model definitions but no imported rows until refresh. This project deliberately excludes `cache.abf`; its refresh evaluates only literal embedded data.
3. On **1. Cyclic services**, inspect Orders, its self-loop, reciprocal calls/responses and the directed Orders → Payments → Ledger → Orders cycle. Compare relationship types with the slicer. Archive/Backup is a disconnected component. Graph/list selections should filter the detail table; the type slicer should filter both.
4. On **2. Reciprocal accounts**, search `0001`, preserving the zero-prefixed text ID. Compare parallel T01/T05 transfers and the separate fee; inspect model-formatted tooltip measures.
5. Read **3. Hints and semantics**. Test native selection, keyboard behavior, tooltips, local-view persistence, save/reopen and offline refresh. Record Desktop version, artifact hash, expected and actual outcomes.
6. Save As a real **PBIX**, reopen it offline, and verify that its custom visual version/content match the final PBIVIZ. This step belongs to the coordinator/operator. Do not rename this source project or its ZIP into a PBIX.

If Power BI cannot load the private visual or reports a schema/model error, retain the exact diagnostic and repair the source before conversion. JSON-schema success alone does not prove custom-visual loading or query execution. The current worktree's longest generated path is close to Windows' documented 260-character PBIP limit; use an operator-approved shorter location if necessary. This script never copies outside the worktree.

## What is bound

| Visual role | Each fact table's field |
| --- | --- |
| `source` | `SourceID` (text, do not summarize) |
| `target` | `TargetID` (text, do not summarize) |
| `relationshipType` | `RelationshipType` (text) |
| `edgeId` | `EdgeID` (text) |
| `weight` | `[Total Weight] = SUM([Weight])` |
| `tooltips` | `[Average Duration ms]`, `[Events]`, `[Input Rows]` |

`Services` has 14 physical rows. `Accounts` has 16 physical rows. Source-node and target-node dimensions are separate role-playing dimensions, preventing an ambiguous bidirectional model cycle. Type dimensions drive the page slicers. A cyclic **drawn network** does not require cyclic semantic-model relationships.

Additional measures `[Visible Nodes]`, `[Blank Weights]` and `[Nonpositive Weights]` support model investigation. `[Nonpositive Weights]` counts zero and negative facts; this is a quality-inspection measure, **not** the visual's invalid-weight rule: zero is valid.

### Expected semantics, before host filtering/reduction

- Services: 8 endpoint nodes, 14 uniquely identified edges, including the self-loop and disconnected pair.
- Accounts: T01's duplicate category tuple may already be grouped by Power BI into weight **120**, Events **2**, Input Rows **2**, mean Duration **23 ms**. This is host aggregation, not proof that the visual received two rows.
- Both T-CONFLICT rows share an ID but disagree on direction. When both are delivered, the entire conflicting ID is omitted with a diagnostic. The remaining graph has 6 endpoint nodes and 13 edges after duplicate aggregation and conflict omission. The raw detail table intentionally retains the two bad facts.
- Zero weight is valid. Missing/negative weights are incomplete and receive neutral visual styling, not fabricated unit weights or complete financial totals.
- `[Total Weight]` and `[Input Rows]` describe model context; they can differ from retained visual topology. Other filters can hide a conflict, reduce a component, or alter aggregation.

## Reproduce against the actual final release

From the repository root, **after the coordinator's final packaging command**:

```powershell
node .\scripts\sample-package.mjs
node .\scripts\sample-package.mjs --validate
```

The default command:

1. Requires exactly one correctly named current `dist` PBIVIZ and verifies GUID/version/API/capabilities.
2. Copies its unchanged archive into `package\`.
3. Extracts its exact `package.json` and compiled resources into `Network.Report\CustomVisuals\<GUID>\`.
4. Registers the `CustomVisualMetadata` resource in PBIR, with its name/path relative to the private package's `resources` directory, and leaves AppSource/organization visual lists empty.
5. Validates the project against the checked-in Microsoft schemas, all page/interaction/field/role/model links, role cardinalities and kinds, literal partitions, dimension keys, and exact archive/resource bytes.
6. Writes `sample-validation.json`, including final archive and resource SHA-256 values, source-file hashes and limitations.

`--validate` does not repair/re-embed; it fails on a stale or modified embedded artifact. It updates the evidence report only after a successful check. The default assembly does **not** rebuild the visual. Repeat it every time the final PBIVIZ changes and before native conversion.

The development-only authoring command is:

```powershell
node .\scripts\sample-package.mjs --author
```

It regenerates the authored source from `samples\OfflineSamples.pq` and overwrites the authored report/model. Do not run it after native adjustments without reviewing those changes. The **resulting PBIP is self-contained**; `OfflineSamples.pq`, Node and repository dependencies are not runtime dependencies of the report.

Official schemas are vendored at a pinned Microsoft commit with their MIT license and raw-content hashes. Normal assembly and validation need no network. `--refresh-schemas` explicitly fetches that pinned public revision; it is not report runtime behavior. The script uses existing lockfile-resolved JSZip and Ajv, not a new hosted validation service.

## Files and evidence boundaries

- `Network.pbip`: report shortcut.
- `Network.Report\definition.pbir`: local semantic-model link; `definition\`: three authored pages and thirteen visual containers.
- `Network.Report\CustomVisuals\`: exact private package resources, not remote URLs.
- `Network.SemanticModel\definition\`: eight TMDL tables, fourteen measures, six relationships.
- `sample-contract.json`: original synthetic rows and authored-model expectations.
- `schemas\`: official schema cache and license, needed only by local validation.
- `package\`: the unchanged release archive that proves embedding provenance.
- `sample-validation.json`: local evidence only. No TOM parser execution, DAX/M evaluation, render correctness, native host behavior, certification or submission is inferred.

The public-format basis and remaining submission gates are documented in [`docs/marketplace/README.md`](../../docs/marketplace/README.md).

## Official local model-parser preflight

`pwsh -NoProfile -File scripts\validate-tmdl.ps1 -AssemblyPath <official-TOM-DLL>`
uses Microsoft's `TmdlSerializer.DeserializeDatabaseFromFolder`, without a
server, Desktop UI, package restore or installation. Keep official companion
DLLs together in the ignored `.tmp\tmdl-bin\net8.0` cache. The coordinated
Microsoft.AnalysisServices 19.117.0 .NET 8 binaries were used successfully.
The script also requires report artifact version `4.0`, report-definition
version `2.0.0`, and the report/page structure. Results and exact
model/report/assembly hashes are in
`dist\tmdl-validation.json`. DLLs are not redistributed in the source.

This additionally verifies actual TMDL grammar, not merely self-authored
template agreement. It still does not evaluate M/DAX, load the visual in
Desktop, or produce a PBIX. Earlier `sample-validation.json` limitations describe
the JavaScript assembler's scope; this separate parser report supplements them.
