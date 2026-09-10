# Submission and additional-certification gates

**Verified requirements: 2026-09-09. No checkbox below represents a completed native or Microsoft test.**

**2026-09-10 owner approval:** external Atlyn storefront subscription acquisition with ungated visual runtime/free shared viewing. There is no paid-author enforcement or pending runtime licensing integration. Preserve offline behavior; do not add keys, new signing/AAD/API systems, feature gates or requests. The additional Microsoft Power BI visual certification badge is a required release outcome, not a completed gate. Main/certification refs, merging and submission remain held for the parent's final gate.

Sources:

1. [Testing submissions](https://learn.microsoft.com/en-us/power-bi/developer/visuals/submission-testing) — general, browser, Desktop and performance cases.
2. [Marketplace policy §1180 / §1200](https://learn.microsoft.com/en-us/legal/marketplace/certification-policies#1180-power-bi-visuals) — visual functionality and additional certification.
3. [Certification requirements](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified) — source, code, tools, commands, sample dataset and reviewer access.
4. [Publishing guidelines](https://learn.microsoft.com/en-us/power-bi/developer/visuals/guidelines-powerbi-visuals) — context menu, logos, IAP and landing-page guidance.

Record **package SHA-256, source commit, tool/Desktop/browser/OS version, input dataset, steps, expected/actual result, capture/log location and operator/date** for each executed case. A test is unexecuted until that evidence exists. Existing unit/mock-host tests can be linked as partial evidence, not substituted for native checks.

## Host-version control

- [ ] Test the actual new package with the **unchanged GUID**. Microsoft warns that AppSource's version may override a locally imported one.
- [ ] If the visual has an AppSource version, enable Desktop **CURRENT FILE → Report settings → Developer Mode → Turn on developer mode for this session**, and repeat for each new Desktop session. Do not change GUID to defeat version loading.
- [ ] If a service session is later authorized, use the documented developer-mode mechanism there and verify the loaded version.
- [ ] Record actual loaded version/package evidence; a filename alone is insufficient.

## General submission matrix

All rows start **UNVERIFIED**. Tests requiring cloud publication remain blocked by the current no-publish authorization; no automated cloud execution is permitted.

| ID | Required exercise | Acceptance specific to Atlyn Network |
| --- | --- | --- |
| G01 | Stacked column chart with Category/Value → Network → column chart | No crash/console exception; unsupported/missing Source/Target configuration gives a safe explanation |
| G02 | Gauge with three measures → Network → Gauge | No crash; no assumption that category buckets exist |
| G03 | Select in Network; select in other visuals | Native identities cross-filter appropriately both ways; relationship selections are not falsely described as entity-dimension filters |
| G04 | Min/max mapping configurations | One Source and Target; max one Weight/Type/Edge ID; zero–eight tooltip measures; invalid combinations are safe |
| G05 | Remove fields in every relevant order | Graph, lists, selection state and tooltips clean up; no stale data or exceptions |
| G06 | Format pane under every bucket configuration | No null reference errors; supported controls appear and persist |
| G07 | Visual/page/report filter-pane filtering | Topology and host tooltips reflect the actual filtered context |
| G08 | Slicer filtering | Type slicers filter graph and detail table; tooltips remain correct |
| G09 | Published/native pie/column selection filtering | Proper incoming filter/highlight behavior and tooltip values |
| G10 | Cross-filtering where supported | Outgoing native relationship selections affect other visuals as configured |
| G11 | Ctrl, Alt and Shift selections | No unexpected action; Ctrl/Cmd documented native multiselect behavior; no fabricated Alt/Shift features |
| G12 | Actual size, Fit to page, Fit to width | Pointer/pinch/wheel coordinates and hit-testing stay correct |
| G13 | Resize, minimum report/visual size | No display errors; compact/list fallbacks remain operable |
| G14 | Scrollbars at multiple sizes | Needed controls/list rows reachable; no excessive or detached scrollbars |
| G15 | Pin to dashboard | Correct rendering/state in a real tile; **future authorized service gate** |
| G16 | Multiple instances/versions on one page and across pages | Instances do not leak selection, DOM, persisted state or lifecycle handlers |
| G17 | Switch report pages | Render and interactions restore without stale topology |
| G18 | Reading and Edit views | All appropriate functions work; no commercial logo in Reading view |
| G19 | Add/change/delete data with animations, if present | No animation is currently implemented; verify static update correctness and record applicability |
| G20 | Stress every property, custom text and invalid values | Formatting/settings safely constrain values; malformed persisted local view resets visibly |
| G21 | Save/reopen and page-away/page-back | Appearance/view settings persist; saved local view works without restoring a misleading host selection |
| G22 | Every advertised feature | Search, incident/neighborhood, upstream/downstream, shortest loaded path, camera, lists, selection, tooltips and save-view semantics match docs |
| G23 | Numeric/date/character types and model format strings | Accepted numeric/text IDs keep identity; unsupported date IDs fail safely; date/numeric tooltip measures retain formatting |
| G24 | Tooltip/label formatting; automatic numeric formatting on/off | No raw/misleading values, format exceptions or locale regressions |
| G25 | Different data volumes: thousands, one row and two rows | Valid bounded behavior and accurate omission disclosures; no crash |
| G26 | Null, infinity, negatives, wrong types | Safe invalid-ID/conflict diagnostics; zero remains valid; incomplete/overflow weight is not presented as complete |
| G27 | Context menus, including keyboard | Required right-click works; entity/multi-identity scope is visual-level, not an arbitrary chosen identity |

## Policy data and platform coverage

Policy §1180.2 explicitly names **string values, empty values, negative values, at least 20,000 rows, and large 16-digit numbers**. The 20,000-row input test does **not** mean this visual promises to display all 20,000 rows. Feed that source/model volume, inspect host data reduction, validate the 5,000 delivered-row cap and further topology limits, and record every omission warning. Test direct oversized DataViews locally as separate bounded-processing evidence.

- [ ] Validate identifier type/case/leading zeros, missing endpoints and Edge IDs, reciprocal/parallel/self edges, duplicated matching IDs, conflicting IDs, unweighted and incomplete/overflow measures.
- [ ] Validate model aggregation before visual delivery; duplicate T01 can group into one category tuple. Do not expect a raw-row duplicate notice when Power BI already combined it.
- [ ] Test 16-digit identifiers as **Text** to preserve digits; when numeric precision has already been lost upstream, do not claim the visual can recover it.
- [ ] Cover supported Desktop, Power BI Online, mobile and the Windows universal-app platform wording in policy, including touch-only devices. Resolve actual currently available/supported clients with Microsoft if legacy policy labels no longer correspond to an obtainable client; do not fabricate a pass.
- [ ] Follow least privilege; no unsolicited external launches, popup windows, credential prompts, required extra file installations or unreasonable permissions.

## Desktop, browser and accessibility

- [ ] **Current Power BI Desktop:** all features, import, save, reopen, and the documented Publish-to-service case. Publishing is **not authorized by this task**; keep it unresolved.
- [ ] Change numeric format precision between zero and three decimal places; inspect tooltips and visual values.
- [ ] Validate keyboard-only workflows, focus order/visibility, Context Menu key/Shift+F10, accessible lists, high contrast, English, Arabic/RTL, touch pan/pinch and reduced-motion/static behavior.
- [ ] AppSource validates current **Windows Chrome, Edge and Firefox**. Package-rendering mock tests on one Chromium build do not cover the other engines or native host behavior.
- [ ] Optional documented coverage includes previous Windows Chrome/Edge/Firefox, macOS Chrome/Firefox/Safari, Linux Firefox, iPad Safari/Chrome and Android Chrome. The source still lists IE11 as optional; this is not a new Atlyn support promise.

## Performance

- [ ] Use developer-tool profiling, not only perceived speed or console timers, as Microsoft requests.
- [ ] Profile dense/capped topology, initial render, repeated updates, selection, filtering, resizing, page changes and teardown using the **actual packaged JS/CSS**.
- [ ] Record dataset counts, delivered/retained counts, machine/browser versions, trace, update duration and memory behavior. State whether measurements are mock-host or native.
- [ ] Verify no app freeze; inspect small and large disconnected components, high-degree entities and selection actions above 200 complete identities. Do not weaken truthful limits for a screenshot.

## Additional certification code/source gates

- [ ] Obtain the explicitly required additional Power BI visual certification/badge; general Marketplace listing approval and local preflight do not satisfy it.
- [ ] Single non-R visual, reviewable OSS components only, no private/commercial unreviewable runtime dependencies.
- [ ] Latest API/tools requirement reconciled with approved release contract; exact-source reproducible final package.
- [ ] Required files/dependencies/lint command, no tracked `node_modules`, `.tmp`, `dist` in source submission.
- [ ] `npm install`, `npm run package`/documented official packaging, required ESLint and `npm audit`; no moderate/high audit warnings (also resolve critical vulnerabilities).
- [ ] Rendering started/finished/failed API correctly reports lifecycle, including exceptional/empty/invalid inputs.
- [ ] Safe DOM/user-data handling; no `innerHTML`/D3 HTML with data, unsafe dynamic code, eval/Function, prohibited network APIs/resources, unhandled browser errors or minified authored source.
- [ ] Empty/omitted WebAccess privilege; no outgoing HTTP(S)/WebSockets, external resources, telemetry or remote fonts/assets.
- [ ] Use Microsoft's linked [certification test sample dataset](https://github.com/PowerBi-Projects/PowerBI-visuals/tree/gh-pages/assets) as requested, in addition to Atlyn's synthetic graph sample. The official link currently exposes asset subdirectories rather than an obvious standalone sample PBIX; document the exact dataset used or request clarification from Microsoft. Do not quietly substitute our sample and mark this gate complete.
- [ ] Lowercase `certification` branch, frozen exact commit and secure Microsoft reviewer access including dependencies. Owner action only.
- [ ] If an already certified visual is updated, obtain certification for the update too; certification does not automatically carry over.
- [ ] Confirm source/property changes preserve previous reports; test v1 report upgrade without changing GUID.

## Offline sample and final approval

- [x] Fully authored PBIP exists: two bound graph pages, slicers/detail tables, hints, typed literal tables, measures and model relationships.
- [x] Local source schema/referential validation and exact candidate PBIVIZ/resource hash checks execute through `scripts/sample-package.mjs`.
- [ ] **Rerun assembly after final source/package freeze**; confirm evidence references the final hash, not the earlier candidate.
- [ ] Native Desktop open/refresh succeeds without any external data connection.
- [ ] Both graph pages render correctly; slicers, detail tables and measures execute as intended.
- [ ] Save real PBIX, reopen/refresh offline, inspect embedded custom visual version and content against final artifact.
- [ ] Record genuine legal, pricing, privacy, support, publisher, market and media approvals.
- [ ] Authorized owner approves submission; Microsoft review outcome remains external and unresolved.
