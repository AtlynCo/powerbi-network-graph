# Atlyn Network for Power BI

An offline custom visual for exploring **directed relationships supplied by a Power BI report**. Display cycles, reciprocal links, parallel relationships, and self-links without forcing the data into a tree. Explore the loaded graph with local search, neighborhood and directional traversal, or use accessible entity and relationship lists.

**Status:** private Atlyn development project; version `1.0.0.0`. Certification-oriented, **not Microsoft certified**. Packaging and browser checks are not evidence of native Desktop, service, or export compatibility. See the [release gates](docs/RELEASE.md) before distribution.

## Scope

- Nodes come only from relationship endpoints. Standalone isolated entities are not supported.
- Source-to-target direction is preserved, including cycles and reciprocal relationships.
- Deterministic, bounded synchronous force layout; no ongoing simulation, timers, or animation.
- Curved parallel/reciprocal links and arrowed loops; entity labels, pan, zoom, and fit.
- Local entity search, neighborhood, upstream, and downstream exploration.
- Native relationship selection, Ctrl/Cmd multiselect, context menus with explicit scope, and host tooltips.
- Paginated accessible entity/relationship lists; graph interaction is not the only way to use the visual.
- Modern formatting pane, high-contrast support, English (`en-US`) and Arabic (`ar-SA`) UI, and RTL layout.
- No external runtime assets or requests, telemetry, authentication, license checks, or `eval`. The capability privilege list is empty.

This is **relationship exploration**, not causal-impact prediction, fraud detection, whole-network centrality, or full process mining. A reachable entity is reachable within the loaded directed relationships; it is not a prediction of an outage, business impact, or suspicious behavior.

## Quick start

1. Obtain an approved `.pbiviz` package through your authorized Atlyn channel, or build this private source as described below.
2. In Power BI Desktop, use the Visualizations pane's **Import a visual from a file** action and select the package. Menu names may differ between Desktop versions. Tenant policy may prevent importing or using uncertified custom visuals.
3. Import a relationship table. The [offline samples](samples/README.md) include CSV and Power Query M sources, field mapping, and expected topology.
4. Add Atlyn Network to a report page; bind **Source ID** and **Target ID**.
5. Optionally bind Weight, Relationship type, Edge ID, and up to eight tooltip measures. Review the status text for omitted data, incomplete weights, or unavailable native identities.
6. Use **Entities** or **Relationships** for accessible exploration, and distinguish **Focus locally** from **Select loaded incident relationships**.

No prebuilt `.pbix` or `.pbip` sample is represented as tested or included. Create and save a native report in Desktop using the offline recipe. Never rename a JSON file, ZIP, or source folder to `.pbix`.

## Data contract

The visual consumes a **categorical DataView**, not a table of independently addressable raw transactions. Power BI may group categories, aggregate measures, apply report filters, and reduce data before the visual receives it.

| Field well | Kind | Required | Contract |
| --- | --- | --- | --- |
| Source ID | Grouping | One | Stable endpoint identifier |
| Target ID | Grouping | One | Stable endpoint identifier |
| Weight | Numeric measure | No; maximum one | Nonnegative finite contribution to a delivered relationship group |
| Relationship type | Grouping | No; maximum one | Distinguishes relationship kinds between the same directed endpoints |
| Edge ID | Grouping | No; maximum one | Stable relationship identifier; distinguishes same-type parallel relationships |
| Tooltips | Measures | No; maximum eight | Additional model-formatted values; not assumed additive |

### Identifiers and endpoints

- IDs must be nonempty strings or finite numbers. Strings are limited to **512 characters**. Nulls, whitespace-only strings, nonfinite numbers, booleans, dates, and objects are not valid IDs.
- Strings are **not trimmed or case-normalized**. `"A"`, `"a"`, and `" A "` are different IDs; numeric `7` and string `"7"` are different IDs. Labels may look the same for differently typed IDs.
- Keep identifier columns consistently typed in your model. Prefer **Text** for account codes, leading zeros, and other values that must not be numerically converted. The visual cannot restore distinctions that Power Query or the semantic model already removed.
- When Edge ID is bound, each delivered row must have a valid Edge ID. A blank ID is not silently replaced with an endpoint-derived ID.
- Relationship type is optional; missing/null type represents the unspecified type. Non-null type values follow the supported string/finite-number rules.
- A self-link such as `A → A` is a real relationship. Do not create one as a placeholder for an otherwise isolated entity.

### Duplicate and conflicting relationships

Without an Edge ID binding, the grouping key is the **directed source, directed target, and relationship type**, with exact identifier type/case preserved. `A → B` and `B → A` are not duplicates. Different relationship types remain separate edges.

With Edge ID bound, the key is the **exact typed Edge ID**:

- Repeated IDs with matching endpoints and type are aggregated, with a visible duplicate notice when multiple such rows are actually delivered.
- If the same ID is delivered with conflicting endpoints or relationship types, the **entire conflicting ID is omitted** and diagnosed. No arbitrary first record is kept.
- All native identities from contributing delivered rows are retained for selection; aggregation does not reduce an edge to an arbitrary identity.

Duplicate diagnostics concern **delivered rows**, not necessarily physical CSV records. Power BI can merge identical category tuples before delivery. It can also hide conflicts through filtering or data reduction; the visual cannot diagnose unseen rows.

### Weight, tooltip, and highlight semantics

- With no Weight field, relationships are **unweighted**; the visual does not fabricate a weight of one.
- With Weight bound, valid nonnegative finite delivered contributions are summed within each relationship group. Zero is valid.
- Missing, negative, nonnumeric, nonfinite, or overflowing contributions are omitted from the sum, **not from the relationship**. The visual discloses incomplete weight and uses neutral edge styling rather than presenting the partial sum as a complete comparable weight.
- The displayed known contribution is not a replacement for missing data. For example, valid `4` plus missing weight is an incomplete known contribution of `4`.
- Weight formatting follows the measure's model format and host locale. Choose suitable units and additive measures; summing a delivered ratio, average, or distinct count may not produce a meaningful aggregate.
- Power BI's measure evaluation occurs first. An aggregate measure can conceal invalid underlying facts, so perform source/model quality checks as well as reviewing visual diagnostics.
- Tooltip measures retain model formatting. A common formatted value is shown once; differing formatted values are disclosed as **Multiple delivered values (N)**, where N is the number of distinct formatted values, rather than inventing a sum.
- Host highlight values are secondary emphasis and, where applicable, a highlighted-weight value. **Topology is never rebuilt from the highlight subset.** An ordinary report filter, unlike a highlight, can change supplied topology.

## Loaded topology and limits

| Limit | v1 maximum |
| --- | ---: |
| Delivered rows processed per update | 5,000 |
| Displayed entities | 250 |
| Displayed relationships | 1,000 |
| Distinct native identities in one selection action | 200 |
| Identifier string length | 512 characters |
| Tooltip measures | 8 |

Within the processed rows, graph groups are ordered deterministically by their stable keys and complete relationships are retained subject to entity/relationship limits. Nodes are derived only from retained relationship endpoints. Reordering the same processed data does not create a random cap sample.

The algorithm does not delete links to make a graph acyclic, merge reciprocal direction, or treat loops as invalid. **Caps can still omit complete edges, including members of a cycle, reciprocal pair, or parallel group.** Do not infer the absence of a relationship from a capped graph. If more than 5,000 rows are supplied, only the bounded input prefix is processed; changes to which rows the host supplies can change the result.

The status identifies known incomplete topology: host `metadata.segment`, invalid IDs, conflicting Edge IDs, or local row/topology caps. v1 **does not call `fetchMoreData` or implement segmented loading**.

**All search results, neighborhoods, traversals, selections, and counts refer to loaded relationships only.** Even with no segment marker and no incomplete warning, the visual cannot prove that the host supplied the entire underlying model or business network. Report filters, security, grouping, and host data reduction may already have changed the data.

## Interaction and accessibility

### Local exploration versus report selection

| Action | Effect |
| --- | --- |
| Search loaded entities | Matches loaded entity labels locally; narrows the lists and emphasizes graph matches |
| Focus locally / entity selector | Sets local focus, initially to the loaded neighborhood |
| Loaded neighborhood | Focus entity and its directly connected loaded neighbors |
| Loaded upstream traversal | Entities reachable by following loaded edges toward their sources |
| Loaded downstream traversal | Entities reachable by following loaded edges toward their targets |
| All loaded topology / Reset local focus | Removes local traversal focus; reset also clears search |
| Entity activation / Select loaded incident relationships | Sends all contributing native identities for that entity's loaded incident relationships to Power BI |
| Relationship activation | Sends all contributing native identities for that loaded edge to Power BI |
| Ctrl/Cmd + activation | Requests Power BI native relationship multiselect |
| Clear report selection / Escape | Clears native report selection, independently of camera and local focus |

Traversal is cycle-safe. Local search/focus does not send a report filter or automatically change selection. Entity activation is **not an entity-level semantic-model filter**: a source/target role binding supplies relationship identities, and this visual selects those loaded relationships. It includes incident relationships even if local focus/search currently hides them.

Ctrl/Cmd requests **native relationship multiselect** by passing the complete action's identity group to Power BI with multiselect enabled. Power BI owns toggling behavior for shared identities. Selecting overlapping incident-relationship groups is therefore **not a promise of additive union or entity multiselect**; the visual does not maintain a separate entity-selection grouping layer.

The **200-identity limit is per requested action after deduplication**. If an edge or entity requires more, the whole action is refused with a visible message; no first-200 subset is selected. Missing contributing native identities likewise disable the affected complete selection rather than selecting a misleading subset.

### Context menus and tooltips

Right-click or use **Shift+F10 / the Context Menu key** on a list action. An edge with exactly one complete native identity can supply that identity to the host context menu. **Entity menus and multi-identity aggregated-edge menus are visual-level**, because the current SDK call accepts a single identity; they do not choose an arbitrary relationship to stand for the group. Context scope differs intentionally from full-identity selection scope.

Relationship tooltips use Power BI's tooltip service; the relationship list also exposes bound tooltip values. Native report-page tooltip identity propagation and context-menu behavior require Desktop/service verification. A browser host mock cannot establish these behaviors.

### Keyboard, motion, and sizing

- Use **Tab / Shift+Tab** through controls and list actions; **Enter / Space** activates buttons.
- In a list, **Up / Down** moves between its actions, and **Home / End** moves to its first/last action.
- **Previous / Next** pages expose all currently matched loaded entries; reset local focus/search to reach every loaded entity and relationship. Lists use 25 entries per page.
- On the graph, use arrow keys to pan, **+ / -** to zoom, and **Home** to fit. Drag the background to pan or use the wheel to zoom.
- The graph is an SVG overview with equivalent list actions; users do not need to locate every graphical mark.
- High contrast uses host theme colors. The UI provides Arabic RTL and English strings; model IDs and data labels are not translated.
- Layout is synchronous and static, with no animation in either normal or reduced-motion environments.
- Responsive normal/compact/tiny layouts preserve access to controls and lists through scrolling. Very small tiles cannot make a dense graph readable; enlarge the visual for inspection.

The **Appearance** formatting card controls entity color, relationship color, entity-label visibility, and label size (8–24). High contrast can override custom colors for legibility. Validate with your actual assistive technology and report layout; structural accessibility support is not a claim of completed accessibility certification.

## Development and validation

Use Node.js **24 or later** and the checked-in npm lockfile. Dependency installation and package-registry audits need network access at development time; the packaged visual itself has no external runtime dependency.

The project's Node.js requirement applies even if an individual upstream tool supports an older version. `npm run assets` runs `assets/generate.mjs`, which imports the TypeScript localization source using Node's native TypeScript support and regenerates the original icon and `en-US`/`ar-SA` resources. Regenerate these assets after changing that source and review the generated diff.

### Packaging compatibility

Windows builds require **PowerShell 7 (`pwsh`)** on PATH; Unix/CI builds require **OpenSSL**. Use `npm run build` / `npm run package`, which invoke `scripts/package.mjs`, rather than bypassing the wrapper.

Visuals tools 7.2.1 resolves a development certificate even when packaging. The wrapper isolates `HOME`/`USERPROFILE` under the ignored `.tool-home` directory and provisions local short-lived certificate material: on Windows, an in-memory .NET `CertificateRequest` is exported locally without changing the CurrentUser certificate store; on Unix, OpenSSL writes local certificate/key files. The wrapper then invokes the official `pbiviz` packager and cleans up certificate material. **`pbiviz install-cert` is not required**, and no certificate trust/store mutation is part of this build recipe. Keep private keys, PFX files, passphrases, and other certificate material out of Git, distributed packages, and release evidence; after an interrupted build, inspect local cleanup before retaining or sharing any output.

The package wrapper uses the official `pbiviz package --all-locales` option. With Power BI visuals tools 7.2.1 and formatting utilities 7, this avoids a locale-pruning loader incompatibility with the formatting utilities' ESM output. All number/date culture data stays bundled **offline**; this does not add runtime requests or translate the UI beyond `en-US` and `ar-SA`. Recheck this choice when upgrading the SDK or formatting utilities rather than removing it solely to shrink the bundle.

The dependency baseline uses Vitest 4.1.11 and scoped development overrides for `qs` 6.16.0 under `webpack-dev-server` and `uuid` 11.1.1 under `sockjs`. Retain the lockfile and re-run audits after upgrades. A previously clean audit is not a permanent security guarantee; runtime and full dependency audits cover different scopes.

```powershell
npm ci
npm run assets
npm run typecheck
npm run lint
npm test
npm run package
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.browser-cache'
npx playwright install chromium
npm run test:browser
npm run audit
npm run certification
npm run notices
```

These are **commands to run, not a record of successful execution**. Browser checks use the actual package produced by `package`, not an independent source build. The browser cache above is worktree-local and ignored; on Unix/CI, export `PLAYWRIGHT_BROWSERS_PATH` instead of using PowerShell syntax. Review actual logs and [release evidence requirements](docs/RELEASE.md); do not infer a passing gate from a generated package alone.

Without an explicit `PLAYWRIGHT_BROWSERS_PATH`, the runner uses `node_modules\.cache\ms-playwright` when present, otherwise the standard Playwright cache. `CHROMIUM_EXECUTABLE_PATH` can select an approved compatible Chromium executable. Browser provisioning may require a development-time download; the test context itself is offline.

| Script | Purpose |
| --- | --- |
| `assets` | Regenerate the original icon and SDK localization resources with Node.js 24+ |
| `typecheck` | TypeScript validation |
| `lint` | Source, test, and script lint checks |
| `test` | Automated unit/integration suite |
| `test:browser` | Browser-level rendering/interaction checks; not a native Power BI host |
| `build` | Build/package the visual |
| `package` | Audited packaging and package inspection |
| `audit` | npm runtime dependency audit (`--omit=dev`) |
| `certification` | Repository certification-readiness checks; not Microsoft certification |
| `notices` | Generate/review third-party dependency notices |

Generated evidence includes `dist\package-inspection.json`, `dist\browser-test-results.json`, `dist\certification-preflight.json`, and `dist\runtime-dependencies.json`. Match their artifact hashes to the final package rather than reusing reports from an earlier build. Keep the fresh webpack statistics produced by packaging until runtime dependency notices have been generated and reviewed.

The stable visual GUID is `AtlynNetworkAB24C68297094C32AF64D50D92C01711`; the native visual version is `1.0.0.0` (npm package version `1.0.0`). Keep the GUID stable for upgrades. Expected package name:

```text
dist\AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.0.0.0.pbiviz
```

Do not treat development dependency audit output, runtime audit output, static bundle scans, and Microsoft's certification review as interchangeable.

## Native-host and distribution limitations

Desktop and service behavior, real selection propagation to other visuals, report-page tooltips, tenant policy, and PDF/PowerPoint full-viewport rendering remain manual release gates. Verify ordinary, tiny, large, high-contrast, RTL, keyboard-only, and reduced-motion scenarios in actual hosts. Export services can restrict uncertified visuals; do not promise PDF/PPT support based on browser screenshots.

No public release, AppSource submission, screenshots, or published report is implied by this repository. It is approved for a **private AtlynCo repository only**. Any organizational deployment must be separately authorized and conform to tenant custom-visual policy.

## Ownership and support

Copyright © 2026 Atlyn. Proprietary; see [LICENSE](LICENSE). Third-party dependencies retain their own licenses and notice obligations.

Runtime third-party notices are bundled as offline text inside the visual, available by expanding **Atlyn Network → Third-party licenses**, as well as in `THIRD_PARTY_NOTICES.txt`. Run `npm run notices` after a dependency change, review the generated literal source, and rebuild; recipients of only the PBIVIZ must not depend on an omitted bundler license sidecar.

For dependency upgrades, use `npm run build` to obtain fresh bundle statistics, then `npm run notices`, then `npm run package`. The final inspection refuses a package whose embedded notices differ from the generated source. The checked-in notices permit a fresh checkout to run `npm run package` directly.

The existing publisher metadata identifies **Atlyn**, author/support email `atlyn.help@gmail.com`, and support URL `https://www.atlynco.com/docs/faq`; the coordinator has confirmed this metadata and verified the support page content. Repository and issue/PR URLs under `https://github.com/AtlynCo/powerbi-network-graph` are **private and require access**.

Verify support responsiveness and suitability for the intended audience as a manual gate before any publication or external distribution. Confirmed metadata and available support content do **not** constitute publication approval. Do not send report/customer data or credentials in a support request.
