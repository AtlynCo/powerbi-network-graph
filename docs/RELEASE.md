# Atlyn Network release gates

## Release identity and scope

- Publisher: Atlyn; private `AtlynCo/powerbi-network-graph` repository.
- Visual: Atlyn Network.
- Stable GUID: `AtlynNetworkAB24C68297094C32AF64D50D92C01711`.
- Current candidate visual version: `1.2.0.0`; npm version: `1.2.0`.
- Intended artifact: the audited `.pbiviz` package, not source renamed as `.pbix`.
- Certification-oriented engineering **does not mean Microsoft certified**.

On 2026-09-10 the owner approved the existing pattern: **external Atlyn storefront subscription acquisition, intentionally ungated visual runtime, and free shared viewing**. The current offline renderer is intended; no runtime licensing work or paid-author enforcement is required. Do not add keys, new signing/AAD/API systems, feature gates, WebAccess, or runtime license requests. Keep the frozen packages, source archives and manifests unchanged; this documentation decision does not require repackaging or a version bump.

The **additional Microsoft Power BI visual certification badge is required**, separately from general Marketplace listing approval. It is not yet obtained. Main/certification ref movement, merging and submission remain held for the coordinator's final native/assets/legal/release gate, not an awaiting-paid-integration gate.

This document is an **acceptance checklist, not a completed test report**. Unchecked items are required evidence, not known failures. Record the commit, tool versions, exact commands, dates, artifact hashes, outcomes, and remaining limitations in the authorized release record. Do not claim native outcomes from tests that use a mock host.

No publication, AppSource submission, public GitHub release, screenshot upload, or external distribution is authorized by completion of these gates. A draft PR or private package is not a release.

## 1. Source, identity, and packaging

- [ ] Confirm the private repository and correct source revision. Review the complete diff and working-tree status.
- [ ] Preserve the stable GUID; align `pbiviz.json`, package metadata, release notes, and artifact version.
- [ ] Confirm Node.js 24+ and a clean lockfile-based dependency installation (`npm ci`).
- [ ] Run `npm run assets` with the project-required Node.js version and review regenerated icon/localization output; do not rely on a lower upstream tool minimum.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm test`; retain actual outcomes.
- [ ] Run the certification-named `npm run eslint` entry point as well; it preserves Microsoft's documented command separately from the focused lint script.
- [ ] Run `npm run build` and `npm run package`; retain inspection and packaging logs.
- [ ] Run all gates locally; do not run GitHub Actions, hosted CI/CD, cloud coding or Codespaces. Use the isolated `scripts/package.mjs` wrapper with PowerShell 7 (`pwsh`) on Windows or OpenSSL on a local Unix host. Do not require `pbiviz install-cert` or mutate a user's certificate store/trust settings.
- [ ] Verify ignored `.tool-home` isolation, cleanup of local short-lived certificate/key/PFX/passphrase material, and exclusion of that private material from Git, the final package, logs, and release evidence. Check cleanup explicitly if packaging was interrupted.
- [ ] Preserve/revalidate the package wrapper's official `--all-locales` compatibility option for visuals tools 7.2.1 / formatting utilities 7. Confirm number/date culture data is bundled offline and UI resources remain `en-US`/`ar-SA`.
- [ ] After packaging, run `npm run test:browser` against that artifact; record browser/version and what was tested. Before provisioning Chromium with `npx playwright install chromium`, set `PLAYWRIGHT_BROWSERS_PATH` to the worktree-local `.browser-cache` path to match the runner default, or use the documented explicit path override consistently. Do not treat offline mock-host browser checks as native Power BI verification.
- [ ] Run `npm run audit`; review runtime findings, remediation, and any documented exceptions. Separately review build/development dependencies as appropriate.
- [ ] Run `npm run certification`; examine every finding. This is a local readiness check, not a certificate.
- [ ] Run `npm run notices`; inspect notices for the exact distributed dependency versions and package contents.
- [ ] Retain matching fresh webpack statistics for runtime notice evidence. Inspect `dist\package-inspection.json`, `dist\browser-test-results.json`, `dist\certification-preflight.json`, and `dist\runtime-dependencies.json`; verify their hashes identify the final tested artifact.
- [ ] Confirm the package contains the intended capabilities, localized strings, icon, and runtime code; reject stale or unexpected output.
- [ ] Record a SHA-256 hash of the final inspected artifact and test that exact artifact in native hosts.

Example hash command after packaging:

```powershell
Get-FileHash -Algorithm SHA256 .\dist\AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.2.0.0.pbiviz
```

Do not silently convert a warning into a passing gate. Keep verification artifacts private and exclude report/customer data and credentials.

## 2. Data and graph semantics

- [ ] Bind one categorical Source ID and one Target ID; independently verify optional numeric Weight, Relationship type, Edge ID, and up to eight tooltip measures.
- [ ] Verify valid text and finite-number IDs, exact type/case distinction, significant leading/trailing spaces, the 512-character limit, and rejection of empty/whitespace-only/unsupported IDs.
- [ ] Verify endpoint-only nodes. A self-link must remain a real arrowed relationship, never an isolate placeholder.
- [ ] Without Edge ID, verify duplicate directed source/target/type rows aggregate weights and union all contributing identities.
- [ ] With Edge ID, verify matching repeated IDs aggregate with a duplicate notice when delivered separately.
- [ ] Verify conflicting reuse of an Edge ID omits **every delivered occurrence of that ID** and exposes diagnostics, regardless of input order.
- [ ] Preserve cycles, reciprocal directions, parallel edges, and loops. No cycle-removal algorithm is allowed.
- [ ] Verify missing/negative/nonnumeric/nonfinite/overflowing weight contributions leave the relationship present, disclose incomplete weight, and use neutral edge styling. Verify zero and absent Weight separately.
- [ ] Verify model-format and locale formatting for weights and tooltip measures; differing tooltip values must not be silently summed.
- [ ] Verify highlight-only updates retain topology and positions; report filters may change topology.
- [ ] Verify at/over 5,000 processed rows, 250 nodes, and 1,000 edges. Capping is deterministic within processed input, retains whole edges, and derives nodes only from kept endpoints.
- [ ] Verify capped or invalid/conflicting/segmented data visibly disclose known incompleteness.
- [ ] Verify the visual never calls `fetchMoreData`. Search, traversal, and counts must remain labeled **loaded** even without a host segment marker; absence of a marker is not proof of the complete model.
- [ ] Verify cycle-safe upstream/downstream traversal and single-hop neighborhood, including disconnected components and self-links.
- [ ] Verify incident-only focus and deterministic shortest directed paths, including unreachable targets and focus-to-self paths. Confirm every result describes loaded topology only.
- [ ] Verify stable compensated weight aggregation under row permutations; an overflowing group must have unavailable weight, never an arbitrary partial sum.
- [ ] Verify tooltip text/format budgets and that omitted tooltip values produce a notice without silently removing topology or creating distinct-value counts.

Power BI may aggregate equal categorical rows before delivery. Verify delivered-row behavior in automated fixtures and model-level behavior in Desktop separately; neither establishes the other.

## 3. Native selection, context, and tooltips

Use an actual report with a relationship table, another visual displaying those relationship records, and report filters. Record the model relationships and **Edit interactions** configuration.

- [ ] Edge activation selects all contributing identities, not an arbitrary first row.
- [ ] Entity activation explicitly means **select loaded incident relationships**, including incident edges hidden by local focus/search; it is not an entity-level filter.
- [ ] Deduplicate identities and verify exactly 200 are allowed; 201 refuses the entire action with a clear message and no changed partial selection.
- [ ] Missing identities refuse affected selection; no partial or made-up identity is sent.
- [ ] Verify Ctrl/Cmd native relationship multiselect, selected/mixed states, and incoming native selection updates. Check overlapping incident groups using native SDK toggle semantics; do not assert additive union or an entity-multiselect abstraction.
- [ ] Clear report selection independently of pan/zoom, local focus, and search.
- [ ] Verify local focus/search/traversal do not send a report filter or alter native selection.
- [ ] Verify disabled host interactions are respected, and host selection/context failures produce usable notices.
- [ ] Verify pending selection followed by Clear settles cleared; destroy prevents late host actions. Tooltip failures must leave the accessible relationship list usable.
- [ ] Verify a single-identity edge's native context menu; entity and multi-identity edge context menus are explicitly visual-level.
- [ ] Verify default and report-page tooltips in Desktop and service, including aggregated relationship identity propagation, model formats, all eight optional measures, keyboard focus, and missing identities.

The current context-menu SDK surface accepts a single identity. Do not pass an arbitrary incident identity for a node or silently substitute a first identity for an aggregate. Revisit array support only with a verified SDK/host contract and tests.

## 4. Rendering, accessibility, and responsiveness

- [ ] Verify Force is the absent-property/v1 default and has unchanged positions/routes. Test Circular typed-ID ordering and Radial minimum undirected hops with an independent distance oracle.
- [ ] Verify automatic/explicit center, separately packed components, missing-center disclosure and reappearance. Self/parallel edges and weights must not distort root scoring or distance.
- [ ] Verify >=72-unit center spacing, >=96-unit radial ring gaps, complete edge/row preservation, glyph-safe polar routes, arc/loop bounds, outward horizontal labels and dense disclosure.
- [ ] Verify local layout/root actions never select/filter/persist; only Save local view writes a snapshot. Test v1 migration, mode/root-aware camera compatibility and 4,096-character encode/decode refusal.
- [ ] Verify the author layout property and local selectors in every tile/locale/contrast mode, transformed picking, multiple instances, saved state and complete keyboard lists.
- [ ] Verify bounded deterministic synchronous layout with no simulation/timer, external assets, or animations; repeated highlight/selection updates must not restart layout.
- [ ] Verify readable directed arrows and nonoverlapping paths for representative reciprocal/parallel groups and multiple loops.
- [ ] Verify Fit includes curves, loop extents, and labels; test zoom extremes, pan, resize, and empty data transitions.
- [ ] Use keyboard only: all toolbar actions, entity/relationship lists, activation, local focus, list navigation, Previous/Next pages, context menus, and clear selection.
- [ ] Traverse every loaded entity and relationship through lists after resetting local filters; no graph-only required action.
- [ ] Test with a screen reader: names, help, loaded counts, warnings, selected/mixed states, button focus, and page changes.
- [ ] Verify host high contrast and normal palettes; information must not depend on color alone.
- [ ] Verify `en-US` and `ar-SA`, RTL controls, mixed-direction IDs, localized warnings/tooltips/formatting, and long labels.
- [ ] Verify reduced-motion preference; all modes remain animation-free.
- [ ] Test 80×80, 258×198, 398×298, 1280×620, and 1366×768; ensure graph/list switching and scrollable controls/lists remain usable.
- [ ] Verify modern formatting changes and persistence: entity color, relationship color, label visibility, 8–24 label size, overlap avoidance, and initial view.
- [ ] Verify pan starting over marks, move/tap discrimination, two-pointer pinch, transformed picking, and simultaneous visual instances.
- [ ] Verify explicit Save local view and native bookmark replay separately from report selection; invalid or unavailable-entity snapshots must reset visibly.
- [ ] Inspect actual dense final-package screenshots and retain reproducible render/navigation/selection p50/p95/max with hardware, warmups, samples, and contention disclosed. A local mock selection roundtrip is not native report-filter latency.

Browser tests can support DOM/SVG, keyboard, layout, and injected-host behavior. They cannot certify assistive-technology behavior inside native Power BI.

## 5. Native Desktop, service, and export matrix

Record tested Desktop build, operating system, browser, service environment, report revision, artifact hash, tenant setting, and result for each case.

| Environment | Required verification | Evidence status |
| --- | --- | --- |
| Power BI Desktop | Import exact package; bind/rebind; save/reopen; selection; context; default/report tooltips; formatting; resize | Bounded coordinator evidence on 2.157.1354.0: corrected sample's three pages, second observed refresh, Public PBIX save/cold-reopen. Remaining interaction/formatting/rebind cases unverified |
| Power BI service | Authorized private test deployment; tenant policy; visual loading; selection/tooltips; browser/locale behavior | Manual gate; not asserted here |
| PDF export | Actual export from authorized host; custom-visual availability; complete intended visual viewport; graph/list clipping and empty output | Manual gate; not asserted here |
| PowerPoint export | Actual export; custom-visual availability; full-viewport bounds and fidelity, not just a browser screenshot | Manual gate; not asserted here |
| Keyboard / assistive technology | Native host focus order, accessible lists, notices, all loaded-data pages, high contrast/RTL | Manual gate; not asserted here |

Uncertified custom visuals may be unavailable for some export routes or blocked by tenant policy. Document the observed supported route; do not promise PDF/PPT compatibility or certification. Browser screenshots, mocks, and package generation do not close these gates.

The [dated native record](validation/RESULTS.md#bounded-native-desktop-result-2026-09-10)
includes exact PBIX/PBIVIZ hashes and embedded-member equality. The first refresh
left manual-refresh/incomplete-data banners; only the second observed refresh
completed with no dialog. This is not full-matrix or first-refresh acceptance,
and does not authorize merging, certification-reference changes or submission.

## 6. Privacy, ownership, and approval

- [ ] Confirm `privileges: []`, no external JavaScript/assets, no runtime network requests, no telemetry, no authentication, no license gating, and no dynamic evaluation.
- [ ] Inspect final runtime/package output, not only source, for unexpected content or dependencies.
- [ ] Confirm proprietary Atlyn licensing and fulfill third-party notices/license obligations.
- [ ] Preserve the existing first-party `UNLICENSED` package identifier and proprietary `LICENSE`; do not invent or substitute an open-source license or customer contract.
- [ ] Ensure listing copy distinguishes external subscription acquisition from ungated runtime/free shared viewing; do not claim paid-author enforcement.
- [ ] Obtain the required additional Power BI visual certification/badge through Microsoft's review; do not infer it from local preflight or Marketplace listing approval.
- [ ] Verify support responsiveness and suitability for the distribution audience before publication/external distribution. Existing metadata is Atlyn / `atlyn.help@gmail.com` / `https://atlynco.github.io/atlyn-powerbi-support/docs/faq/`; the coordinator has confirmed it and verified support-page content. This confirmation does not close the responsiveness gate or authorize publication.
- [ ] Explain that private GitHub source/issues/PR URLs require authorized access; provide a verified support route appropriate to any eventual distribution audience.
- [ ] Ensure Atlyn examples are synthetic, third-party test rows are attributed, and no report, dataset, credentials, screenshots, or customer identifiers are unintentionally distributed.
- [ ] Review product wording: relationship exploration only; no causal prediction, fraud-detection, complete-network, or full process-mining claims.
- [ ] Obtain separate owner authorization for any distribution or publishing action. This project is currently private only.

## Authored offline sample and submission baseline

The release must include a fully authored offline PBIP source with useful bound report pages, semantic-model tables, literal synthetic data, and the exact tested embedded visual. Validate schema/reference/field bindings and retain its asset hashes. Authored source validation is **not** evidence that Desktop has opened, rendered, saved, or reopened it.

The coordinator owns native Desktop opening and conversion to a real PBIX, service/export evidence, genuine legal/pricing approvals, and live Partner Center actions. Do not fabricate PBIX, native screenshots, successful import, certification, or publication approval. Freeze a lowercase certification source baseline only after final source is committed, and never overwrite an existing submitted baseline.

## 1.2 candidate readiness boundaries (2026-09-24)

Current local outcomes and hashes belong in the separate
`docs/validation/RESULTS-1.2.md` and the worktree's `dist` reports, not the frozen
1.1 evidence. Preserve the `1.1.1.0` sample archive and all existing marketplace
media/provenance. The 1.2 sample has five pages and four bound graph visuals;
only its new versioned package is embedded.

| Gate | Current evidence boundary / owner action |
| --- | --- |
| Source, package, API/tools | Stable GUID/data roles; API 5.11.0 from SDK 5.11.1, tools 7.2.1. Run local schema, unit, type, ESLint, `package --certification-audit`, audit and compiled-code preflight. Recheck latest SDK/tools before submission. |
| Sample | Offline literal PBIP with Force, Circular and Radial pages; schema/model preflight is not native loading. A **new 1.2.0.0 PBIX** must be genuinely opened/refreshed/saved/cold-reopened in Desktop and its embedded bytes matched to the final package. The old 1.1.0.0 PBIX cannot satisfy this. |
| Native host | Desktop 2.157.1354.0 is reported installed by the coordinator, but this work does not operate the shared native UI. Desktop/Service selection, bookmark replay, format painter, reading/edit modes, tooltips, interactions, multi-page/multi-instance, saves and actual exports require owner verification. |
| Events | `renderingStarted` begins updates; exactly one finished/failed terminal event is exercised with the compiled mock host, including error states. This is not native export proof. |
| Images | Existing 300x300 logo remains a candidate asset. New 1.2 screenshots may be generated only under `dist/release-screenshots` with the exact package SHA, explanatory callouts and explicit mock-host labels; 1–5 PNGs, 1366x768, <=1,024,000 bytes. Owner must approve final listing media. |
| Support/privacy | Manifest uses the public HTTPS support FAQ. Accessibility/content of that page is not a support SLA. A verified owner-approved HTTPS privacy-policy URL remains unresolved. |
| Terms | Repository `LICENSE` is a proprietary rights notice requiring a separate agreement; it is **not an approved customer EULA or Partner Center contract choice**. Owner/legal approval is required; do not generate substitute legal terms. |
| External review | Partner Center publisher/access/terms/submission and Microsoft's certification review remain unsatisfied external gates. No credentials, publication, certification-ref movement or release action is authorized by local passes. |

The API 5.11.1 capability schema supports `filterState` and
`suppressFormatPainterCopy` on `navigation.savedView`; both are set. This
aligns local saved properties with Microsoft's bookmark guidance without
issuing report filters. Native bookmark/painter behavior is still unchecked.
