# Marketplace and certification preparation

**Research checked: 2026-09-09. Release target: 1.1.0.0. Status: preparation, not submission or certification.**

**Owner-approved pattern (2026-09-10):** external storefront subscriptions govern acquisition; visuals run ungated, with free shared viewing and no paid-author enforcement. The existing offline renderer is intended, following the coordinator's assessment of existing Distribution/Scatter source. No keys, new signer, AAD/API integration, feature gates or runtime requests are to be added. Runtime licensing is no longer a blocker.

**Still held:** native evidence, real PBIX/final assets, legal/reviewer-access and the coordinator's final gate. The additional Microsoft Power BI visual certification badge is **required, not achieved**; general Marketplace approval is not a substitute. Do not move main/certification refs, merge, or submit before that gate. This decision does not repackage, bump the version, or modify frozen evidence.

This directory separates Microsoft requirements, repository evidence, proposed listing copy, and decisions that only an authorized Atlyn owner can approve. No Partner Center account was accessed or changed by this work. No offer was created/submitted/published; no reviewer permissions or hosted workflow runs were created. Source changes are delivered separately through a private review branch/PR, with no certification-reference movement.

- [Exact draft fields and owner approvals](submission-draft.md)
- [Submission and certification test matrix](testing-checklist.md)
- [Evidence-based competitor/workflow comparison](workflow-benchmark.md)
- [Fully authored offline sample and assembly instructions](../../samples/release/README.md)

## Required files and identity

| Item | Requirement verified in Microsoft documentation | Preparation status |
| --- | --- | --- |
| PBIVIZ | Real compiled package; complete metadata; four-part version; same GUID on updates | Target `AtlynNetworkAB24C68297094C32AF64D50D92C01711`, `1.1.0.0`, API `5.11.0`; coordinator must freeze final artifact |
| Sample PBIX | **Required**, works offline with no external connections; visual version and content match PBIVIZ | A complete source PBIP is authored; **native conversion, offline reopen and PBIX content verification unresolved** |
| Logo | PNG, **exactly 300×300** | Coordinator owns final asset and approval; 20×20 package icon is not a substitute |
| Screenshots | **1–5 PNGs**, **exactly 1366×768**, each **≤1024 KB**; sharp, inclusive, accurate | Coordinator owns final images; use comfortably below 1,024,000 bytes to avoid ambiguous KB interpretation |
| Support | Public HTTPS support link | Existing metadata: `https://www.atlynco.com/docs/faq`; operational support commitment unresolved |
| Privacy | Valid public HTTPS organization privacy-policy URL | **Unresolved owner/legal approval and verified URL** |
| Terms | Accepted standard contract or own/Power BI visuals EULA, according to Partner Center options | **Unresolved legal choice and acceptance** |
| Source | Single visual; reviewable source; lowercase **`certification`** branch matching submitted package | **Coordinator Git action after final baseline; no branch created here** |
| Additional Power BI visual certification badge | Separate Microsoft review beyond general listing approval | **Owner-required; not yet obtained** |

Sources: [publish requirements][publish], [technical configuration][technical], [listing media][listing], [certification requirements][certification].

Screenshot callouts can explain real features, but must not hide errors or imply unsupported features. Retain original image, package hash, input data, environment and capture method. A browser-host mock image can demonstrate packaged rendering; label it **mock-host evidence, not Power BI Desktop/service validation**. Do not use vendor UI, fabricated Desktop chrome, certification badges, or a screenshot from another package version. Native screenshots and accessible media approval remain operator tasks.

Four [checked-in quality images](media/) show the sealed package with historical unlicensed/mock-host banners. `media/provenance.json` records package, image and sample hashes. Preserve these images and frozen provenance unchanged. "Unlicensed" describes absence of runtime checks, not a missing implementation or a change to copyright terms. Parent-supplied native/final media still needs approval before submission; no new paid-runtime build is expected solely for licensing.

## Source branch and reproducibility

Microsoft specifies **`certification` in lowercase**. The branch must contain source matching the submitted compiled package; update it only for a subsequent submission/resubmission. A branch named `Certification`, a release branch, an old main commit, or only a PBIVIZ download link is not equivalent.

The private `AtlynCo/powerbi-network-graph` repository is not required to become public. Microsoft must be able to review it, including any private npm/submodule dependencies. The official page describes a validation account, 2FA/recovery codes and read-only access for `pbicvsupport`. **An authorized owner must handle the current access process directly and securely with Microsoft.** Do not put passwords, tokens or recovery codes in Git, this document, evidence JSON, a public issue, or screenshots. This task grants no access.

Required source files: `.gitignore`, `capabilities.json`, `pbiviz.json`, `package.json`, `package-lock.json`, `tsconfig.json`; TypeScript, ESLint and `eslint-plugin-powerbi-visuals`; a documented `eslint` command. `.gitignore` must exclude `node_modules`, `.tmp`, `dist`; those directories must not be included in the submitted **source** tree. Compiled output is delivered separately as the actual PBIVIZ. The sample's embedded compiled visual is the **same visual**, not another product; ensure reviewers can clearly distinguish authored source from sample/runtime resources and confirm their treatment if Microsoft requests a source-only archive.

Microsoft requires latest API/tools, successful `npm install`, `pbiviz package` (or explained `npm run package`), audit without moderate/high warnings, and the required ESLint configuration without errors. The 2026-09-09 registry check returned API npm package `5.11.1` and tools `7.2.1`, matching the installed locked versions. The API package's own `index.js` exports the major/minor interface version with patch zero (`5.11.0`), so the manifest's `apiVersion: 5.11.0` is intentional and current for that package. Recheck registry and exported API versions immediately before submission; this is a dated observation, not a permanent latest-version claim.

Package/source equality must be independently reproducible using the checked-in lockfile and documented local wrapper. The wrapper's locale behavior and any certificate provisioning must be explained; do not provide private signing/development keys. `pbiviz package --certification-audit` can help detect unsafe bundled calls; it is not Microsoft certification. A certification-fix rewrite changes the final artifact and requires a new reproducible baseline and complete retest.

After final packaging:

```powershell
node .\scripts\sample-package.mjs
node .\scripts\sample-package.mjs --validate
```

`sample-validation.json` proves that the self-contained PBIP package copy and every extracted custom-visual resource equal the actual final archive bytes. It does **not** prove that a later PBIX saved by Desktop contains those bytes. Check that separately before uploading.

## Official public authoring basis

- [PBIP overview][pbip]: public text project files support programmatic generation; the shortcut points to a report. Preview status and Windows path-length limitations apply.
- [Project report folder / PBIR][pbir]: enhanced PBIR is publicly documented and supports external modifications. The legacy root `report.json` is not the supported authoring route. Private visuals live in `CustomVisuals`; `definition.pbir` uses a relative `byPath` model link.
- [Project semantic-model folder][model]: TMDL lives in `definition`; version 4.0 supports TMDL. With no `cache.abf`, model definitions load without imported data until refresh.
- [TMDL specification][tmdl]: model/table/partition/measure/relationship syntax; Microsoft's TOM `TmdlSerializer` is the native grammar authority.
- [Microsoft public JSON schemas][schemas]: cached at commit `83ce11373faada0d01e76264a5cceb0ba70003e6`, under their MIT license, with raw-file hashes.
- [Official Microsoft source example][example]: consulted for TMDL model/partition organization, not copied as an unrelated model. The sample's synthetic facts and report are authored for this repository.
- [Public MIT-licensed private-visual PBIR example][private-example]: corroborates the private visual registration convention: metadata `name` and `path` are the resource filename, while the physical file remains under `CustomVisuals/<GUID>/resources/`. Only configuration conventions were inspected; no third-party visual code/report content is bundled.

The source project passes public JSON schemas and strict authored-template/referential checks. The separate `scripts/validate-tmdl.ps1` preflight also successfully deserializes it using official Microsoft TOM and checks required PBIR version/structure. **No Power Query runtime, DAX engine or Desktop renderer has been invoked.** These gates establish model grammar and report structure, not private-visual native loading. The coordinator must record and resolve any native diagnostic before calling it release-ready.

**Native-driven sample correction (2026-09-10):** preserve `definition.pbir`
artifact version `"4.0"` but use `"2.0.0"` in `definition/version.json`.
The earlier `"4.0.0"` report-definition value passed schema checks yet caused
no pages to load in the coordinator's other-sample native A/B. The Network
generator and both validators now distinguish these versions, with regression
coverage. This corrects sample metadata only; the SDK-produced PBIVIZ stays
byte-identical. Network native acceptance is still pending.

**Subsequent actual Network native blocker (2026-09-10):** Desktop 2.157
rejected the corrected-version project before model loading because Services
and Accounts both declared the same seven measure names, starting with
`Total Weight`. All fourteen now carry `Services` or `Accounts` prefixes in
TMDL, PBIR bindings/query identifiers, contract metadata and sample guidance.
JavaScript and the TOM wrapper explicitly reject model-global duplicate names,
including case-only collisions; TOM deserialization alone did not enforce this.
Data, DAX calculations, formats and embedded SDK bytes are unchanged. The
corrected model awaits coordinator-owned native acceptance; no native pass
or PBIX conversion follows from local preflight.

## Release decision

Local code tests, a completed PBIP, a zero-error static preflight and an attractive image are each useful evidence, but do not replace the [complete native/submission matrix](testing-checklist.md), legal/commercial approvals, a same-version offline PBIX, or Microsoft's own review.

All local work must remain local. **No GitHub Actions, hosted CI, cloud coding agents, Codespaces or workflow runs.** Service/mobile/dashboard/export checks are unresolved manual release gates; do not publish data or a report simply to tick them off under this task's no-publish restriction.

[publish]: https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store
[technical]: https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-technical-configuration
[listing]: https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-offer-listing
[certification]: https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified
[pbip]: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview
[pbir]: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report
[model]: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset
[tmdl]: https://learn.microsoft.com/en-us/analysis-services/tmdl/tmdl-overview
[schemas]: https://github.com/microsoft/json-schemas/tree/83ce11373faada0d01e76264a5cceb0ba70003e6/fabric
[example]: https://github.com/microsoft/Analysis-Services/tree/master/pbidevmode/fabricps-pbip/SamplePBIP
[private-example]: https://github.com/emil-eklund/markdown-visual/tree/main/reports/github-issues/github-issues.Report
