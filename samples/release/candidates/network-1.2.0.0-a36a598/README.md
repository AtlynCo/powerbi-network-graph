# Frozen Network 1.2.0.0 candidate

This isolated PBIP candidate pairs the normal unminified production PBIVIZ
with a separate copy of the authored sample. The historical
`samples\release` project and frozen artifacts are unchanged. This directory
does not contain a PBIX and is not native Desktop, Service, or Microsoft
certification evidence.

## Artifact and PBIP pair

| Item | Path relative to this directory | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| PBIVIZ | `package\AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.2.0.0.pbiviz` | 239,595 | `25b966ecd54dbcfe87adceafc01badbbfa3b3ac259070a9c8a2c615ecdc2c544` |
| PBIP shortcut | `Network.pbip` | 274 | `169e7eb2f9634f331bc4e2df07f1e928e216e7bffc4e1459b3ea35e8ce9f2cce` |
| Embedded `package.json` | `Network.Report\CustomVisuals\AtlynNetworkAB24C68297094C32AF64D50D92C01711\package.json` | 760 | `3fcaa2b8d15a955003469e32f63d84368a352fd9116c3cc5ef04a0ec763aa136` |
| Embedded visual resource | `Network.Report\CustomVisuals\AtlynNetworkAB24C68297094C32AF64D50D92C01711\resources\AtlynNetworkAB24C68297094C32AF64D50D92C01711.pbiviz.json` | 1,750,392 | `001927f6e40fcccf17d6adf4f9ff0be71afd8b48c0cbd7ef050ee0cf7d170697` |

`sample-validation.json` records byte-for-byte equality for the copied PBIVIZ
and both embedded package resources, plus validation of 30 files against the
pinned Microsoft schema bundle (commit `83ce11373faada0d01e76264a5cceb0ba70003e6`),
four bound graph visuals, 50 field bindings, eight model tables, six
relationships, and fourteen globally unique measures. The visual is GUID
`AtlynNetworkAB24C68297094C32AF64D50D92C01711`, version `1.2.0.0`.

The PBIVIZ production build was made from source HEAD
`a36a5981980219f713593989a62238f137ba631d`; its 24 build inputs have SHA-256
`f34082031d754f7bbb8ebeb82b8289417d68557a4612477010bf3f46aeab3450`.
Changes after that build were limited to the sample assembler's constrained
`--sample-root` option, candidate/sample documentation, and this PBIP copy;
the visual's build inputs were verified unchanged.

## Headless browser evidence

Both offline Playwright suites loaded the PBIVIZ at the path above and reported
its exact SHA-256:

- `npm run test:browser`: 17/17 actual-package checks passed, with zero runtime
  errors and zero network requests.
- `node scripts\release-browser.mjs --preliminary`: 38/38 release-browser
  checks passed, with zero runtime errors and zero network requests.

The suites ran headlessly using the installed Edge executable at
`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. The local
harness blocks network requests and mocks Power BI APIs. These results do not
validate Power BI Desktop field wells/drag-drop, refresh, save/reopen,
Service, export, accessibility certification, Partner Center, or AppSource.

## Open blockers

- Full `npm audit` remains blocked by six high `GHSA-vfj7-8cjw-p6xm` findings
  in the transitive `braces@3.0.3` dependency chain; no safe compatible fix
  was available in the last audit, and none was suppressed or overridden.
- The official Power BI visuals tools 7.2.2 release exists, but the configured
  registry returned E404 and public registry probes failed TLS. Tools 7.2.1
  is the latest version installable in this environment, not the global
  latest. No feed, TLS, lockfile, or dependency workaround was applied.
- The current manifest/lockfile remains Tools 7.2.1 and API package 5.11.1;
  `pbiviz.json` correctly declares API 5.11.0.
- The owner-saved PBIX and native Desktop checks are not available in this
  worktree. Existing PBIX acceptance covers only the prior frozen PBIVIZ.
  Candidate-specific Desktop field-well behavior remains unverified.
