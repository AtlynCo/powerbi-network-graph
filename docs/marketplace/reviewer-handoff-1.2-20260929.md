# Network 1.2 reviewer supplement, 2026-09-29

**Documentation only, for a future authorized handoff.** Native observations
below were made on **2026-09-25**, in Desktop **2.157.1354.0**, against the
unchanged **1.2.0.0** candidate and source
`eefe619e40b4fedf5e0efcebf42fa41e7b3fce39`. They do not describe a future
documentation commit or the historical package still stored in Partner Center.
No Desktop exercise, package rebuild, portal edit, submission or publication
was performed for this supplement.

The [prepublication record](../validation/PREPUBLISH-1.2.md) and
[`approved-handoff-1.2.json`](approved-handoff-1.2.json) remain unchanged
September 25 snapshots. Their then-unknown offer/account fields are not a
claim that the subsequently observed offer does not exist.

## Keep source, native candidate and stored draft separate

| Evidence | Dated identity and limitation |
| --- | --- |
| Frozen 1.2 candidate source | `eefe619e40b4fedf5e0efcebf42fa41e7b3fce39`; the live lowercase `certification` ref was read-only verified at this commit on September 29. A documentation PR against it does not update that ref or rebuild the visual. |
| Historical main | `c19276b2d53bc02853737377136973d6fc937242`, version 1.1.1.0; read-only verified on September 29. It is not the native 1.2 evidence baseline. |
| Native 1.2 candidate | The exact PBIVIZ/PBIX pair below, with unchanged GUID `AtlynNetworkAB24C68297094C32AF64D50D92C01711`. Native field-well results apply only to this candidate. |
| Existing offer | The coordinator's authenticated September 29 browser observation identified **Atlyn Network**, alias **`atlyn-network`**, resource **`209c9cb9-96b2-4628-bba7-5b4f6d2a75ed`**. Do not create a new offer to resolve the older unknown-offer snapshot. |
| Account identity | **Atlyn Partner Admin** is the observed signed-in display label, not independent evidence of the enrolled legal publisher/account ID. That legal/account confirmation remains outstanding. |
| Stored technical draft | Coordinator-reported September 29 readback still identifies the historical **1.1.1.0** PBIVIZ and historical sample PBIX. Their download/archive hashes were recorded on September 24; no current server bytes were downloaded by this documentation task. |
| English listing copy | The September 29 summary, description and keywords were previously saved and reload-verified. This does not establish technical-file or screenshot replacement, nor save these reviewer instructions into portal notes. |
| Reviewer access | A read-only GitHub API check on September 29 confirms **`OSDC1033` has `read` permission**. Repository access is not a completed secure Microsoft reviewer-account/process arrangement or review acceptance. |

Existing technical page:
<https://partner.microsoft.com/dashboard/v2/marketplace-offers/commercial-marketplace/offers/209c9cb9-96b2-4628-bba7-5b4f6d2a75ed/technicalconfiguration>

### Frozen native candidate files

| Candidate | File and bytes | SHA-256 |
| --- | --- | --- |
| PBIVIZ 1.2.0.0 | `dist\AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.2.0.0.pbiviz`; 153,889 bytes | `6136c82c28ecf597634cbb90685f9cb1fbc3c435ce64613a8be180e8ff0f00ff` |
| Approved native PBIX | `dist\native-prepublish\AtlynNetwork-1.2.0.0-native.pbix`; 213,864 bytes | `9248f79d195ec76fe61f278911a79cbb333f50a12bec17a3ab8130419e325ab7` |

The PBIX's embedded visual members match this PBIVIZ exactly. The
owner-approved classification is displayed **Non-Business**, stored
**Personal**. Preserve these bytes; do not relabel or resave the approved
attachment as part of a reproduction. Use a separate working copy for native
report edits. The frozen release manifest remains an **eefe619** handoff,
not evidence of a new build from the documentation PR.

### Historical technical files still identified in the draft

| Stored draft name | Version/evidence | September 24 archived-download SHA-256 |
| --- | --- | --- |
| `AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.1.1.0.pbiviz` | Historical 1.1.1.0, not the 1.2 candidate | `ff42b66ea48bc525cfca2e7164361920d5dd211582a1db0a319c9be91b164b86` |
| `AtlynNetwork_sample.pbix` | Historical portal sample, not the approved 9248 PBIX | `655b0a80fa4632ad5f6e892289ff0378c7d54597b73c674a1346ced429233b25` |

These names and archived hashes are coordinator evidence, not a fresh
server-content claim. Existing portal reviewer notes also remain separate
from this supplement: no note replacement or save is implied. **The native
1.2 result cannot clear policy report 1180.2.12 for the stored historical
pair.** That report describes field-well drag/drop acceptance, not a measured
slow-load result. Only an authorized, persisted, version-matched draft
alignment and Microsoft's review can address the stored submission.

## Reproduce binding with genuinely empty native wells

The approved sample has **`discourageImplicitMeasures` enabled**. Its Weight
well must use the explicit **`Services Total Weight`** measure, defined as
`SUM('Services'[Weight])`, **not the raw `Services[Weight]` column**.
The authored model already supplies this measure; no model change is needed.

For a separately authorized native review, use a working copy of the exact
9248 PBIX and verify the loaded visual is the unchanged 1.2 candidate. Follow
the [host-version controls](testing-checklist.md#host-version-control) if
AppSource can override an imported version; do not change the GUID or bypass
tenant policy. Keep the approved attachment unchanged.

1. Add a **new blank report page and a new Atlyn Network instance**. Verify
   Source ID, Target ID and Weight are empty. A prebound 8/14 page is not
   field-well acceptance evidence.
2. From the **Services** table, drag **SourceID** into **Source ID**, then
   **TargetID** into **Target ID**, then the measure **Services Total Weight**
   into **Weight**. With no report filters and no optional grouping fields,
   expect **8 entities and 12 endpoint-grouped relationships**, not 14.
   Examples: Gateway to Orders weight **132**; Orders to Payments **100**.
3. In additional initially empty instances, repeat the observed permutations:
   **TargetID, Services Total Weight, SourceID**; and
   **Services Total Weight, SourceID, TargetID**. Each field must appear in its
   intended native well, with the same 8/12 weighted result.
4. Starting with the three bindings, add **RelationshipType** to
   **Relationship type**: expect **13 relationships**. Then add **EdgeID** to
   **Edge ID**: expect **14 relationships**, still 8 entities. These category
   bindings distinguish type/parallel rows that endpoint-only grouping combines.
5. Remove **SourceID** from its well and drag it back from the Data pane.
   Verify it is accepted again and restores the correctly bound graph.

Use the field names above rather than dragging the numerically similar raw
Weight column. Clear report filters for the stated counts; local exploration
does not substitute for checking native field assignments.

## What the native evidence establishes

The archived receipts are
`C:\pbicert\network-native-field-well-proof-2026-09-25\assessment.json`
and `C:\pbicert\network-native-field-well-proof-2026-09-25\binding-order-matrix.json`.
The originating worktree receipts are under
`dist\native-field-well-20260925`. These are local evidence locations, not
files bundled into the certification source or automatically available to
Microsoft; the owner must arrange an approved reviewer handoff.

The assessment and binding-order matrix record actual native drags from the
Data pane into empty wells, not injected role assignments, synthetic
DataTransfer, fabricated DataViews or a prebound render proxy. Source-first,
target-first and explicit-measure-first acceptance, the 12/13/14 grouping
counts, and Source removal/re-drag were observed with unchanged 1.2 bytes.

**The raw Weight refusal is not an approved-sample pass.** Native Gauge also
refused that column in the same implicit-measure-discouraging model while
accepting the explicit measure. A **separate test-only control** omitted
`discourageImplicitMeasures`; the same unchanged visual then accepted real
raw Weight, SourceID and TargetID drags and rendered the weighted 8/12 result.
That control is **not the approved PBIX**, not a replacement attachment and
not permission to alter the approved model. Do not claim raw Weight is
draggable in the approved 9248 PBIX.

The control's first cache-free refresh failed with an Accounts cyclic-reference
Power Query error. A later native refresh succeeded without code/model changes,
after which raw-column binding passed. A clean first refresh is **not claimed**.
No visual defect requiring a fix/repackage was demonstrated by these bounded
binding results; no old-package or full-matrix acceptance is inferred.

## Remaining gates and continuation boundary

- Complete a separately authorized draft alignment and persisted readback of
  the exact 1.2 PBIVIZ, approved PBIX and native Circular/Radial image pair.
  Preserve protected legal, licensing, contract, category, availability,
  pricing, CRM, reviewer-note and certification-checkbox settings. No
  replacement, submission, resubmission or publication is performed here.
- Confirm the legal publisher/account identity and secure Microsoft
  reviewer-account/process arrangement; GitHub read access alone is insufficient.
- Complete the remaining [native/submission matrix](testing-checklist.md),
  including applicable formatting, field-removal orders, bookmark replay,
  conversions, Service/mobile/export and assistive-technology coverage under
  the necessary separate authorizations. The explicit-weight caveat and the
  control's first-refresh failure remain disclosed.
- Obtain Microsoft's actual review and additional Power BI visual certification;
  local/native evidence and general Marketplace status are not that outcome.

The coordinator's continuation window is **2026-10-02 at 09:00 Pacific**,
not a submission/publication date or approval. Separate paid-offer
Azure/DNS and secure-access blockers do not establish an Azure runtime or
credit prerequisite for this offline Network visual. This documentation
task makes no Azure, paid-model, permission, source-code, package, main or
`certification` ref change.
