# Sealed offline quality candidate

**Evidence captured 2026-09-09; version 1.1.0.0. Owner runtime approval updated 2026-09-10.**

The owner approved external Atlyn storefront subscription acquisition with
intentionally ungated runtime/free shared viewing. This existing offline
renderer is intended; runtime licensing integration is no longer a blocker,
and it does not enforce paid-author status. No repackage/version bump or
modification of frozen bundles, source archives, manifests or images is made.
Historical "unlicensed" labels mean no runtime checks, not an amended license.

The additional Power BI visual certification badge is required, not obtained.
Main/certification ref movement, merging and submission remain on hold for the
parent's final native/assets/legal/release gate.

| Identity | Value |
|---|---|
| Package | `AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.1.0.0.pbiviz` |
| SHA-256 | `a291552f2b459da622513ece4eec440226693de1fbd7f91020ac4f441e2c1514` |
| Bytes | 149,064 |
| Interface API / installed SDK | 5.11.0 / 5.11.1 |
| Packaging tools | 7.2.1 |
| Source correspondence | Exact build-input hashes in `dist/build-inputs.json`; clean committed source required by immutable release manifest |

## Local outcomes

| Command / gate | Result and evidence |
|---|---|
| `npm run assets`, `typecheck`, `lint` | Passed; original 20px icon, 300px logo, English/Arabic resources |
| `npm test -- --reporter=json --outputFile=dist\unit-tests.json` | 94 tests passed, including 32 independent release cases |
| `npm run package` | Official SDK package/audit and actual ZIP inspection passed; no archive surgery |
| `npm run notices`, `certification` | Full shipped runtime terms retained in compiled JS; no forbidden runtime APIs, remote resources or privileges detected |
| `npm run test:browser` | 17 packaged Chromium groups passed; zero runtime requests/errors |
| `npm run test:release -- --screenshots` | 22 packaged groups passed; zero runtime requests/errors; four exact-package PNGs |
| `npm run benchmark` | 240 retained samples; every declared p95 budget met |
| `node scripts\release-profile.mjs` | DevTools CPU profile: 2,877 samples / 272 call-frame nodes; zero browser errors/requests |
| `npm run sample`; `node scripts\sample-package.mjs --validate` | 22 public-schema files, 34 bindings, exact package/resource hashes; fully authored offline PBIP |
| `pwsh -NoProfile -File scripts\validate-tmdl.ps1` | Official Microsoft TOM deserializes 8 tables, 14 measures and 6 relationships; required PBIR version/structure present |
| Full and runtime `npm audit --json` | Zero vulnerabilities in each scope |
| GitHub Actions permissions | `enabled=false`; workflow removed; no hosted runs |

Upstream Node module-type/Vite warnings, dependency missing-sourcemap warnings
and the SDK `fs.existsSync` deprecation warning remain visible in logs. They are
not hidden or represented as native failures.

The teardown regression was reproduced on the previous candidate: removing a
focused row during destroy triggered a blur tooltip call and an uncaught host
error. Event-driven tooltip callbacks now stop after destruction; the explicit
cleanup still propagates an error to the caller. The final browser case catches
that cleanup error and observes no duplicate call or uncaught page error.

Coverage includes all five exact requested tiles (80x80, 258x198, 398x298,
1280x620, 1366x768) with normal and maximum graphs; all paginated IDs; 1,000
distinct loop, parallel and reciprocal routes; real Chromium mouse/wheel/CDP
touch; three instances; settings/saved-view replay; native identity mocks;
unbind/rebind/errors/destroy; high contrast/RTL/reduced motion; and synchronous
browser rendering-finished geometry. **None is native Desktop/service/export,
physical touch, screen-reader, Power Query, DAX, or Microsoft certification proof.**

## Paired measurements

Protocol 2; one browser/page/operation at a time; five warmups plus 30 retained
samples for each of eight fixture/operation pairs. Frozen v1 and candidate ran
sequentially, yielding 480 measured samples. Nearest-rank percentiles, no outlier
removal. Timings include action work, mock selection settlement where relevant,
and two browser paint opportunities; they exclude fixture construction and
Node/Playwright transport.

Windows 10.0.26200 x64; AMD EPYC 7763; 16 logical CPUs; 68,665,831,424 bytes RAM;
Node 24.17.0; Chromium 145.0.7632.6. Baseline ran 23:12:08-23:13:07 UTC and
candidate 23:13:09-23:13:48 UTC. Aggregate shared-machine CPU busy was **15.1%
versus 27.9%**, respectively. Free RAM before each was 39,305,773,056 versus
39,458,848,768 bytes. Other editor/browser/Power BI processes were observed by
metadata, not controlled or used as native evidence.

Milliseconds, **p50 / p95 / max**, n=30 per cell:

| Fixture | Operation | Frozen v1.0 | Sealed candidate |
|---|---|---:|---:|
| Typical: 7 nodes / 10 edges / 10 rows | Topology-cold render | 33.3 / 35.0 / 35.1 | 33.1 / 35.0 / 35.0 |
| Typical | Data update | 33.0 / 34.2 / 34.9 | 33.0 / 35.0 / 35.1 |
| Typical | Local neighborhood | 33.0 / 34.6 / 34.9 | 33.2 / 35.0 / 35.0 |
| Typical | Relationship selection, mock host | 50.0 / 51.3 / 51.6 | 50.0 / 51.0 / 51.0 |
| Maximum: 250 / 1000 / 5000 | Topology-cold render | 333.0 / 350.5 / 354.2 | 233.2 / 317.3 / 349.7 |
| Maximum | Data update | 233.9 / 250.3 / 254.4 | 84.0 / 103.3 / 104.4 |
| Maximum | Local neighborhood | 33.2 / 34.9 / 35.4 | 33.2 / 35.0 / 51.0 |
| Maximum | Relationship selection, mock host | 199.2 / 232.8 / 233.9 | 67.0 / 83.8 / 84.0 |

Maximum render/update/selection observations improved, but neighborhood and
some typical observations did not. Contention differed. These are **not causal
attribution, native latency guarantees, or competitor timings**. Synchronous
and end-to-end raw samples are both retained in
`release-benchmark-baseline-v1-final.json` and `release-benchmark-final.json`;
the tiny synchronous selection-handler time is not complete selection latency.

The separate `release-maximum.cpuprofile` opens in Chromium DevTools' JavaScript
profiler. `release-profile.json` records five maximum rebuild/navigation/selection
cycles and page heap metrics before/after/destroy. Heap belongs to the whole
mock page; no forced-GC or leak-freedom claim is made.

## Actual-package media and visual review

Four PNGs are 1366x768 and below 1,024,000 bytes, visibly labelled **sealed
unlicensed quality candidate / mock Power BI host**. They are not fabricated
Desktop screenshots. Image and input hashes are tied to the package in release
evidence and the immutable manifest.

| File | Bytes | Content |
|---|---:|---|
| `services.png` | 66,654 | Actual Services literal contract, 8 entities / 14 relationships |
| `accounts.png` | 93,967 | Actual Accounts contract, 6 / 13 retained, conflict and incomplete-weight diagnostics visible |
| `dense-overview.png` | 393,525 | All 250 / 1000 / 5000 retained, 43 / 250 labels shown with disclosure |
| `dense-neighborhood.png` | 86,154 | Same maximum graph locally narrowed to 3 entities / 9 relationships |

The source owner inspected all four images. Component spacing, loop/reciprocal
routes, readable labels and local/list navigation materially improve inspection.
The full dense overview remains unsuitable for reading every edge; its caption
directs readers to zoom, focus or lists. Label/label collisions and fit bounds are
checked, but labels can cross relationship strokes (for example Orders and the
separate Review/Deploy benchmark fixture). No claim of zero edge crossings,
all-label visibility, or best-in-class layout is made.

## Remaining gates

The offline PBIP has three pages, two bound graph visuals, eight literal tables,
fourteen measures and six relationships. Public schemas and strict references
and official TOM deserialization are checked; M/DAX execution, Desktop refresh/render/save/reopen and a
genuine offline PBIX conversion remain with the coordinator. Source-only PBIP
validation does not close them.

Also pending: native selection/bookmark/context/tooltip propagation, service/mobile/actual
exports, native assistive technology, official submission dataset clarification,
legal/privacy/support/market approvals, secure Microsoft source access, and
authorized submission/review and the required additional Power BI visual
certification badge. See the Marketplace matrix and verified competitor
workflow comparison. The historical evidence remains unchanged; these
documentation updates do not move certification refs or authorize submission.
