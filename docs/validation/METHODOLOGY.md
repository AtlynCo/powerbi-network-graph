# Local compiled-package validation

These checks run **only in the current worktree**, with the cached Chromium
binary and browser profiles under `.browser-cache` / `.tool-home`. No GitHub
Actions, hosted CI, Codespaces, cloud sessions, native application automation,
public screenshot upload, or Partner Center operation is part of this harness.

## Evidence boundaries

The browser loads the actual PBIVIZ JavaScript, CSS, and localization resources.
It does not import source TypeScript as a substitute for the package. The normal
path uses the existing strict artifact reader, which compares the package with
the current source contract, and verifies every recorded source/build-input hash
in the package owner's `dist/build-inputs.json` against current files. The
manifest must name the same PBIVIZ SHA. `BROWSER_ARTIFACT` explicitly selects a historical
archive inside the worktree; that mode verifies archive CRC, GUID, and version,
but **does not establish agreement with current source**. Historical mode is
rejected for final checks, final benchmarks, and final screenshots.

The Power BI host is an offline API mock. Selection promises, callbacks,
persist-properties requests, high-contrast colors, identity keys, and render
events are observable. This is useful integration evidence, **not** native
Desktop/Service interaction, report filtering, bookmark persistence, screen
reader certification, native export, marketplace, or AppSource certification.
Those remain explicit manual gates.

On 2026-09-10 the owner approved external Atlyn storefront subscription
acquisition and ungated runtime/free shared viewing, without paid-author
enforcement. The sealed offline renderer is intended; no runtime licensing
integration or rebuild is pending for that decision. Historical "unlicensed"
evidence labels and frozen bundles stay unchanged. "Final" harness flags mean
a frozen quality artifact, not authority to submit or proof of the required
additional Power BI visual certification badge.

## Reproduce

Run commands serially; do not run tests or another build beside the benchmark.
Dependencies and Chromium must already be installed. A missing browser can be
resolved with an existing binary via `CHROMIUM_EXECUTABLE_PATH`; the harness does
not install or download browsers. `TEMP`, `TMP`, and `TMPDIR` are set to the
worktree-local browser directory before launch.

```powershell
npx vitest run test\release-topology.test.ts
npx eslint scripts\browser-harness.mjs scripts\browser-test.mjs scripts\release-browser.mjs scripts\release-benchmark.mjs test\release-topology.test.ts

# Wait for the owner to finish the final package build before these commands.
Remove-Item Env:BROWSER_ARTIFACT -ErrorAction SilentlyContinue
node scripts\browser-test.mjs
node scripts\release-browser.mjs
node scripts\release-benchmark.mjs --tag=final --samples=30 --warmup=5
node scripts\release-profile.mjs
```

The final package owner, not these scripts, runs packaging. To compare an
existing measured candidate on the same fixtures:

```powershell
node scripts\release-benchmark.mjs --tag=final --baseline=dist\release-benchmark-baseline-v1.json
```

### Final matching-hash gates

Every newly generated result JSON uses a top-level `artifact` filename string
and top-level `sha256` string. Gate these **current-release** files against the
final PBIVIZ filename/SHA and require `passed: true`:

| File under `dist` | Producer | Additional checks |
|---|---|---|
| `browser-test-results.json` | `node scripts\browser-test.mjs` | Existing 17 groups; zero errors/requests |
| `release-browser-results.json` | `npm run test:release` | 38 groups in 1.2; `preliminary: false`; current source/build provenance |
| `release-benchmark-final.json` | `npm run benchmark` | 24 layout/fixture/operation groups in 1.2; ≥30 samples each; current source/build provenance; all p95 budgets |
| `release-profile.json` | `node scripts\release-profile.mjs` | DevTools CPU sampling, actual-package provenance, zero requests/errors |
| `rebuild-verification.json` | `node scripts\rebuild-check.mjs` | Two unchanged-source SDK builds, every decompressed member identical; final archive SHA |

Run `rebuild-check.mjs` **before** final inspection, notices, sample assembly
and browser/benchmark capture. The official SDK writes wall-clock ZIP entry
timestamps: member content is reproducible but ZIP bytes/SHA can differ.
Do not normalize/rewrite an SDK archive to imply a stronger reproducibility
claim. Every final gate must reference the exact last archive, not an earlier
rebuild's hash. The pinned `1.1.1.0` archive stays unchanged.

For final screenshots, run `node scripts\release-browser.mjs --screenshots` with
the owner's `RELEASE_FINAL_READY_SHA`. Its same `release-browser-results.json`
then includes four screenshot entries, each with matching `artifact` and
`sha256`; images live in `dist/release-screenshots/`. The older compatibility
preview is separately described by `dist/mock-host-preview.json` and is not
native-host evidence.

Historical `release-benchmark-baseline-v1*.json`, cached/candidate reports, and
`release-browser-preliminary.json` are comparison/diagnostic evidence. Their
hashes may intentionally differ and **must not** be subjected to a
current-package-matching gate. They may still be hashed as historical evidence
by the release manifest. Comparison accepts older nested-artifact benchmark
reports for compatibility, but all new output uses the consistent flat keys.
Setup failures overwrite their result file with `passed: false` rather than
leaving a stale successful report (unknown artifact/SHA may be `null`).

Historical/preliminary work requires an explicit archive and evidence label:

```powershell
$env:BROWSER_ARTIFACT = Join-Path (Get-Location) 'dist\AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.1.0.0.pbiviz'
node scripts\release-browser.mjs --preliminary
node scripts\release-benchmark.mjs --tag=cached-candidate
Remove-Item Env:BROWSER_ARTIFACT
```

Historical protocol-2 procedure (not a protocol-3 comparison): the frozen v1.0 package was retained at
`.tmp\baseline-v1\AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.0.0.0.pbiviz`.
Protocol 2 used the common **neighborhood** action, not v1.1's new incident-only mode.
The current 1.2 protocol **3** measures all three layouts serially; older
packages without those controls are not valid comparison baselines.
Reports from different protocol versions are rejected for comparison. Each
operation's final visible node/edge counts are also checked against explicit
expected values, including the full graph before native-selection mock timing.

## Independent functional oracles

The attributed `test/fixtures/microsoft-sankey.json` contains only the exact
nine relationship rows from the Microsoft-linked workbook's Sankey Chart
sheet, with pinned revision/blob/workbook hash and coordinator-verification
scope. `test/microsoft-sample.test.ts` checks exact records, eight endpoints,
nine edges, 6,975 total weight, row identity and independently specified radial
levels. The release browser uses that same fixture in all three layouts and
checks actual row selections. Its report includes the fixture hash and source
provenance. This is not native workbook ingestion or full workbook coverage.

The 1.2 candidate adds `test/polar-layout.test.ts` and `test/navigation.test.ts`.
Four pre-change c19276b Force fingerprints pin positions/routes/bounds/signature.
Three seeded independent undirected Floyd-Warshall matrices check all centers,
including disconnected graphs. Tests cover shortcut re-layering (retained
edges cannot span more than one BFS level), 72-unit center spacing, 96-unit
radial gaps, separate component centers, typed-ID ties, unchanged row identities,
missing/returning centers, and 1,000 loop/parallel/reciprocal paths in both modes.
An independent SVG endpoint-arc converter flattens the actual path strings;
sampled geometry checks bounds and a 27.9-unit unrelated-center clearance,
covering the 18-radius search glyph, selected stroke and transparent hit path.
Camera state tests check v1 migration, v2 layout/root fingerprint compatibility
and the exact 4,096-character encoded boundary, including escaping expansion.

`test/release-topology.test.ts` checks a hand-audited directed fixture with
explicit expected IDs, endpoints, contributing row indices, sums, and paths.
An additional seeded graph uses a Floyd–Warshall all-pairs distance matrix
computed directly from input rows, independent of the production BFS/index.
Every returned path is checked against delivered endpoints and minimum length.
An explicit equal-length tie chooses relationship IDs rather than target-node
names, input order, or weights. Exact integer-sum expectations independently
check compensated aggregation and whole-group overflow; tooltip-only highlight
state must never manufacture a numeric highlighted weight.

Two additional source oracles read `samples/release/sample-contract.json` and
check independently specified outcomes: Services has 8 entities / 14 edge IDs;
Accounts retains 6 entities / 13 edge IDs, sums T01 to 120, preserves T11 zero,
marks T12/T13 unavailable, and omits both conflicting `T-CONFLICT` contributions.
The browser verifies the same counts and visible diagnostics.

The simultaneous-bound fixture contains 250 nodes and 1000 IDs:

* 250 self-loops;
* 250 forward ring relationships;
* 250 reverse ring relationships;
* 250 separately identified parallel forward relationships.

Five contributing copies produce exactly 5000 rows, 4000 duplicate contributions,
and no omitted topology. Expected native row-index groups are arithmetic, not
computed using the graph implementation under test. Additional 1000-loop,
1000-parallel, and 1000-reciprocal fixtures exercise routing without a geometry
cap. Tests check distinct paths, finite controls, endpoint clipping distances,
fit bounds, and pairwise node-center spacing independently. Saved-state tests
cover explicit valid, malformed, oversized, and out-of-range representations.

## Real-browser interaction and geometry

`release-browser.mjs` adds:

* 1.2 Circular/Radial author/local controls, root action, missing/returning roots,
  same-topology layout changes, unchanged selection/native identities and
  transformed mouse picking, all five maximum-topology tiles, keyboard lists,
  Arabic/high contrast/reduced motion and per-instance layout isolation.
  Actual browser SVG `getPointAtLength` sampling independently checks polar
  glyph clearance. Save/replay tests cover v2 cameras, v1 Force migration,
  incompatible geometry, and visible oversized-encoding refusal.
* Exact 80×80, 258×198, 398×298, 1280×620, and 1366×768 visual tiles;
  root dimensions, horizontal reachability, scrollable controls, graph/list
  recovery, actual SVG label/mark bounds, and label/label intersections.
  Both the normal fixture and full 250/1000/5000 fixture are rendered at every
  size; dense list pagination is keyboard-activated after returning from graph.
* The full mixed 250/1000/5000 fixture and three separate 1000-path concentration
  fixtures; all expected IDs and distinct visible route geometry are checked.
  Dense labels may be selectively placed only with the visible-count/dense
  disclosure; relationship paths must not be silently omitted.
* Every entity/relationship pagination page and unique ID, keyboard pager
  activation/focus restoration, and true Tab traversal through every first-page
  row button. This is not a claim of physical assistive-technology testing.
* Real mouse circle/edge picking, drag-versus-click discrimination, pointer
  capture cleanup, wheel-anchor invariance, keyboard pan/zoom/fit, and CDP
  Chromium touch pinch/pan/cancel plus tap. CDP input reaches Chromium's actual
  pointer pipeline; it is not a synthetic `dispatchEvent` pointer test or a
  physical touchscreen test.
* Three simultaneous plugin instances with isolated marker definitions,
  selection, camera, search, and destruction.
* Save-view requests and host metadata replay, appearance/view replay, invalid
  or removed saved state, rejected/deferred host promises, pending clear,
  data unbind/rebind, failed-render cleanup, and idempotent asynchronous destroy.
* Incident-list activation, path-local context menus, and node selection that
  includes locally hidden native row identities. Aggregate context menus have
  visual-level identity; only a single-row relationship supplies an exact row.
* Explicit graph/list labels for numeric-versus-text identities and significant
  or control whitespace; tooltip enable/show/hide failures, real wheel-triggered
  tooltip hiding without focus blur, and callback cleanup when destroy propagates
  a host tooltip error; help-induced auto-fit and manual-camera preservation
  during compact-toolbar changes.
* Arabic RTL, high-contrast palette, reduced-motion computed state, and SVG DOM
  captured **inside** `renderingFinished` and compared after paint opportunities.
  The latter is browser render-readiness evidence, not native export proof.

The existing `browser-test.mjs` retains its earlier package/legal/selection
checks while sharing the host/browser harness. Its former “wheel” check label
was corrected because it exercised buttons/keyboard only; the release suite
now performs a real wheel action.

Geometry snapshots intentionally retain visible-label counts and boxes. They
test label/label overlap, not all label/edge intersections. Preliminary visual
inspection found Review/Deploy labels crossed by relationship strokes in the
normal workflow fixture; the source owner was notified. This limitation must
not be described as “no overlap” without qualification.

## Benchmark protocol

`release-benchmark.mjs` takes a worktree-local exclusive lock, opens one browser
and one page, then measures operations in a fixed serial order. Five warmups are
discarded, followed by at least 30 retained samples **per layout/fixture/operation**.
No outliers are removed. Raw values and nearest-rank p50/p95/max are retained.

Protocol 3 covers Force, Circular and Radial using the same typical/maximum
fixtures and four operations: 24 groups, 720 measured samples by default.
All layouts use the predeclared fixture budgets; mode is included in comparison
keys. Do not run concurrent build/test commands during measurement.

The typical fixture has 7 entities / 10 IDs / 10 rows and includes loops,
reciprocity, parallel types, cycles, and a disconnected component. The maximum
fixture above has 250 / 1000 / 5000. Row permutation uses a seeded LCG/Fisher–Yates
shuffle (`0xA71A2026`, multiplier 1664525, increment 1013904223, modulus 2³²).
Each report stores the fixture SHA-256, allowing comparison to reject changed
fixtures.

The timed clock is browser `performance.now()`, excluding Node/Playwright
transport. Two separate statistics are retained:

1. **Synchronous action duration**: returning from `visual.update`, the local
   control-change sequence, or the real packaged click handler.
2. **End-to-end browser/mock-host wall clock**: the action above, required mock
   selection-promise settlement where applicable, and two animation-frame
   callbacks. Frames provide paint opportunities, not GPU presentation proof.

“Cold render” means topology-empty before the measured update; it is **not** a
cold browser, cold JavaScript engine, first-ever Power BI import, or network load.
DataView construction, graph reset, and host-selection clear are excluded.
Local neighborhood focus includes changing both entity and focus mode.
Selection is performed with full topology restored (not the smaller focused
subgraph), and includes asynchronous selection styling plus the mock promise
and paint opportunities. The mock has no native host processing delay.

The report records OS, CPU, logical processors, RAM, Node/Chromium versions,
artifact hash, process-name/count/CPU/memory snapshots, and aggregate CPU-busy
delta. Other visual/editor/browser sessions on this shared machine are **not**
stopped; the worktree lock prevents only another copy of this benchmark.
Windows `os.loadavg()` is not used as a meaningful contention measurement.
Results are local observations, not a controlled hardware or competitor study.

### Explicit engineering budgets

The predeclared end-to-end p95 budgets below express an interactive engineering
target, not a Power BI platform limit or marketing guarantee:

| Operation | Typical | Maximum |
|---|---:|---:|
| Topology-cold render | 400 ms | 1500 ms |
| Data update | 250 ms | 1000 ms |
| Local neighborhood focus | 150 ms | 350 ms |
| Relationship selection, **mock host** | 250 ms | 750 ms |

The first render gets more time than repeat navigation. The maximum fixture
gets additional allowance for full data reading, topology, DOM, and selection
styling. Candidate measurements in `RESULTS.md` establish the observed margin;
these budgets were not obtained by redefining every observed result as a pass.
Failures are reported rather than deleting slow samples or silently extending
the threshold.

## Screenshot provenance

All generated evidence stays under ignored `dist/`. Four optional labelled
views show **Services**, **Accounts**, dense overview, and dense neighborhood.
The first two use actual literal rows from
`samples/release/sample-contract.json`, not the smaller benchmark fixtures.
The adapter verifies that contract's GUID and source checksum, preserves string
IDs/leading zeros, negative/null/zero weights and conflicting IDs, and delivers
duration/event tooltip fields without inventing native DAX results. Accounts
keeps its visible diagnostics and scrolls the relationship list to the
unavailable-weight rows for the screenshot.

The screenshot manifest records the contract SHA and literal source SHA. These
are direct literal-row mock-host renders: **Power Query refresh, DAX grouping,
and the PBIP report itself have not been run**. Native query aggregation may
collapse duplicate rows before delivery, so mock duplicate-row diagnostics must
not be claimed to exactly reproduce native-host report output.

The final files are `services.png`, `accounts.png`, `dense-overview.png`, and
`dense-neighborhood.png`. The verified Marketplace image format is PNG, exactly **1366×768**,
1–5 files, each at most **1024 KB**. The capture checks PNG IHDR dimensions and
actual encoded byte length rather than relying on a filename or viewport guess.
Each screenshot uses a 1366×724 visual viewport plus a separate 44-pixel
provenance banner, producing the exact 1366×768 image. The visual itself is
also tested separately at the required 1366×768 tile size.

Meeting image dimensions/file size does **not** establish native-host behavior,
Partner Center acceptance, or AppSource certification. These remain accurately
labelled mock-host images, not screenshots of native Power BI.

Final screenshots require both strict current-package validation and an explicit
package-ready hash supplied by the package owner:

```powershell
$env:RELEASE_FINAL_READY_SHA = '<parent-confirmed full final PBIVIZ SHA-256>'
node scripts\release-browser.mjs --screenshots
```

The screenshot manifest repeats the archive SHA, image and visual-viewport
dimensions, encoded bytes, fixture caption, and mock-host limitation. No public
upload is performed.
