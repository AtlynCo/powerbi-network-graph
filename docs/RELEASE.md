# Atlyn Network release gates

## Release identity and scope

- Publisher: Atlyn; private `AtlynCo/powerbi-network-graph` repository.
- Visual: Atlyn Network.
- Stable GUID: `AtlynNetworkAB24C68297094C32AF64D50D92C01711`.
- Visual version: `1.0.0.0`; npm version: `1.0.0`.
- Intended artifact: the audited `.pbiviz` package, not source renamed as `.pbix`.
- Certification-oriented engineering **does not mean Microsoft certified**.

This document is an **acceptance checklist, not a completed test report**. Unchecked items are required evidence, not known failures. Record the commit, tool versions, exact commands, dates, artifact hashes, outcomes, and remaining limitations in the authorized release record. Do not claim native outcomes from tests that use a mock host.

No publication, AppSource submission, public GitHub release, screenshot upload, or external distribution is authorized by completion of these gates. A draft PR or private package is not a release.

## 1. Source, identity, and packaging

- [ ] Confirm the private repository and correct source revision. Review the complete diff and working-tree status.
- [ ] Preserve the stable GUID; align `pbiviz.json`, package metadata, release notes, and artifact version.
- [ ] Confirm Node.js 24+ and a clean lockfile-based dependency installation (`npm ci`).
- [ ] Run `npm run assets` with the project-required Node.js version and review regenerated icon/localization output; do not rely on a lower upstream tool minimum.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm test`; retain actual outcomes.
- [ ] Run `npm run build` and `npm run package`; retain inspection and packaging logs.
- [ ] Use the isolated `scripts/package.mjs` wrapper with PowerShell 7 (`pwsh`) on Windows or OpenSSL on Unix/CI. Do not require `pbiviz install-cert` or mutate a user's certificate store/trust settings.
- [ ] Verify ignored `.tool-home` isolation, cleanup of local short-lived certificate/key/PFX/passphrase material, and exclusion of that private material from Git, the final package, logs, and release evidence. Check cleanup explicitly if packaging was interrupted.
- [ ] Preserve/revalidate the package wrapper's official `--all-locales` compatibility option for visuals tools 7.2.1 / formatting utilities 7. Confirm number/date culture data is bundled offline and UI resources remain `en-US`/`ar-SA`.
- [ ] After packaging, run `npm run test:browser` against that artifact; record browser/version and what was tested. Provision Chromium with `npx playwright install chromium` if needed, or use the documented browser-path overrides; do not treat offline mock-host browser checks as native Power BI verification.
- [ ] Run `npm run audit`; review runtime findings, remediation, and any documented exceptions. Separately review build/development dependencies as appropriate.
- [ ] Run `npm run certification`; examine every finding. This is a local readiness check, not a certificate.
- [ ] Run `npm run notices`; inspect notices for the exact distributed dependency versions and package contents.
- [ ] Retain matching fresh webpack statistics for runtime notice evidence. Inspect `dist\package-inspection.json`, `dist\browser-test-results.json`, `dist\certification-preflight.json`, and `dist\runtime-dependencies.json`; verify their hashes identify the final tested artifact.
- [ ] Confirm the package contains the intended capabilities, localized strings, icon, and runtime code; reject stale or unexpected output.
- [ ] Record a SHA-256 hash of the final inspected artifact and test that exact artifact in native hosts.

Example hash command after packaging:

```powershell
Get-FileHash -Algorithm SHA256 .\dist\AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.0.0.0.pbiviz
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
- [ ] Verify a single-identity edge's native context menu; entity and multi-identity edge context menus are explicitly visual-level.
- [ ] Verify default and report-page tooltips in Desktop and service, including aggregated relationship identity propagation, model formats, all eight optional measures, keyboard focus, and missing identities.

The current context-menu SDK surface accepts a single identity. Do not pass an arbitrary incident identity for a node or silently substitute a first identity for an aggregate. Revisit array support only with a verified SDK/host contract and tests.

## 4. Rendering, accessibility, and responsiveness

- [ ] Verify bounded deterministic synchronous layout with no simulation/timer, external assets, or animations; repeated highlight/selection updates must not restart layout.
- [ ] Verify readable directed arrows and nonoverlapping paths for representative reciprocal/parallel groups and multiple loops.
- [ ] Verify Fit includes curves, loop extents, and labels; test zoom extremes, pan, resize, and empty data transitions.
- [ ] Use keyboard only: all toolbar actions, entity/relationship lists, activation, local focus, list navigation, Previous/Next pages, context menus, and clear selection.
- [ ] Traverse every loaded entity and relationship through lists after resetting local filters; no graph-only required action.
- [ ] Test with a screen reader: names, help, loaded counts, warnings, selected/mixed states, button focus, and page changes.
- [ ] Verify host high contrast and normal palettes; information must not depend on color alone.
- [ ] Verify `en-US` and `ar-SA`, RTL controls, mixed-direction IDs, localized warnings/tooltips/formatting, and long labels.
- [ ] Verify reduced-motion preference; all modes remain animation-free.
- [ ] Test normal, tiny, compact, very wide, and large/tall visual viewports; ensure scrollable controls/lists remain usable.
- [ ] Verify modern formatting changes and persistence: entity color, relationship color, label visibility, and 8–24 label size.

Browser tests can support DOM/SVG, keyboard, layout, and injected-host behavior. They cannot certify assistive-technology behavior inside native Power BI.

## 5. Native Desktop, service, and export matrix

Record tested Desktop build, operating system, browser, service environment, report revision, artifact hash, tenant setting, and result for each case.

| Environment | Required verification | Evidence status |
| --- | --- | --- |
| Power BI Desktop | Import exact package; bind/rebind; save/reopen; selection; context; default/report tooltips; formatting; resize | Manual gate; not asserted here |
| Power BI service | Authorized private test deployment; tenant policy; visual loading; selection/tooltips; browser/locale behavior | Manual gate; not asserted here |
| PDF export | Actual export from authorized host; custom-visual availability; complete intended visual viewport; graph/list clipping and empty output | Manual gate; not asserted here |
| PowerPoint export | Actual export; custom-visual availability; full-viewport bounds and fidelity, not just a browser screenshot | Manual gate; not asserted here |
| Keyboard / assistive technology | Native host focus order, accessible lists, notices, all loaded-data pages, high contrast/RTL | Manual gate; not asserted here |

Uncertified custom visuals may be unavailable for some export routes or blocked by tenant policy. Document the observed supported route; do not promise PDF/PPT compatibility or certification. Browser screenshots, mocks, and package generation do not close these gates.

## 6. Privacy, ownership, and approval

- [ ] Confirm `privileges: []`, no external JavaScript/assets, no runtime network requests, no telemetry, no authentication, no license gating, and no dynamic evaluation.
- [ ] Inspect final runtime/package output, not only source, for unexpected content or dependencies.
- [ ] Confirm proprietary Atlyn licensing and fulfill third-party notices/license obligations.
- [ ] Verify support responsiveness and suitability for the distribution audience before publication/external distribution. Existing metadata is Atlyn / `atlyn.help@gmail.com` / `https://www.atlynco.com/docs/faq`; the coordinator has confirmed it and verified support-page content. This confirmation does not close the responsiveness gate or authorize publication.
- [ ] Explain that private GitHub source/issues/PR URLs require authorized access; provide a verified support route appropriate to any eventual distribution audience.
- [ ] Ensure all examples are synthetic and no report, dataset, credentials, screenshots, or customer identifiers are unintentionally distributed.
- [ ] Review product wording: relationship exploration only; no causal prediction, fraud-detection, complete-network, or full process-mining claims.
- [ ] Obtain separate owner authorization for any distribution or publishing action. This project is currently private only.

## Native sample project deferral

The repository supplies offline CSV and Power Query source, **not a validated native PBIX/PBIP**. Follow [samples/README.md](../samples/README.md), import the exact package in Desktop, and save/reopen a native report there. If saving PBIP, let Desktop generate its report and semantic-model structure, validate the project's data-source portability, and test a clean reopen before calling it self-contained.

Do not handcraft placeholder project metadata, refer to nonexistent semantic models, or label a file-based query with an absolute local path as a portable offline PBIP. A future approved native sample must have documented Desktop provenance and successful reopen/export evidence.
