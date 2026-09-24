# October 2026 certification preflight and handoff

**Prepared and official sources rechecked: 2026-09-24. Target: October 2026.**
This is a runbook, not permission to submit, publish, change refs or accept
terms. Reopen the linked Microsoft documentation and confirm the actual
Partner Center requirements **immediately before use in October**.

## Frozen candidate and completed local work

Atlyn Network **1.2.0.0**, unchanged GUID
`AtlynNetworkAB24C68297094C32AF64D50D92C01711`; **153,889 bytes**.
The package in `samples/release/package/` and `dist/` has SHA-256:

`cf6d0ed1dad87d8cbd0d27b47f6190fce014bea70a96a79170f7725f8cbc280f`

[Current evidence](../validation/RESULTS-1.2.md) records 162 passing tests,
typecheck/lint, official package audit/inspection, zero dependency
vulnerabilities, 17 standard and 37 extended actual-package browser checks,
five labeled mock-host images, 24 benchmark groups with 30 measured samples
each, sample schema/byte equality and official TOM preflight. All are
**local checks**, not native Power BI or Microsoft's certification.

The five-page/four-graph PBIP is current; a same-version native PBIX is not.
Keep all 1.1 archives, evidence and images unchanged. Use the current
`dist/release-manifest.json` and its sidecar for the handoff source commit.
Docs-only commits do not require repackaging when build inputs are unchanged.
SDK ZIP timestamps vary across builds; do not casually rebuild or normalize
this archive. A changed package requires new hashes and refreshed evidence.

**Read-only branch check, 2026-09-24:** local `origin/certification` and the
live GitHub `refs/heads/certification` both resolve to
`c19276b2d53bc02853737377136973d6fc937242` (visual **1.1.1.0**).
Implementation commit `f2b30c9e09e899e0cc16929af2167f3091921560` is one commit
ahead, with no certification-only commits. Thus that branch **does not match
the 1.2 candidate**. The subsequent handoff docs commit is identified by the
new local manifest. No fetch, push or certification-ref movement was performed.
Any eventual source-branch update/reviewer access is an explicitly authorized
owner action, not a step to execute under this runbook's preparation scope.

## What can be prepared before October

| Work | Status / next owner action |
| --- | --- |
| Technical dossier | Ready locally: retain the package, PBIP, exact source/manifest and [dated receipts](../validation/RESULTS-1.2.md). Recheck current API/tools and the [required tests][tests] before submission. |
| Native sample and matrix | Schedule authorized Desktop/Service testing now. Produce a genuinely offline **1.2.0.0 PBIX**, verify embedded package members, all layouts/centers, field conversions, filters/selection, formatting, bookmarks, resize/view modes, multi-page/instance behavior and save/cold-reopen. Include a final hints page. Respect tenant/developer-mode policies; never change the GUID to force a local version. |
| Listing media | Existing 300x300 PNG logo and five 1366x768 candidate PNGs are available; owner approval and accessible feature callouts remain required. Current images are explicitly mock-host, not native evidence. See the size discrepancy below. |
| Legal/support | Owner must approve and verify HTTPS support/privacy links and an EULA/contract choice. The repository `LICENSE` is not an approved customer EULA. No terms, URLs or customer permissions are decided here. |
| Account/reviewer readiness | Owner confirms Marketplace enrollment, publisher authority, offer identity, secure reviewer access and the final release hold. Do not put credentials or recovery codes in Git, receipts or chat. |

Also reconcile the current certification page's exact command/file wording
(including its named `eslint` script example; this repository exposes
`npm run lint`) and Microsoft's required sample-dataset coverage. Do not mark
those formal submission checks complete solely from local command passes.
If a source/tool change is required, prepare and revalidate a new candidate
rather than altering the frozen package or claiming the old evidence covers it.

**Image guidance discrepancy:** the [Power BI publish page][publish] and
[direct offer-listing page][listing] require **1-5 PNGs, exactly 1366x768,
at most 1024 KB**, plus a **300x300 PNG logo**. The [broader planning
overview][planning] instead says 1280x720 for screenshots. Use the two
product-specific pages as the current guidance (the candidate satisfies
their dimensions/size), but have the owner **confirm the actual Partner
Center upload validator before October submission**. Do not silently resize
frozen evidence or treat dimension compliance as listing approval.

## Submission and additional-certification order

1. **Refresh requirements and close owner gates.** Recheck [publishing][publish],
   [testing][tests], [technical configuration][technical] and
   [certification][certification]. Obtain native, legal/media and owner sign-off;
   confirm the exact PBIVIZ/PBIX pair and reviewable source. Any authorized
   `certification` branch must be lowercase, contain only this visual and match
   the submitted package; retain that baseline until the next submission.
2. **Use the owner-controlled Partner Center publishing workflow.** Confirm
   enrollment and prepare the offer, legal/support information and technical
   uploads. Marketplace validation/approval is an external Microsoft action;
   generic Marketplace "certification" is not the additional Power BI badge.
3. **Request the separate Power BI certification in the approved workflow.**
   Microsoft requires Partner Center approval and **recommends**, rather than
   mandates, publication before requesting the badge. The documented request
   is **Product setup > Request Power BI certification**, with source/access
   information in **Review and publish > Notes for certification**. An owner
   must handle current secure access arrangements directly with Microsoft.
4. **Respect Atlyn's badge-before-distribution hold.** Microsoft's recommendation
   to publish first does not authorize this project to go live uncertified.
   Have the owner reconcile the staging/request sequence with Microsoft;
   do not infer permission to publish from this runbook or a passing build.
5. **Await real outcomes, then separately authorize release.** Track required
   corrections, test-environment review, Microsoft approval and the actual
   additional badge. Do not promise an October date or certify the visual
   yourself. Any repackage/resubmission needs the same GUID, appropriate version,
   matching source/PBIX and refreshed evidence.

## Azure credits are not a prerequisite

**No Azure-credit dependency exists for this offline visual's certification
handoff.** The cited Power BI submission requirements call for Partner Center
enrollment, artifacts, testing and approvals, not Azure credits. The visual
has empty runtime privileges and no Azure resource/runtime dependency.
[Azure credits][credits] are a separate Partner Center membership benefit
for Azure usage, with their own eligibility/redemption process. Preparation
can proceed before October without acquiring or redeeming them. Normal
Power BI licensing/tenant rules and Marketplace enrollment still apply.
No Azure redemption, billing action or UI operation is part of this work.

[certification]: https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified
[publish]: https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store
[tests]: https://learn.microsoft.com/en-us/power-bi/developer/visuals/submission-testing
[planning]: https://learn.microsoft.com/en-us/partner-center/marketplace-offers/marketplace-power-bi-visual
[technical]: https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-technical-configuration
[listing]: https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-offer-listing
[credits]: https://learn.microsoft.com/en-us/partner-center/benefits/mpn-benefits-azure-cloud
