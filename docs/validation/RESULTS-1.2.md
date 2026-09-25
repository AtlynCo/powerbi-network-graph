# Atlyn Network 1.2 local candidate evidence

**Recorded 2026-09-24. Local readiness checks passed; NOT Microsoft certified,
AppSource approved, or ready for submission without the owner gates below.**
This is a new record. The sealed `RESULTS.md`, historical marketplace images/
provenance and `1.1.1.0` archive remain unchanged.
**Same-day refresh:** the named certification ESLint command and the
Microsoft-linked workbook sheet tests were added after the initial 1.2
handoff. The prior cf6d package/report/receipts/images are preserved under
`dist/candidate-history/f5d0cf21a94e579336af985ad7516f049cf94309/`
and in the earlier committed source where applicable.
**Subsequent prepublication work, 2026-09-25:** see
[PREPUBLISH-1.2](PREPUBLISH-1.2.md) for bounded genuine Desktop observations,
owner approvals and the Hints-last sample correction. The archive remains
unchanged. This earlier 168-case/38-group record is not a claim that PBIX or
all native acceptance gates are complete; its replaced model-preflight
receipt is preserved at the history path listed below.

## Exact candidate

| Item | Value |
| --- | --- |
| Visual | Atlyn Network |
| GUID | `AtlynNetworkAB24C68297094C32AF64D50D92C01711` (unchanged) |
| Version | PBIVIZ `1.2.0.0`; npm `1.2.0` |
| Package | `samples/release/package/AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.2.0.0.pbiviz` (same bytes in `dist`) |
| Bytes | **153,889** |
| SHA-256 | **`6136c82c28ecf597634cbb90685f9cb1fbc3c435ce64613a8be180e8ff0f00ff`** |
| API / SDK / tools | Manifest **5.11.0**, installed SDK **5.11.1**, tools **7.2.1** |
| Source base | Implementation `f2b30c9e09e899e0cc16929af2167f3091921560`, handoff `f5d0cf21a94e579336af985ad7516f049cf94309`; current build-input hashes in `dist/build-inputs.json`, final source commit in the local release manifest |
| Local runtime | Node **24.17.0**, npm **11.13.0**, pinned Chromium **145.0.7632.6** |

The SDK's `index.js` deliberately exports `major.minor.0`; therefore API
5.11.0 is correct for package 5.11.1. Registry checks on this date returned SDK
5.11.1 and tools 7.2.1. No new runtime dependency, data role, privilege, network
call or licensing mechanism was introduced.

The retained historical 1.1.1.0 archive still has SHA-256
`ff42b66ea48bc525cfca2e7164361920d5dd211582a1db0a319c9be91b164b86`.
It is not embedded in the new sample.

## Implemented and exercised

Force remains the absent-property default, with four pre-change fingerprints
pinning complete positions/routes/bounds/signature at empty, singleton,
typical and maximum graph sizes. Circular places every retained endpoint on
one typed-ID-ordered circle. Radial uses minimum undirected loaded hops,
distinct non-self degree for automatic center selection, stable ties, and
separately packed weak components with their own real centers.

All directed/parallel/reciprocal/cyclic/self relationships and contributing row
identities are retained. Independent Floyd-Warshall oracles check every center
on three seeded graphs. A new shortcut recomputes levels, so no retained edge
can span more than one radial level. Polar paths use annular corridors, with
>=72-unit node separation, >=96-unit radial gaps and sampled unrelated-center
clearance >27.5 units (including expanded/search/selected glyph and hit-path
envelopes). Dense paths can still overlap other paths or labels; all edges
remain available in the complete accessible list. No chord ribbons, edge
bundling, directed hierarchy or centrality scoring is claimed.

Author and local layout selectors, radial center selector/list action,
missing-center retention/reappearance, outward horizontal labels and v2 saved
state are wired. Layout changes do not select, filter or persist host state.
Only explicit Save local view requests storage. V1 states migrate to Force;
camera compatibility is checked after layout/root resolution; incompatible
cameras refit visibly. Encode and decode both enforce 4,096 characters without
truncation. Capability schema validation confirms `filterState: true` and
`suppressFormatPainterCopy: true` on the hidden snapshot property.

## Microsoft-linked dataset path exercised locally

`test/fixtures/microsoft-sankey.json` attributes the exact nine records from
**Sankey Chart**, columns **Origin City / Destination City / Passenger Volume**,
in [the Microsoft certification page's linked workbook](https://github.com/PowerBi-Projects/PowerBI-visuals/blob/21c5f65b4ee4f9d0a755175b0884c20be949bcb4/assets/excel/workbook/test-visuals-data.xlsx).
Public revision `21c5f65b4ee4f9d0a755175b0884c20be949bcb4`,
Git blob `d37eb67af678c8cf5f006e9cd5ed5784052c82f1`; workbook **236,914 bytes**,
SHA-256 **`c17157c21cb99e1946dedca29e47a8f877fd0aaeadb57d2ba6ee8bcaec2b70e1`**.
The coordinator verified workbook bytes and rows; this session verified the
public revision/blob/size. The full workbook is **not vendored**.

Five independent source cases and one actual-package browser group exercise
the exact records in all three layouts: **eight nodes, nine directed pairs,
total weight 6,975**, preserved row identities (Seattle selects rows 0/3/6),
and Chicago's independently specified undirected radial levels. Browser
fixture SHA-256 is
`d96b832324e5b8e09e11f06703120ceb5d909194c54fd6f17151ed616c6bc96f`.
This closes only the **Sankey Chart relationship path in offline source and
mock-host tests**. It is not native Excel/Power Query ingestion, full workbook
coverage, Microsoft's own test execution or certification.

## Actual local command outcomes

| Command / evidence | Observed result |
| --- | --- |
| `npm run assets` | Regenerated English/Arabic resources; original icon and 300px logo preserved |
| `npm test` and final JSON-report run | **168/168 tests**, 11 files, zero failures |
| `npm run typecheck` | Passed |
| `npm run eslint`, `npm run lint` | Both passed. The named script is exactly `npx eslint . --ext .js,.jsx,.ts,.tsx`; existing focused lint is retained. Only the generated browser cache was added to existing generated-output exclusions. |
| `npm run build`, `npm run package` | Official SDK wrapper passed; certification audit found no external requests; ZIP/source/capability/locale/notice inspection passed |
| `node scripts/rebuild-check.mjs` | All decompressed members identical across two unchanged-source SDK builds; final archive identified above |
| `npm run notices` | Three shipped dependency packages plus vendored Globalize; complete terms match compiled text |
| `npm run test:browser` | **17/17** actual-package groups; zero runtime requests/errors |
| `npm run test:release -- --screenshots` | **38/38** groups including Circular/Radial and Microsoft-linked Sankey rows; zero runtime requests/errors; five final-SHA images |
| `npm run benchmark` | Protocol 3: **24/24 groups**, 30 measured + five warmups each, **720 measured samples**, all p95 budgets passed |
| `node scripts/release-profile.mjs` | Actual-package DevTools profile: 3,256 samples, 324 call-frame nodes; zero runtime requests/errors |
| `node scripts/sample-package.mjs --author`; `npm run sample`; `node scripts/sample-package.mjs --validate` | **30 schema files, four bound graphs, 50 bindings**; five pages, eight tables, fourteen measures, six relationships; exact archive/resource equality |
| `pwsh -NoProfile -NonInteractive -File scripts/validate-tmdl.ps1` | Official Microsoft TOM deserialized eight tables, fourteen unique measures and six relationships; PBIR version/structure checked |
| `npm audit --json`, `npm run audit` | **Zero vulnerabilities**, full dependency and runtime scopes; coordinator also reported `npm audit --audit-level=moderate` exit 0 |
| `npm run certification` | Passed actual compiled/source AST, empty privileges, bundled assets/licenses and recommended ESLint preflight |

**These are offline browser/mock-host and local package/model checks, not
Power BI Desktop/Service, screen-reader, DAX/M execution or native export
results.** The ordinary 17-check browser report is not substituted for the
separate 38-check release report.

The first browser attempt had zero checks because Chromium was absent.
The official pinned download passed CRC for all 308 archive entries; its
stalled Playwright extraction was stopped and completed with .NET inside the
same worktree cache, then the responsive browser version was verified.
No other process was stopped. Missing lockfile dependencies were restored only
after the initial missing-vitest failure. Official TOM was restored to the
ignored worktree cache; Windows-client TLS download attempts failed, while
verified Node HTTPS through the official NuGet endpoint succeeded.

An initial polar camera test used exact transform-string equality and differed
by approximately 0.00000000000003 units. The new oracle compares numeric
coordinates within 0.000000001; production camera state was not rounded.
The full release suite was rerun successfully afterwards.
During the dataset follow-up, the first browser load exposed a misplaced
nested export in its new harness helper. The helper was moved to module scope,
Node syntax checks and both lint commands passed, and both complete browser
suites were rerun; production runtime inputs were not changed by that repair.
Existing Vite/module-type/missing-sourcemap and SDK deprecation warnings remain
visible. Packaging certificate/key/passphrase cleanup was explicitly verified.

## Reproducibility boundary

Official SDK ZIP entries contain wall-clock timestamps. Rebuilding after the
package-script change preserved **every decompressed member byte** compared
with the prior **cf6d...** archive; the separate
`eslint-candidate-comparison.json` records that comparison. The final two
unchanged-input SDK builds also had identical members, but archive SHA changed
from `9550b54954bce9402dd5601acf1ab7fc41d598d28f628b7d012735e27e3f73b6`
to the **6136...** archive above. ZIP byte-for-byte reproducibility is **not**
claimed. No SDK archive was normalized or rewritten. The internal candidate
version is unchanged because shipped member content is unchanged and no
submission has occurred. Inspection, notices,
sample assembly, both browser suites, screenshots, benchmark, profile and
certification reports were refreshed against the final archive.

## Benchmark observations

Windows 10.0.26200 x64, AMD EPYC 7763, 16 logical processors, 68,665,831,424
bytes RAM. Serial worktree benchmark with five warmups and 30 retained values
per group, nearest-rank percentiles, no outlier removal. Aggregate machine CPU
busy was **35.28%**; other users/processes were not controlled.

Maximum fixture: 250 entities / 1,000 relationships / 5,000 contributing rows.
End-to-end browser/mock-host **p95 milliseconds**:

| Operation | Force | Circular | Radial | Budget |
| --- | ---: | ---: | ---: | ---: |
| Topology-cold render | 299.8 | 120.8 | 149.3 | 1,500 |
| Data update | 117.5 | 124.5 | 153.4 | 1,000 |
| Local neighborhood | 38.2 | 34.9 | 34.7 | 350 |
| Relationship selection (mock) | 67.3 | 68.1 | 67.8 | 750 |

All typical-fixture groups also passed their predeclared budgets. These are
local observations, not causal performance attribution, competitor results
or native host latency guarantees. Raw values and machine context remain in
`dist/release-benchmark-final.json`.

## Candidate images and exact receipt hashes

All five PNGs are **1366x768**, below **1,024,000 bytes**, with explanatory
callouts and explicit **offline Chromium / mock Power BI host** labels.
They live in `dist/release-screenshots`, not the frozen marketplace media.
They are generated candidates, not approved listing or native-host images.

| Image | Bytes | SHA-256 |
| --- | ---: | --- |
| `services.png` | 66,560 | `cce457556268f2190e796b501fc610c4bada31f2e78db3aef6926376be54d279` |
| `accounts.png` | 93,817 | `c2ab4cc91c5b0d3ac86c23b660f1db55472d4d25a65603b5b9fd8d337f0ee72d` |
| `circular.png` | 104,904 | `7da0dc23e3d7193d81fcd0b6053f4d0350f0d002bf5e6cb51937e63c9b499307` |
| `radial.png` | 68,818 | `8f5efec75caa4c65b47f7a548f6e87c87f4ab6dc080fc47874f6f536198feb69` |
| `dense-overview.png` | 393,387 | `fd82cb554d1baf552f3b1886242997d50d53362085ba2d975ce34757e955930e` |

Receipt files are under `dist`; the immutable local release manifest inventories
these and the committed source. It is not a GitHub Release or external action.

| Receipt | SHA-256 |
| --- | --- |
| `unit-tests-1.2.json` | `75d289a687b709a3530d4dc062001b3289789e07893d56d99365ad37701afd10` |
| `package-inspection.json` | `4f196a26f8ec8734a83ea0a90901254ce63bce5121fe843af3b9a0cf9c71fd00` |
| `build-inputs.json` | `4981e48889d14b964c3f471f35afdb1d9921f52caad285014ea6fcab98910e21` |
| `rebuild-verification.json` | `2cf990eaf338f69e2f2a89614677077756a8a99ff18451423b75d4a12586aa1c` |
| `eslint-candidate-comparison.json` | `4f26531659dd994fd7e42cedc4386ac65257f96dafe28451a60131c69ed6b17b` |
| `browser-test-results.json` | `406c4cc2f56df75420ff59d2fb6ab4fb6b1d635a501f3443b8e6a8ad34a491bb` |
| `release-browser-results.json` | `aff98d3bf65794fc9516388330d39dc3f11522e2e56dbc902145c366c96967d5` |
| `release-benchmark-final.json` | `9922ce909ba0dcd35bbfec89fcbf71e8784a414b745370df633a0db9c744fd56` |
| `release-profile.json` | `aa1b229e8227f39e091a693d135f3532636635925b44b7d01b0a4126c20ff115` |
| `certification-preflight.json` | `a15e49aa07c016c12bc03ece804a0a2304717b4a40414df368bcf1712ad16e98` |
| `dependency-audit.json` | `109407fdcf47ea5896ff1d9ffb2127eae64a75902d2a0166062edbac9f28fd19` |
| `candidate-history/1d0a664259ce7bee2e11fec9534c8b8aed829567/tmdl-validation.json` | `1ebc1181b116d5ae2a669a7dc5217252fd19798e335f35679fa6c6edfdb37948` |

## Unsatisfied owner / external gates

- **Current PBIX:** genuinely open/refresh all five pages in Desktop, exercise
  all layouts/centers and interactions, save/cold-reopen, and verify embedded
  1.2.0.0 member bytes against this PBIVIZ. No current PBIX is supplied.
  The coordinator reports Desktop 2.157.1354.0 installed; this work did not
  operate the shared UI. Historical 1.1.0.0 PBIX evidence is not acceptance here.
- **Native behavior:** Desktop/Service selection and identity propagation,
  bookmarks (including same-bookmark replay), format painter, field binding,
  context menus, tooltips, reading/edit modes, multiple instances/pages,
  accessibility/assistive technology and actual PDF/PPT exports.
- **Legal/support/media:** an owner-approved HTTPS privacy URL and customer
  EULA/Partner Center contract choice remain unverified. The repository
  `LICENSE` is a proprietary rights notice, not an approved customer EULA.
  Existing 300x300 logo is a candidate asset. The manifest's HTTPS support FAQ
  was reachable on this date; reachability is not a support SLA. Owner must
  approve current listing text, callouts, logo and screenshots.
- **External review:** authorized reviewer source access, publisher/portal
  prerequisites, exact submitted-source/package alignment, final owner gate,
  Partner Center submission and Microsoft's separate certification review.
  No certification ref, merge, publication, permissions or account credentials
  were changed. No Microsoft certification/publication is claimed.
