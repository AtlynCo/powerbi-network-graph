# Atlyn Network 1.2 prepublication evidence

**2026-09-24 to 2026-09-25. In-progress native acceptance and preparation; not a
Microsoft certification, submission or authorization to publish.** Limited
owner privacy/EULA decisions are recorded explicitly below.
The visual archive is unchanged: `1.2.0.0`, 153,889 bytes, SHA-256
`6136c82c28ecf597634cbb90685f9cb1fbc3c435ce64613a8be180e8ff0f00ff`.
The [local source/package report](RESULTS-1.2.md) remains the record of the
earlier 168-case/38-browser-group verification.

## Genuine Desktop observations

The coordinator authorized a bounded separate Power BI Desktop instance
after a read-only check found no existing Desktop or `msmdsrv` process.
Desktop **2.157.1354.0** opened a worktree-local copy, using an unused temporary
`N:` alias solely to avoid Windows path-length problems. The original
`samples/release` files and the candidate package were not opened for editing.
Actions were scoped to the owned PID and its local-only WebView2 debugging
endpoint. No source/host mock was injected, no recovered report was opened,
and no sign-in, tenant policy, publication or account control was changed.

One actual Home > Refresh was requested. Its asynchronous native completion
cleared the manual-refresh/incomplete-data banners. The real refresh dialog
reported 14 Services and 16 Accounts fact rows plus the six literal dimension
tables. No external data connection is authored; this is **not** a claim that
the whole Windows machine or Power BI host was network-isolated.

The initial native copy passed these visible checks:

| Page | Actual Desktop observation |
| --- | --- |
| Services / Force | 8 entities, 14 relationships |
| Accounts / Force | 6 retained entities, 13 retained relationships |
| Circular | 8 entities, 14 relationships; Circular selected |
| Radial | 8 entities, 14 relationships; Radial selected, automatic center Orders |
| Hints | Authored guidance rendered |

`dist/native-prepublish/native-pages.json` records timestamps and the observed
status text. Native canvas-only PNGs are separate from mock-host listing
candidates and exclude the account header. They are not a completed
selection/bookmark/export/accessibility acceptance matrix.

**Current native save boundary:** File > Save as > Browse this device opened
the owned native dialog at the worktree copy. A foreground-PID guard prevented
global keyboard input; no keys were sent. The coordinator subsequently
authorized exact HWND-scoped standard filename/type/Save messages, with
PID/control/path ownership rechecked before use. Those actions set the displayed
type to PBIX and filename to `N:\AtlynNetwork-1.2.0.0-native.pbix` without global
input; the later PBIP output means a genuine PBIX-format save was not established.

Desktop then required an organizational **sensitivity label** before saving.
No label was chosen or applied by this session at that point and no PBIX was
produced. On 2026-09-25 the owner explicitly authorized **Public** for this
synthetic offline Marketplace-bound sample, relayed by the coordinator.
On resumption, before any new input, the same PID showed **Non-Business**
and a saved `AtlynNetwork-1.2.0.0-native.pbix.pbip` project dated 08:15.
No `.pbix` existed. The pending Save As request originated in this session on
2026-09-24, but the subsequent label choice/08:15 completion cannot be attributed
from file timestamps or current process inventory. The project is preserved,
not renamed or claimed as a PBIX. Native mutation was paused again, and the
coordinator explicitly required preservation/no further native action until
attribution and a safe retry boundary are established.
`dist/native-prepublish/attribution-state-2026-09-25.json` records PID **46424**,
start **2026-09-24T18:34:25.5679321Z**, session **2**, project modification
**2026-09-25T15:15:43.5507801Z** (08:15:43 local), and project SHA-256
`1fbc00f66fb6c6ccc2ca02d03a857d27b5049157c72322e5909f1caa2d75573c`.
No writer audit or evidence identifying an intervening operator is available.
A current PBIX, cold reopen and embedded-byte comparison are therefore
**not yet claimed**. The separate safe retry and additional host checks follow.

## Fresh isolated retry, 2026-09-25

The owner confirmed someone else had interacted with the first instance and
authorized a new instance/copy while leaving **PID 46424**, its N: alias,
project/model files and label state untouched. The retry is **PID 45380**,
started **2026-09-25T15:48:28.3272496Z**, with a fresh R: alias pointing to
`.tmp/native-retry-20260925/candidate`, separate WebView2/temp directories,
and local inspection port 9418. Ownership/start-time/path guards exclude the
prior instance. This retry used the **final Hints-last** sample. Read-only
native engine inspection reported **Edg/154.0.4258.37**, CDP protocol 1.3;
this is distinct from the earlier offline mock-host Chromium version.

`dist/native-prepublish/retry-20260925/fresh-PBIP-native-refresh.json` records
a new actual native refresh and all five pages in the correct order:
Services 8/14, Accounts 6/13, Circular 8/14, Radial 8/14 centered on Orders,
then Hints. It records no report-WebView page errors during those checks.

Eight additional real Desktop checks passed, recorded in
`retry-20260925/native-interactions.json`:

| Native check | Observed model/UI outcome |
| --- | --- |
| Services model-backed detail table | All fourteen exact Edge IDs present |
| Local layout/root/focus/search | Native detail table remains unfiltered |
| Native calls type slicer | Graph 3 nodes/3 edges; detail table exactly S01/S02/S12 |
| Requested Archive root while filtered out | Visible automatic fallback retains the request; Archive returns after clearing the slicer |
| Edge selection and clear | Table filters to exactly S02, then restores all fourteen |
| Ctrl relationship multiselect | Table shows exactly S02 and S12; clear restores all |
| Keyboard Enter/Escape | Selects S01 and clears without changing the local Radial layout |
| Bound tooltip values in complete list | Model-formatted weight and duration values, including 90 and 32.0, present |
| Explicit Save local view | Native host accepted the request for explicit Orders center/camera without an error notice; cold-reopen persistence is still unverified |

The root-retention outcome is part of the slicer case, so the receipt has
eight checks despite the expanded explanation above. An initial pointer
attempt timed out because the automation frame coordinates omitted the
report's approximately 1.432x display scale. The retry used actual outer/inner
DOM bounds, verified both hit targets and delivered only scoped WebView
pointer input; no forced click, global input or mock API was used. The failed
attempt is preserved separately, not reported as a pass.

**Retry save is blocked, with the required stop condition honored.** The real
Save As dialog remained on **Power BI project files (*.pbip)**, selected index
2, filename `Network.pbip`. The exact-owned-control action did not commit the
PBIX option at index 0. The guard stopped **before changing the filename or
invoking Save**; no PBIX or Public-label application is claimed. The actual
observed state is in `retry-20260925/save-boundary.json`.
An owner-operated true **Power BI file (*.pbix)** selection/save to
`R:\AtlynNetwork-1.2.0.0-native.pbix`, with authorized **Public**, is needed
before archive-member verification and a genuine cold reopen can continue.
The owner has explicitly chosen to perform that Desktop save. The agent will
leave PID45380, its Save As dialog and R: sample untouched until confirmation,
then verify the actual format and bytes rather than infer success from its name.

## Sample-only preparation

The generated sample now places **Hints last**, following the four graph
examples, with consistent numbering: Services, Accounts, Circular, Radial,
Hints. The author/validator and a regression test enforce the order and
guidance text. Source schema validation still reports 30 files/four bound
graphs/50 bindings; the embedded PBIVIZ hash remains unchanged. Targeted
sample tests (25 cases), the full **169-case** suite, typecheck, both lint
entry points and official TOM preflight passed. The new unit receipt is
`dist/unit-tests-prepublish.json`; the prior 168-case report is preserved.
The initial native observations preceded this page-order correction. The
fresh retry verified the final order and native rendering; final PBIX
save/reopen acceptance remains blocked as described above.

## Listing, public links and reviewer access

[Current listing draft](../marketplace/submission-1.2.md) provides a 13-character
name, 92-character summary, description under 3,000 characters, three keywords,
five accurate image captions and an explicit current technical handoff.
The historical 1.1 draft remains unchanged.

`dist/native-prepublish/listing-assets.json` verifies the existing 300x300 PNG
logo (4,392 bytes) and five current-PBIVIZ mock-host screenshots, each
1366x768 and below 1,024,000 bytes. These are prepared candidates, not owner
approval or proof of native screenshot requirements.

The following existing public pages returned **HTTP 200 over HTTPS** and
explicitly covered Atlyn Network:

- Support: `https://atlynco.github.io/atlyn-powerbi-support/docs/faq/`
- Privacy: `https://atlynco.github.io/atlyn-powerbi-support/legal/privacy/`
- Customer terms: `https://atlynco.github.io/atlyn-powerbi-support/legal/terms/`

`dist/native-prepublish/public-url-verification.json` stores final URLs,
retrieval timestamps, byte counts and response hashes. This closes technical
URL discovery/reachability, not support ownership/SLA or portal acceptance.
**On 2026-09-25 the owner explicitly approved the privacy URL and the existing
Atlyn terms URL as the publisher EULA option for the Network offer**, relayed
by the coordinator. The owner also approved the exact support FAQ URL and
confirmed **`atlyn.help@gmail.com` is a monitored Marketplace support contact**.
These approvals are limited to the stated offer fields/contact, not
publication or an invented response-time SLA. No new legal terms or privacy
URL were invented, and no portal contract was accepted.

Read-only GitHub verification found **`pbicvsupport` already has read access**.
That does not prove Microsoft accepted the review arrangement or that all
current secure-access requirements are satisfied. The live lowercase
`certification` ref remains
`c19276b2d53bc02853737377136973d6fc937242` (1.1.1.0), not the current source.
Receipt: `dist/native-prepublish/reviewer-source-status.json`. No permission,
main branch or certification ref was changed.

## Remaining explicit gates

- Genuine version-matched PBIX save/cold reopen and embedded package-byte
  equality; complete native Desktop interactions, formatting, bookmarks,
  conversions and host acceptance matrix.
- Owner-authorized Service/mobile/export and assistive-technology coverage.
  Publication to enable Service testing is outside the current request.
- Publisher/offer identity, branding and listing-media approvals, plus any
  required approved EULA upload/file format. The privacy URL, existing-terms
  publisher EULA option, support FAQ and monitored support contact are
  explicitly owner-approved; no Partner Center entry or acceptance occurred.
- The owner has now authorized updating the remote lowercase `certification`
  branch **only after final source/native/package verification**; that
  prerequisite is not complete, so the ref is still untouched. Current secure
  Microsoft reviewer-process confirmation remains separate.
- Partner Center submission, certification request, publishing/go-live,
  Azure redemption and Microsoft's outcomes are excluded, not performed.
