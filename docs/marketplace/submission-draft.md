# Partner Center draft — Atlyn Network

**Prepared 2026-09-09. Draft text only; nothing entered into Partner Center.**

**Owner approval, 2026-09-10:** use existing Atlyn storefront subscriptions for acquisition and **ungated visuals with free shared viewing**. The current offline runtime is intended; it does not enforce paid-author status. No license keys, new signer, AAD/API integration, feature gates or runtime requests are to be added. Licensing integration is no longer a blocker. Main/certification refs, merging and submission remain held for the parent's final native/assets/legal/release gate. The additional Microsoft Power BI visual certification badge is required, not yet achieved.

“Verified metadata” below means values already confirmed in the repository/coordinator's v1 baseline, not verification of publisher authority, legal adequacy, name reservation or a support SLA. **UNRESOLVED** fields are intentional release gates, not blanks to fill with guessed values.

## Create offer / Offer setup

Exact field names and behavior: [Microsoft offer setup](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-offer-setup).

| Partner Center field | Proposed entry or action | Approval/evidence |
| --- | --- | --- |
| Offer type | **Power BI visual** | Appropriate type; no offer created |
| Offer ID | `atlyn-network` | Proposed only; owner must verify uniqueness/existing offer. Lowercase, ≤50 characters, no spaces; immutable after Create |
| Offer alias | `Atlyn Network` | Proposed internal name |
| Publisher | **UNRESOLVED — select authorized verified Atlyn legal publisher** | GitHub organization `AtlynCo` is not evidence of Partner Center publisher identity/enrollment |
| Setup details | **External Atlyn storefront subscriptions; ungated runtime/free shared viewing** | Owner-approved model. Coordinator must reconcile exact portal classification/disclosures with Microsoft; this is not a runtime implementation blocker |
| Power BI certification | **REQUIRED: additional Power BI visual certification/badge** | Owner requirement approved; eligibility, remaining native coverage, source access and Microsoft's award remain pending. Do not submit before the final gate |
| Customer leads / CRM | No connection proposed | Optional; any future connection requires owner/privacy approval |

The exact documented setup choices are:

1. **Managing license and selling with Microsoft** — documented as Public Preview and a one-time setting after publication.
2. **My offer requires purchase of a service or offers additional in-app purchase**.
3. **My offer does not require purchase of a service and does not offer in app purchases**.

The approved model is external subscription acquisition with no visual-runtime license checks or paid-feature gates, including free shared viewing. It is not Microsoft-managed runtime licensing and does not enforce paid-author status. Do not add enforcement, keys, a signer, AAD/API integrations, WebAccess or runtime requests. Confirm the exact portal option and accurate acquisition disclosures with the coordinator/Microsoft; an ungated runtime alone does not mean the storefront acquisition is free. Power BI's own licensing and report security still apply.

## Properties

Exact fields: [Microsoft properties](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-properties).

| Field | Draft value | Status |
| --- | --- | --- |
| Categories | Primary **Flow**, secondary **Other** | Proposed from Microsoft's actual category list (maximum two); no correlation/causality claim |
| Industries | **UNRESOLVED — leave unselected unless owner approves** | Examples are synthetic; do not imply industry certification |
| Use the Standard Contract | **UNRESOLVED legal decision** | Acceptance is not authorized here. Microsoft warns that a published Standard Contract offer cannot switch to custom terms |
| EULA | **UNRESOLVED approved public URL/contract choice** | No guessed URL. Repository LICENSE does not alone establish the Marketplace customer contract |
| Privacy policy link | **UNRESOLVED approved HTTPS URL** | A valid organization privacy policy is required, even with no visual telemetry |
| Support document link | `https://atlynco.github.io/atlyn-powerbi-support/docs/faq/` | Existing verified metadata; owner must approve content coverage/maintenance |

If legal chooses Microsoft's Power BI visuals default EULA rather than the Standard Contract or a custom EULA, Microsoft documents this candidate:
`https://visuals.azureedge.net/app-store/Power%20BI%20-%20Default%20Custom%20Visual%20EULA.pdf`.
Its mention here is **not acceptance, legal advice or a claim of an approved Atlyn contract**.

**Existing first-party terms, unchanged:** `package.json` declares `license: "UNLICENSED"`. The root `LICENSE` is proprietary Copyright (c) 2026 Atlyn, all rights reserved; repository access grants no use/reproduction/modification/distribution/sublicensing/sale/public-disclosure rights without a separate written Atlyn agreement. It preserves third-party licenses and provides "AS IS" warranty/liability disclaimers. No open-source identifier or replacement terms are introduced. Approved ungated rendering does not itself amend these terms or select a Marketplace customer EULA.

## Offer listing — English

Exact fields/limits: [Microsoft listing](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-offer-listing).

**Name**

```text
Atlyn Network
```

Owner must confirm name rights/reservation. This draft does not claim “Power BI Certified,” “best,” “fastest,” or competitor superiority.

**Summary** — 86 characters

```text
Explore directed relationships, cycles and reciprocal links with graph and list views.
```

**Description** — below Microsoft's 3,000-character limit

```text
Atlyn Network helps report authors and readers investigate directed relationships already supplied by a Power BI semantic model.

Bind Source ID and Target ID to explore service dependencies, account relationships and other connected data. Add Relationship type and Edge ID to distinguish different relationship kinds and parallel links. Optional Weight and tooltip measures retain model formatting.

See cycles, reciprocal links, self-loops and disconnected components without forcing the network into a tree. Search loaded entities, inspect incident relationships, explore upstream or downstream reachability, and find one shortest directed path within the loaded graph. Pan, zoom, fit, or switch between graph and accessible list views.

Keep exploration separate from report filtering. Local focus and saved local views do not create a model filter. Relationship selection sends native relationship identities to Power BI; selecting an entity selects its loaded incident relationships, not an independent entity dimension.

The visual includes English and Arabic interface resources, RTL layout, host high-contrast support, keyboard-accessible controls and paginated entity/relationship lists. The packaged visual uses no external runtime data requests, telemetry, sign-in or remote assets.

Acquire the visual through existing Atlyn storefront subscriptions. Once acquired, the visual runs without license keys, paid-author enforcement or feature gates; shared-report viewing is free of additional visual runtime checks. Power BI licensing and report security still apply.

Use the offline sample report to investigate cyclic services and reciprocal synthetic account relationships. Keep identifiers such as 0001 typed as text. Review diagnostics for missing identifiers, conflicting Edge IDs, incomplete weights and loaded-data limits.

Atlyn Network is a bounded relationship explorer, not causal-impact prediction, fraud detection, process mining or whole-network analysis. It processes at most 5,000 delivered rows and displays at most 250 endpoint entities and 1,000 relationships. Host filtering and data reduction can further change the supplied network. A missing path means no path was found in the loaded topology, not proof that none exists in the underlying business data.

Support: https://atlynco.github.io/atlyn-powerbi-support/docs/faq/
```

Before using this draft, reconcile every feature statement with the **frozen final package** and native test outcomes. The approved acquisition/runtime distinction is included above; final portal wording and storefront terms still require coordinator confirmation. Do not invent paid-author enforcement or describe a PBIP-only deliverable as the required downloadable PBIX; supply the genuine converted/offline-tested PBIX first.

**Search keywords** — three fields

```text
network graph
directed relationships
dependency exploration
```

**Additional languages:** no translated marketplace listing proposed until an owner reviews the translation and associated support obligations. Arabic runtime resources do not constitute approval of an Arabic store listing.

## Marketplace media

| Field | Proposed file/content | Gate |
| --- | --- | --- |
| Logo | Coordinator's original `assets\logo-300.png` | Confirm PNG, exactly 300×300, accurate branding/rights and owner approval |
| Screenshot 1 | Cyclic-services investigation with visible reciprocal links and self-loop | Final PBIVIZ, correct image dimensions; document mock/native capture provenance |
| Screenshot 2 | Reciprocal-account investigation with text IDs and useful selection/detail context | Final PBIVIZ; no implied fraud finding |
| Screenshot 3 (optional) | Accessible list/local path workflow, only if shown by actual final UI | Accurate native or clearly identified mock-host evidence |
| Screenshot 4–5 | Omit unless each adds a distinct verified benefit | Maximum five total |
| Video | Omit | Optional HTTPS YouTube/Vimeo URL only if later approved |

Every screenshot must be PNG, exactly **1366×768**, ≤**1024 KB**. A 300×300 logo and a 20×20 toolbox icon serve different purposes. Text callouts may explain genuine features; do not present unsupported certification/native-validation claims. Final suitability and upload remain coordinator tasks.

## Availability

[Microsoft availability](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-availability) allows market choices; those choices affect new acquisitions, not existing customers in removed markets. If Microsoft-managed licensing is selected, availability is configured at the plan level.

**Markets, release date, pricing plans, currencies/tax/commercial eligibility: UNRESOLVED owner/legal decisions.** Do not assume global release or accept a portal default on the owner's behalf.

## Technical configuration

Exact requirements: [Microsoft technical configuration](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-technical-configuration).

| Field | Draft artifact/identity | Status |
| --- | --- | --- |
| PBIVIZ package | `AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.1.0.0.pbiviz` | Final coordinator artifact only, not a stale candidate |
| Sample PBIX report file | `AtlynNetwork-1.1.0.0-native.pbix` | Genuine coordinator-produced Public PBIX; bounded Desktop 2.157.1354.0 save/cold-reopen and embedded-member equality recorded; full submission coverage remains open |
| Internal identity | Stable GUID above; four-part version `1.1.0.0`; API `5.11.0` | Never change GUID to bypass AppSource update behavior |
| Author | `Atlyn` | Existing verified metadata |
| Author email | `atlyn.help@gmail.com` | Existing verified metadata; monitoring/support authority unresolved |
| Support URL | `https://atlynco.github.io/atlyn-powerbi-support/docs/faq/` | Existing verified metadata |
| Source repository | `https://github.com/AtlynCo/powerbi-network-graph` | Private; reviewer access unresolved |

Native PBIX conversion must use the PBIP **after** `node .\scripts\sample-package.mjs` embeds the final package. Attach final PBIVIZ SHA-256 and verify PBIX embedded visual version/content independently. Do not upload a source ZIP renamed `.pbix`.

The coordinator's 2026-09-10 PBIX is 202,265 bytes, SHA-256
`8d1a2b245733169d5f4a54b2d3c3d878cd0e01238dc7369b6a053031c50c6f19`;
embedded manifest/resource bytes match the unchanged `a291552f...` PBIVIZ.
The first refresh left native banners; the second observed refresh completed.
See the [bounded native record](../validation/RESULTS.md#bounded-native-desktop-result-2026-09-10).
This is a candidate asset, not authorization to upload or submit.

## Review and publish — Notes for certification draft

This is **not ready to paste while placeholders remain**. Do not paste secrets into this repository.

```text
Atlyn Network, version 1.1.0.0
GUID: AtlynNetworkAB24C68297094C32AF64D50D92C01711
Visual API: 5.11.0

Source: https://github.com/AtlynCo/powerbi-network-graph/tree/certification
Frozen source commit: [UNRESOLVED FINAL COMMIT]
Submitted PBIVIZ SHA-256: [UNRESOLVED FINAL ARTIFACT HASH]
Candidate sample PBIX SHA-256: 8d1a2b245733169d5f4a54b2d3c3d878cd0e01238dc7369b6a053031c50c6f19

The lowercase certification branch contains the matching single-visual source and locked dependencies. Follow the repository's local package command and documented tooling/locale prerequisites. Generated dist, node_modules and .tmp directories are not part of the submitted source tree.

The visual has no external runtime data/resource requests, telemetry, sign-in or licensing calls. Its capabilities privilege list is empty. It supports rendering lifecycle events. The sample uses only literal synthetic imported tables.

Acquisition uses existing Atlyn storefront subscriptions. Runtime rendering and shared viewing are intentionally ungated; there is no paid-author enforcement. Additional Power BI visual certification and its badge are an explicit release requirement, not an award already received.

Sample scenarios: cyclic service dependencies and reciprocal account relationships, including parallel edges, a self-loop, duplicate category aggregation, conflicting Edge IDs and incomplete weights. The sample contains hints and native slicer/detail-table interaction checks.

Native and submission test evidence: [UNRESOLVED APPROVED EVIDENCE REFERENCE]
Known limitations: bounded loaded topology (5,000 delivered rows, 250 entities, 1,000 relationships); selection actions capped at 200 complete identities; no segmented data loading, causal inference or fraud determination.

Private source access: [AUTHORIZED OWNER TO PROVIDE CURRENT MICROSOFT-REQUESTED ACCESS DETAILS THROUGH THE APPROVED SECURE CHANNEL; NO SECRETS IN THIS DOCUMENT]
```

## Approval ledger

All items below remain unresolved unless the coordinator supplies dated authoritative evidence:

- [ ] Partner Center enrollment, legal publisher identity and authorized submission operator.
- [ ] Offer ID/name reservation and trademark/content/media rights.
- [x] Owner-approved pattern: external Atlyn storefront subscriptions, ungated runtime/free shared viewing; no paid-author enforcement.
- [x] Owner explicitly requires the additional Power BI visual certification badge.
- [ ] Exact portal classification and storefront acquisition disclosures confirmed for the approved pattern.
- [ ] Microsoft awards the additional Power BI visual certification/badge after review.
- [ ] EULA/Standard Contract approval and any irrevocable acceptance.
- [ ] Valid approved privacy-policy URL and legal review of actual processing/support practices.
- [ ] Support owner, monitored address, escalation and service commitments.
- [ ] Markets, industry claims, localization and commercial/tax requirements.
- [ ] Final accurate logo/screenshots; mock/native evidence distinction.
- [x] Coordinator-produced Public PBIX, bounded Desktop save/cold-reopen and exact same-package embedded-member proof, 2026-09-10. First-refresh banners remain part of the record.
- [ ] Remaining native/submission testing, including explicit offline refresh and full interaction/measure coverage.
- [ ] Exact-source certification branch, API/tools requirement reconciliation and secure reviewer access.
- [ ] Explicit approval to submit; separate approval to publish. Neither is granted here.
