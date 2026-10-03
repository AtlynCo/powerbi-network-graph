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
