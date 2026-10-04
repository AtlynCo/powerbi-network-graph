# Canonical PBIVIZ packaging follow-up

**Recorded: 2026-10-03.** This is a source/build-path follow-up on the existing
draft implementation branch/PR #6, not Microsoft certification or permission
to release. It does not modify the frozen PBIVIZ/PBIX evidence, sample package,
GUID, visual version, `pbiviz.json` API declaration, or SDK versions.

## Canonical production archive

The selected normal production build in `dist/` is:

| Field | Value |
| --- | --- |
| PBIVIZ | `AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.2.0.0.pbiviz` |
| Size | 146,423 bytes |
| SHA-256 | `98bd9ff690ec67d4d7847bcddde6b254439dfef080a684e1d1887aa258323669` |
| ZIP metadata | Ordinal entry order; DOS platform; UTC `1980-01-01T00:00:00Z`; stable DOS file/directory attributes; DEFLATE level 9 |
| Toolchain | Node 24.17.0, npm 11.13.0, `powerbi-visuals-tools` 7.2.1, `powerbi-visuals-api` 5.11.1; API declaration remains 5.11.0 |

Builds under `TZ=Etc/GMT+12` and `TZ=Etc/GMT-14` both produced exactly
146,423 bytes and the same SHA-256 above. The rebuild check also passed exact
archive-byte equality, decompressed member equality between unchanged-source
production builds, canonical metadata validation, and ZIP CRC validation.
The canonicalizer changes only the ZIP envelope and verifies that every
decompressed SDK-produced member remains byte-identical through that rewrite.

`npm run package` completed inspection. Its transient SDK
`--certification-audit` package did not match the normal production members;
the wrapper restored and verified the selected production PBIVIZ, package
metadata, and normal webpack statistics. It does not leave the audit output
selected as production.

## Frozen-reference comparison and evidence boundary

The frozen PBIVIZ in `samples/release/package/` remains unchanged at 153,889
bytes, SHA-256
`6136c82c28ecf597634cbb90685f9cb1fbc3c435ce64613a8be180e8ff0f00ff`.
Both archives passed ZIP CRC checks. Their raw members are **not identical**:

| Member | Frozen | New canonical build | Result |
| --- | --- | --- | --- |
| `package.json` | 760 bytes, SHA-256 `3fcaa2b8d15a955003469e32f63d84368a352fd9116c3cc5ef04a0ec763aa136` | 760 bytes, same SHA-256 | Equal |
| `resources/AtlynNetworkAB24C68297094C32AF64D50D92C01711.pbiviz.json` | 881,889 bytes, SHA-256 `84276fa508720313cdb100d44ddc34ba0cf2b437627eea47ae3946d03cf57bc9` | 793,158 bytes, SHA-256 `eddc1b0ca330ee8bd4a9932949e3372df32e396b47c1f295e9b4d1edd0a7661d` | Different |

The only differing resource JSON property is `content.js`: the frozen
JavaScript is 784,286 bytes (SHA-256
`9ad40681ce955c0655427dfe00c9b22c17cffeca68ac2621f0465426f72b0617`); the
new build is 695,555 bytes (SHA-256
`cfffff43896ba2b935efa3d910017a1c7bfee122345ccd9cea9bbae9a768d12d`). This
is a **runtime payload difference**, not merely an outer ZIP SHA change. The
previous native acceptance therefore does not validate this new payload and
must be treated as stale. The original frozen evidence has not been
overwritten; no new PBIX was produced.

The documented native PBIX reference is 213,864 bytes, SHA-256
`9248f79d195ec76fe61f278911a79cbb333f50a12bec17a3ab8130419e325ab7`, but the
PBIX file is not present in this worktree. No new PBIX-member parity or native
Desktop claim is made.

## Checks and remaining blocker

Passed on the selected canonical build: `npm run typecheck`, `npm run lint`,
all 170 unit tests, `npm run package`, `node scripts/inspect-package.mjs`,
`npm run certification`, `node scripts/rebuild-check.mjs`, and the 17-group
actual-package plus 38-group release-browser suites using the existing Edge
binary. Browser coverage uses a mocked Power BI host; it is not native-host
acceptance.

The current full `npm audit --json` remains **blocked**: 0 moderate, 6 high,
0 critical. The six high findings are the `braces` stack-exhaustion advisory
`GHSA-vfj7-8cjw-p6xm` propagated through `chokidar`, `micromatch`,
`http-proxy-middleware`, `webpack-dev-server`, and `powerbi-visuals-tools`.
The only reported npm fix is `powerbi-visuals-tools@1.7.2`, a semver-major
downgrade; no downgrade, override, suppression, or audit-policy bypass was
applied.

## Certification-readiness follow-up: unminified candidate

Microsoft's [current certification requirements](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified)
explicitly disallow minified JavaScript. The preceding `98bd9ff6...` normal
package had a minified bundle, so it was not a certification candidate. The
wrapper now passes the supported Tools `--no-minify` option to both the normal
and transient certification-audit package commands. This selects an explicit
readable production build; it does not select or leave the separate audit
output in `dist`.

The resulting unminified candidate is:

| Field | Value |
| --- | --- |
| Path | `dist/AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.2.0.0.pbiviz` |
| Size | 239,595 bytes |
| SHA-256 | `25b966ecd54dbcfe87adceafc01badbbfa3b3ac259070a9c8a2c615ecdc2c544` |
| Compiled JS member | 1,617,499 bytes; SHA-256 `e510df86ac00ba6a11cf80c48aa0f9bdaef2e67da609dd9ad27a451a43a74e4e`; 32,375 lines |
| SDK configuration | `powerbi-visuals-tools` 7.2.1 with `--no-minify`; API package 5.11.1 and declaration 5.11.0 |

The completed `npm run package` check ran the normal and audit builds, reported
no external requests, and inspected the selected normal PBIVIZ. The audit
build's archive/member bytes differed; the wrapper restored the normal
unminified package and associated outputs. The exact-source rebuild check
passed at 239,595 bytes with identical full-archive SHA-256
`25b966ecd54dbcfe87adceafc01badbbfa3b3ac259070a9c8a2c615ecdc2c544`.
Normal builds under `TZ=Etc/GMT+12` and `TZ=Etc/GMT-14` were byte-identical.
ZIP CRC and canonical metadata checks passed.

This candidate was **not frozen** into the PBIP/sample handoff. The existing
PBIP remains untouched and still embeds the frozen payload:

| PBIP item | Existing bytes / SHA-256 | Candidate comparison |
| --- | --- | --- |
| `samples/release/Network.pbip` shortcut | 274 bytes; `169e7eb2f9634f331bc4e2df07f1e928e216e7bffc4e1459b3ea35e8ce9f2cce` | Existing source project; not regenerated |
| `samples/release/Network.Report/CustomVisuals/AtlynNetworkAB24C68297094C32AF64D50D92C01711/package.json` | 760 bytes; `3fcaa2b8d15a955003469e32f63d84368a352fd9116c3cc5ef04a0ec763aa136` | Equal |
| `samples/release/Network.Report/CustomVisuals/AtlynNetworkAB24C68297094C32AF64D50D92C01711/resources/AtlynNetworkAB24C68297094C32AF64D50D92C01711.pbiviz.json` | 881,889 bytes; `84276fa508720313cdb100d44ddc34ba0cf2b437627eea47ae3946d03cf57bc9` | Not equal |

The candidate's corresponding resource is 1,750,392 bytes, SHA-256
`001927f6e40fcccf17d6adf4f9ff0be71afd8b48c0cbd7ef050ee0cf7d170697`.
The unchanged frozen PBIVIZ remains 153,889 bytes, SHA-256
`6136c82c28ecf597634cbb90685f9cb1fbc3c435ce64613a8be180e8ff0f00ff`.
The prior `samples/release/sample-validation.json` still records the frozen
package and must not be read as validation of this new candidate. The release
PBIP and frozen sample were not overwritten; producing the next matching
PBIP/frozen handoff is left to the coordinator's release-freeze process.

## Ref, access, and native-host provenance

At the last remote read, `main` remained at `c19276b2d53bc02853737377136973d6fc937242`
(tree `6df47eb6ac5150b578974288674dc272ce18c42f`, Network 1.1.1.0), while
`certification` remained at `eefe619e40b4fedf5e0efcebf42fa41e7b3fce39`
(tree `01d07a69c1fe36bacb54009cd82bcf8155d1f015`, Network 1.2.0.0). The
branches intentionally differ; no protected ref was advanced. The private
repository's read access for OSDC1033 and `pbicvsupport` was confirmed by the
coordinator; no permissions were changed. Microsoft's separate requirement
that the `certification` branch source match the submitted package is not met
by the new branch-only unminified build, and no such match or promotion is
claimed.

The existing native handoff documentation records an owner-saved
`R:\Network.pbix`, 213,864 bytes, SHA-256
`9248f79d195ec76fe61f278911a79cbb333f50a12bec17a3ab8130419e325ab7`, with
cold reopen of the five-page 1.2 report and exact visual-member comparison to
the *previous frozen* package. That PBIX is absent from this worktree, so its
`DataModel` and embedded-resource parity could not be rechecked here; that
prior acceptance does not validate the new unminified resource. The separate
portal-observed filenames `AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.1.1.0.pbiviz`
and `AtlynNetwork_sample.pbix` were not available for hashing or parity checks
and are not evidence for this candidate. Native Desktop field-well drag/drop,
refresh, save/reopen, and interactions remain unverified in this worktree.

The current full `npm audit --json` still exits nonzero: 0 moderate, 6 high,
0 critical. The six high entries are the `braces` advisory
`GHSA-vfj7-8cjw-p6xm` (installed `braces@3.0.3`, affected through `<=3.0.3`)
propagated through `chokidar`, `micromatch`, `http-proxy-middleware`,
`webpack-dev-server`, and `powerbi-visuals-tools`. GitHub advisory metadata
currently reports no first patched version. npm offers Tools 1.7.2 only as a
breaking major downgrade. No safe compatible fix is published; no downgrade,
override, suppression, or audit bypass was applied. Microsoft therefore
continues to block certification readiness on the full-audit requirement.
