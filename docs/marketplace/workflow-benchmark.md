# Relationship-investigation workflow benchmark

**Research date: 2026-09-09. Documentation comparison, not vendor UI testing or a performance benchmark.**

The sources below were fetched directly from official vendor pages. Their documented features are credited as **vendor-documented**, not independently measured. Absence from a page means **not established by the reviewed source**, not that a competitor cannot do it. We did not run vendor visuals, upload data, measure their performance, reverse-engineer their packages, or use their artwork.

## Verified sources

### ZoomCharts Drill Down Graph PRO

- [Product page][z-product] identifies Graph PRO and links to its feature documentation. Several guessed/old graph URLs redirect to the general home page; those redirects were **not used as capability evidence**.
- [Multiple layouts][z-layout] documents Dynamic (force-directed), Hierarchy and Radial layouts.
- [Focus nodes][z-focus] documents source/target focus-node fields, all-nodes versus focus-node initial display, initial expansion level, expansion radius, expansion direction and expand/highlight behavior.
- [Cross-chart filtering][z-filter] documents node selections filtering other visuals and other visuals filtering Graph PRO, controlled by Use as Filter. It notes that the Pin variant differs; this comparison does not conflate variants.
- [Bookmark support][z-bookmark] documents Power BI snapshots of current view and filters.

The simplified web extractor omitted body text for some ZoomCharts feature pages. Their actual returned HTML was read locally and the relevant visible documentation text verified; no browser UI was driven. The obsolete `focus-nodes-dynamic-expand-collapse` link redirected and was replaced by the current **Focus nodes** page.

### Powerviz Network Graph

- [Official product page][p-product] documents clustering, node relationships, fill patterns, 30+ palettes, conditional formatting, shapes, links and directional arrows.
- [Official Network Graph introduction][p-doc] adds configurable inside/outside labels; built-in shapes, images, icons and uploaded node shapes; one-click relationship highlighting; top/bottom-N ranking; theme import/export; lasso/reverse-lasso; toolbars and grid view.

These are documented product capabilities, not claims that all are free, certified, offline, or suitable for this report's semantics. Pricing/license entitlements were not tested.

## Capability comparison

Atlyn's column describes this repository's **1.2 candidate** (updated 2026-09-24), with local tests/package checks where available. The vendor documentation research remains dated 2026-09-09. Native behavior remains subject to the submission matrix.

| Investigation need | ZoomCharts Graph PRO: documented | Powerviz Network Graph: documented | Atlyn 1.2 candidate: implementation and gap |
| --- | --- | --- | --- |
| Reduce an overwhelming overview | Focus-node fields; configurable expansion levels/radius/direction and explore mode | Clustering, relationship highlighting and top/bottom-N ranking | Local search, neighborhood, incident view, upstream/downstream and one shortest loaded path. **Missing** model-defined focus-node role, configurable multilevel expand/collapse and cluster aggregation |
| Choose a layout for the question | Dynamic, Hierarchy, Radial | This source does not establish equivalent layout choices | Force (preserved default), Circular (one stable-ID ring), Radial (minimum undirected loaded hops, separate component centers). Author and local selectors; missing requested centers visibly fall back and are retained. **Missing** directed hierarchy, chord/bundled-edge modes and manual node pinning |
| Read dense relationships | Configurable links/nodes are linked from product page; not fully benchmarked here | Line customization, directional arrows, inside/outside labels | Curved parallel/reciprocal links, separate self-loop petals, zoom/fit, collision-aware labels, accessible lists. **No claim** that this outperforms vendor layouts |
| Filter the rest of a report | Documented bidirectional cross-chart filtering | One-click relationship highlighting; exact host-filter semantics not established by reviewed page | Native **relationship** identities; an entity action selects loaded incident relationships. This is not a true entity-dimension selection layer; native behavior needs verification |
| Save an investigation | Power BI bookmark support | Theme import/export, which is not the same as investigation-state replay | Explicit saved local view includes focus/search/path/view/camera; metadata can be replayed. **Native bookmark replay unverified**, no bookmark created automatically |
| Communicate category/priority | Not established by the focused sources | 30+ palettes, level colors, conditional formatting, shapes/images/icons, fill patterns | Basic node/edge colors and labels; host high contrast. **Missing** rule-based node styling, rich shapes/icons, clustering colors and a theme exchange interface |
| Select groups spatially | Not established by the focused sources | Lasso and reverse lasso | Edge/entity activation and native Ctrl/Cmd relationship multiselect. **Missing** lasso; overlapping incident groups are not promised to behave as additive entity multiselect |
| Inspect without relying on graph marks | Not established by the focused sources | Grid view | Keyboard-accessible paginated entity/relationship lists and incident inspection; native assistive-technology testing remains open |
| Diagnose identity/data problems | Not established by the focused sources | Not established by the focused sources | Explicit delivered-row duplicate/conflict, weight and topology-limit semantics. This is useful transparency, **not proof competitors lack safeguards** |
| Offline/certification/performance | Not inferred from these feature pages | Not inferred from these feature pages | Empty privileges and bundled resources support an offline design. **Not certified**; native/export/service compatibility and comparative speed are unproven |

The practical target is a clear, bounded investigation workflow, not an invented “best-in-class” claim. Vendor expansion, clustering, visual styling and established bookmark workflows remain meaningful product gaps; accessible local lists and explicit loaded-data caveats do not eliminate them.

## Reproducible workflow rubric

Use the same synthetic facts and questions for future authorized manual evaluation. Do not rank competitors until they are actually tested under declared versions, licenses, machines, host modes and data mappings.

| Task | Evidence to record | Atlyn authored sample starting point |
| --- | --- | --- |
| Find the entity | Can the reader find Orders or `0001` without scanning every label? Preserve identifier types | Search on pages 1 and 2; account IDs are literal text |
| Explain direct relationships | Identify incoming/outgoing directions, type, weights and a self-loop without confusing reciprocal edges | Orders, Gateway; 0001/0002 parallel transfers and fee |
| Follow a cycle/path | Distinguish reachability from causality; show a reproducible path or state none in **loaded** data | Orders → Payments → Ledger → Orders; local path workflow |
| Narrow clutter honestly | Measure actions/time to isolate incident relationships; note whether underlying data was filtered, hidden or aggregated | Local incident/neighborhood versus genuine type slicer |
| Connect graph to evidence | Select a relationship and verify detail-table rows/measures and tooltip context | Bound tableEx, type dimension slicer and graph interactions |
| Handle data quality | Explain duplicate T01 aggregation, omitted conflicting IDs and incomplete weight without inventing totals | Accounts table retains raw facts; graph diagnoses supplied conflicts |
| Recover context | Clear host selection separately from local focus; save/reopen chosen view | Explicit reset/selection controls and saved local-view feature |
| Operate accessibly | Keyboard/touch, high contrast, focus and list access; check native AT, not only DOM labels | Equivalent graph/list interactions; lists paginate all loaded entries |
| Explain limits | No hidden assertion of whole-network completeness or absence of a real-world path | Visible cap/loaded-topology semantics; bounded 5,000/250/1,000 contract |

Recommended future results are task success, action count, elapsed time, reading errors, accessibility blockers and false conclusions—not a single aesthetic score. Keep vendor results blank until measured. Mock-host Atlyn screenshots cannot support native or comparative usability claims.

[z-product]: https://zoomcharts.com/en/microsoft-power-bi-custom-visuals/custom-visuals/drill-down-graph-visual/
[z-layout]: https://zoomcharts.com/en/microsoft-power-bi-custom-visuals/documentation/drill-down-graph-visual/features/multiple-layouts/
[z-focus]: https://zoomcharts.com/en/microsoft-power-bi-custom-visuals/documentation/drill-down-graph-visual/features/focus-nodes/
[z-filter]: https://zoomcharts.com/en/microsoft-power-bi-custom-visuals/documentation/drill-down-graph-visual/features/cross-chart-filtering/
[z-bookmark]: https://zoomcharts.com/en/microsoft-power-bi-custom-visuals/documentation/drill-down-graph-visual/features/bookmark-support/
[p-product]: https://powerviz.ai/network-graph
[p-doc]: https://docs.powerviz.ai/powerviz/network-graph/introduction
