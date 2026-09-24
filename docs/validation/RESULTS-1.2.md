# Atlyn Network 1.2 local candidate evidence

**Recorded 2026-09-24. Local readiness checks passed; NOT Microsoft certified,
AppSource approved, or ready for submission without the owner gates below.**
This is a new record. The sealed `RESULTS.md`, historical marketplace images/
provenance and `1.1.1.0` archive remain unchanged.

## Exact candidate

| Item | Value |
| --- | --- |
| Visual | Atlyn Network |
| GUID | `AtlynNetworkAB24C68297094C32AF64D50D92C01711` (unchanged) |
| Version | PBIVIZ `1.2.0.0`; npm `1.2.0` |
| Package | `samples/release/package/AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.2.0.0.pbiviz` (same bytes in `dist`) |
| Bytes | **153,889** |
| SHA-256 | **`cf6d0ed1dad87d8cbd0d27b47f6190fce014bea70a96a79170f7725f8cbc280f`** |
| API / SDK / tools | Manifest **5.11.0**, installed SDK **5.11.1**, tools **7.2.1** |
| Source base | `c19276b2d53bc02853737377136973d6fc937242`; exact current build-input hashes in `dist/build-inputs.json` |
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

## Actual local command outcomes

| Command / evidence | Observed result |
| --- | --- |
| `npm run assets` | Regenerated English/Arabic resources; original icon and 300px logo preserved |
| `npm test` and final JSON-report run | **162/162 tests**, 10 files, zero failures |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, including new scripts |
| `npm run build`, `npm run package` | Official SDK wrapper passed; certification audit found no external requests; ZIP/source/capability/locale/notice inspection passed |
| `node scripts/rebuild-check.mjs` | All decompressed members identical across two unchanged-source SDK builds; final archive identified above |
| `npm run notices` | Three shipped dependency packages plus vendored Globalize; complete terms match compiled text |
| `npm run test:browser` | **17/17** actual-package groups; zero runtime requests/errors |
| `npm run test:release -- --screenshots` | **37/37** groups including Circular/Radial; zero runtime requests/errors; five final-SHA images |
| `npm run benchmark` | Protocol 3: **24/24 groups**, 30 measured + five warmups each, **720 measured samples**, all p95 budgets passed |
| `node scripts/release-profile.mjs` | Actual-package DevTools profile: 2,799 samples, 316 call-frame nodes; zero runtime requests/errors |
| `node scripts/sample-package.mjs --author`; `npm run sample`; `node scripts/sample-package.mjs --validate` | **30 schema files, four bound graphs, 50 bindings**; five pages, eight tables, fourteen measures, six relationships; exact archive/resource equality |
| `pwsh -NoProfile -NonInteractive -File scripts/validate-tmdl.ps1` | Official Microsoft TOM deserialized eight tables, fourteen unique measures and six relationships; PBIR version/structure checked |
| `npm audit --json`, `npm run audit` | **Zero vulnerabilities**, full dependency and runtime scopes; coordinator also reported `npm audit --audit-level=moderate` exit 0 |
| `npm run certification` | Passed actual compiled/source AST, empty privileges, bundled assets/licenses and recommended ESLint preflight |

**These are offline browser/mock-host and local package/model checks, not
Power BI Desktop/Service, screen-reader, DAX/M execution or native export
results.** The ordinary 17-check browser report is not substituted for the
separate 37-check release report.

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
Existing Vite/module-type/missing-sourcemap and SDK deprecation warnings remain
visible. Packaging certificate/key/passphrase cleanup was explicitly verified.

## Reproducibility boundary

Official SDK ZIP entries contain wall-clock timestamps. The final rebuild
preserved **every decompressed member byte**, but archive SHA changed from
`55da1d4c5024644a2d70da6f9e6444107d3897462340a7bd1cb7d98ece08e6e2`
to the **cf6d...** archive above. ZIP byte-for-byte reproducibility is **not**
claimed. No SDK archive was normalized or rewritten. Inspection, notices,
sample assembly, both browser suites, screenshots, benchmark, profile and
certification reports were refreshed against the final archive.

## Benchmark observations

Windows 10.0.26200 x64, AMD EPYC 7763, 16 logical processors, 68,665,831,424
bytes RAM. Serial worktree benchmark with five warmups and 30 retained values
per group, nearest-rank percentiles, no outlier removal. Aggregate machine CPU
busy was **28.42%**; other users/processes were not controlled.

Maximum fixture: 250 entities / 1,000 relationships / 5,000 contributing rows.
End-to-end browser/mock-host **p95 milliseconds**:

| Operation | Force | Circular | Radial | Budget |
| --- | ---: | ---: | ---: | ---: |
| Topology-cold render | 266.0 | 133.5 | 120.7 | 1,500 |
| Data update | 103.3 | 109.9 | 116.5 | 1,000 |
| Local neighborhood | 37.1 | 34.6 | 34.5 | 350 |
| Relationship selection (mock) | 68.1 | 68.1 | 68.3 | 750 |

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
| `services.png` | 66,524 | `7762aa97cfb59d9bf0e92765ec9ccf6e94733e803aa61beb730f60faddf17fb9` |
| `accounts.png` | 93,740 | `9b4c9cba34190d2472600b36cb311f3491da4bd459d853d73b00ec0a91f3ee86` |
| `circular.png` | 104,766 | `790990f4cf97bb1dc3a3128db880ce3e340fcfc1f2f6fadcb0963b729cdc5267` |
| `radial.png` | 68,639 | `77875836e9bc7739df07184677d2026ee9b2d124bbba6e745fa95a09f055633c` |
| `dense-overview.png` | 393,268 | `71816f38849f0b800bd0d375673d3b88e8980c8bb2faf7c7d18a88121e162af5` |

Receipt files are under `dist`; the immutable local release manifest inventories
these and the committed source. It is not a GitHub Release or external action.

| Receipt | SHA-256 |
| --- | --- |
| `unit-tests-1.2.json` | `2746618a4a48589b1807145f946b59bde05d5a2e7f4ab62fcaa23d6586dcd90f` |
| `package-inspection.json` | `9db97545c9b5291ae96e7e2fb26ad3df08a5a84ba835cbb4fd010078cc03a45d` |
| `build-inputs.json` | `554230fa236e30288a76a4ffda62ca58927a3259527d165b93bc7e12c5454cb2` |
| `rebuild-verification.json` | `cdcb2bf4ead09330a041d62b2c6cccdff30b46ea2579a9ffbbf72208bc83ee5f` |
| `browser-test-results.json` | `c098bdebac69a93801d505b861abfc99a99f34fe6cae9251cad6d9b2c2a2a95d` |
| `release-browser-results.json` | `b5e2f5713130719e64421d2ac9ed8065267f52da02e62d5afb7769a985c9fb00` |
| `release-benchmark-final.json` | `dc145ec74644f5cc98526840cdf6362b2970c2829e36518d8e4512237c487872` |
| `release-profile.json` | `22fd82efd062d3d6b3112c75cc85b2910f569547c75bb15aabdf1e655333faa4` |
| `certification-preflight.json` | `8b2e00105eb140d19ea803824f36f09fb945220b3d22e66d7a7b0854225402bc` |
| `dependency-audit.json` | `109407fdcf47ea5896ff1d9ffb2127eae64a75902d2a0166062edbac9f28fd19` |
| `tmdl-validation.json` | `5a17f8f79135d6baa44a1832a91ab7d0f007982555a3cdcb2b801b06b8375057` |

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
