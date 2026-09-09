# Partner Center draft — Atlyn Network

**Prepared 2026-09-09. Draft text only; nothing entered into Partner Center.**

**Owner decision:** all eight new visuals, including Network, will be paid through existing Atlyn subscriptions. This quality candidate intentionally contains no entitlement enforcement. The coordinator is resolving the shared licensing/storefront contract. It is **not** a final paid/submission build; no certification-ref movement, merge, or submission is authorized while that contract is pending.

“Verified metadata” below means values already confirmed in the repository/coordinator's v1 baseline, not verification of publisher authority, legal adequacy, name reservation or a support SLA. **UNRESOLVED** fields are intentional release gates, not blanks to fill with guessed values.

## Create offer / Offer setup

Exact field names and behavior: [Microsoft offer setup](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-offer-setup).

| Partner Center field | Proposed entry or action | Approval/evidence |
| --- | --- | --- |
| Offer type | **Power BI visual** | Appropriate type; no offer created |
| Offer ID | `atlyn-network` | Proposed only; owner must verify uniqueness/existing offer. Lowercase, ≤50 characters, no spaces; immutable after Create |
| Offer alias | `Atlyn Network` | Proposed internal name |
| Publisher | **UNRESOLVED — select authorized verified Atlyn legal publisher** | GitHub organization `AtlynCo` is not evidence of Partner Center publisher identity/enrollment |
| Setup details | **Paid using existing Atlyn subscriptions** | Owner-approved commercial model; exact portal option and entitlement contract remain unresolved. Do not select a free/IAP/transactable option yet |
| Power BI certification | Intended future request; **UNRESOLVED approval and eligibility** | Do not check/request before required gates and source access are ready |
| Customer leads / CRM | No connection proposed | Optional; any future connection requires owner/privacy approval |

The exact documented setup choices are:

1. **Managing license and selling with Microsoft** — documented as Public Preview and a one-time setting after publication.
2. **My offer requires purchase of a service or offers additional in-app purchase**.
3. **My offer does not require purchase of a service and does not offer in app purchases**.

The runtime currently has no license check or paid-feature gate. Paid distribution is now approved, but this package is only unlicensed quality evidence. The final listing must disclose the agreed paid behavior, and entitlement enforcement must be implemented/tested against the coordinator's single shared contract. Do not add ad hoc checks, WebAccess, or external runtime license calls. Resolve the general policy's free-plus-IAP wording against the agreed storefront option with Microsoft rather than assuming one overrides the other.

## Properties

Exact fields: [Microsoft properties](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-properties).

| Field | Draft value | Status |
| --- | --- | --- |
| Categories | Primary **Flow**, secondary **Other** | Proposed from Microsoft's actual category list (maximum two); no correlation/causality claim |
| Industries | **UNRESOLVED — leave unselected unless owner approves** | Examples are synthetic; do not imply industry certification |
| Use the Standard Contract | **UNRESOLVED legal decision** | Acceptance is not authorized here. Microsoft warns that a published Standard Contract offer cannot switch to custom terms |
| EULA | **UNRESOLVED approved public URL/contract choice** | No guessed URL. Repository LICENSE does not alone establish the Marketplace customer contract |
| Privacy policy link | **UNRESOLVED approved HTTPS URL** | A valid organization privacy policy is required, even with no visual telemetry |
| Support document link | `https://www.atlynco.com/docs/faq` | Existing verified metadata; owner must approve content coverage/maintenance |

If legal chooses Microsoft's Power BI visuals default EULA rather than the Standard Contract or a custom EULA, Microsoft documents this candidate:
`https://visuals.azureedge.net/app-store/Power%20BI%20-%20Default%20Custom%20Visual%20EULA.pdf`.
Its mention here is **not acceptance, legal advice or a claim of an approved Atlyn contract**.

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

Use the offline sample report to investigate cyclic services and reciprocal synthetic account relationships. Keep identifiers such as 0001 typed as text. Review diagnostics for missing identifiers, conflicting Edge IDs, incomplete weights and loaded-data limits.

Atlyn Network is a bounded relationship explorer, not causal-impact prediction, fraud detection, process mining or whole-network analysis. It processes at most 5,000 delivered rows and displays at most 250 endpoint entities and 1,000 relationships. Host filtering and data reduction can further change the supplied network. A missing path means no path was found in the loaded topology, not proof that none exists in the underlying business data.

Support: https://www.atlynco.com/docs/faq
```

Before using this draft, reconcile every feature statement with the **frozen final package** and native test outcomes. Add pricing/paid-feature disclosures only after the actual commercial decision is approved. Do not describe a PBIP-only deliverable as the required downloadable PBIX; supply the genuine converted/offline-tested PBIX first.

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
| Sample PBIX report file | `Atlyn Network Offline Sample.pbix` | Proposed filename; **file not produced by this task** |
| Internal identity | Stable GUID above; four-part version `1.1.0.0`; API `5.11.0` | Never change GUID to bypass AppSource update behavior |
| Author | `Atlyn` | Existing verified metadata |
| Author email | `atlyn.help@gmail.com` | Existing verified metadata; monitoring/support authority unresolved |
| Support URL | `https://www.atlynco.com/docs/faq` | Existing verified metadata |
| Source repository | `https://github.com/AtlynCo/powerbi-network-graph` | Private; reviewer access unresolved |

Native PBIX conversion must use the PBIP **after** `node .\scripts\sample-package.mjs` embeds the final package. Attach final PBIVIZ SHA-256 and verify PBIX embedded visual version/content independently. Do not upload a source ZIP renamed `.pbix`.

## Review and publish — Notes for certification draft

This is **not ready to paste while placeholders remain**. Do not paste secrets into this repository.

```text
Atlyn Network, version 1.1.0.0
GUID: AtlynNetworkAB24C68297094C32AF64D50D92C01711
Visual API: 5.11.0

Source: https://github.com/AtlynCo/powerbi-network-graph/tree/certification
Frozen source commit: [UNRESOLVED FINAL COMMIT]
Submitted PBIVIZ SHA-256: [UNRESOLVED FINAL ARTIFACT HASH]
Offline sample PBIX SHA-256: [UNRESOLVED NATIVE PBIX HASH]

The lowercase certification branch contains the matching single-visual source and locked dependencies. Follow the repository's local package command and documented tooling/locale prerequisites. Generated dist, node_modules and .tmp directories are not part of the submitted source tree.

The visual has no external runtime data/resource requests, telemetry, sign-in or licensing calls. Its capabilities privilege list is empty. It supports rendering lifecycle events. The sample uses only literal synthetic imported tables.

Sample scenarios: cyclic service dependencies and reciprocal account relationships, including parallel edges, a self-loop, duplicate category aggregation, conflicting Edge IDs and incomplete weights. The sample contains hints and native slicer/detail-table interaction checks.

Native and submission test evidence: [UNRESOLVED APPROVED EVIDENCE REFERENCE]
Known limitations: bounded loaded topology (5,000 delivered rows, 250 entities, 1,000 relationships); selection actions capped at 200 complete identities; no segmented data loading, causal inference or fraud determination.

Private source access: [AUTHORIZED OWNER TO PROVIDE CURRENT MICROSOFT-REQUESTED ACCESS DETAILS THROUGH THE APPROVED SECURE CHANNEL; NO SECRETS IN THIS DOCUMENT]
```

## Approval ledger

All items below remain unresolved unless the coordinator supplies dated authoritative evidence:

- [ ] Partner Center enrollment, legal publisher identity and authorized submission operator.
- [ ] Offer ID/name reservation and trademark/content/media rights.
- [x] Owner commercial decision: paid using existing Atlyn subscriptions.
- [ ] Agreed entitlement architecture, exact storefront option, enforcement, and paid-feature disclosures.
- [ ] EULA/Standard Contract approval and any irrevocable acceptance.
- [ ] Valid approved privacy-policy URL and legal review of actual processing/support practices.
- [ ] Support owner, monitored address, escalation and service commitments.
- [ ] Markets, industry claims, localization and commercial/tax requirements.
- [ ] Final accurate logo/screenshots; mock/native evidence distinction.
- [ ] Full native/submission testing, offline PBIX and same-package content proof.
- [ ] Exact-source certification branch, API/tools requirement reconciliation and secure reviewer access.
- [ ] Explicit approval to submit; separate approval to publish. Neither is granted here.
