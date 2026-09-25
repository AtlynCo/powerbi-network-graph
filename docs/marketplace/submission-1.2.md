# Atlyn Network 1.2 submission material draft

**Prepared 2026-09-24; owner privacy/EULA/support decisions recorded 2026-09-25. Local handoff
only; not entered into Partner Center, submitted for certification or
published.** The approved URLs and monitored contact below do not approve
other portal decisions or publication, or imply an unapproved response-time SLA. This replaces
the historical 1.1 draft for candidate preparation without rewriting it.
Use the current [prepublication evidence](../validation/PREPUBLISH-1.2.md)
and [October runbook](october-2026-handoff.md) for remaining gates.

## Listing fields

**Name** (owner must confirm reservation/rights):

```text
Atlyn Network
```

**Summary** (maximum 100 characters):

```text
Explore directed relationships with Force, Circular and Radial layouts and accessible lists.
```

**Description** (maximum 3,000 characters):

```text
Atlyn Network helps report authors and readers explore directed relationships supplied by a Power BI semantic model.

Bind Source ID and Target ID, then add optional Weight, Relationship type, Edge ID and tooltip measures. Preserve cycles, reciprocal links, parallel relationships, self-loops and disconnected components without forcing the network into a tree.

Choose Force, Circular or Radial. Force retains a deterministic component-aware arrangement. Circular places all loaded endpoints on one circle in stable ID order. Radial groups each connected component into rings by minimum undirected hop distance around an automatic or selected center. Arrows retain their original direction; weights do not change hop distance. Center choice is a layout convenience, not a centrality score or business-importance ranking.

Search loaded entities, inspect incident relationships, follow upstream or downstream reachability, or inspect one shortest directed path. Pan, zoom, fit and switch between graph and paginated entity/relationship lists. Dense paths and labels may overlap; the lists retain exact relationship details.

Keep local exploration separate from report selection. Changing layout, center or local focus does not filter the model. Selecting an entity selects its loaded incident relationship identities, not an independent entity dimension. Save local view explicitly records exploration state.

English and Arabic interface resources, RTL layout, host high-contrast styling and keyboard-accessible lists are included. The visual package contains no external runtime requests, telemetry, sign-in, license keys or remote assets.

Acquisition and author use follow Atlyn's existing all-access customer terms. Active paid or trial subscriptions authorize author use; shared-report viewers need no separate Atlyn subscription under those terms. Installed packages are technically ungated and do not enforce identity or subscription expiry. Power BI licensing, tenant policies and report security still apply.

The visual processes up to 5,000 delivered rows and displays up to 250 endpoint entities and 1,000 relationships. Search, paths, counts and hop rings describe loaded data only. Host filtering and data reduction can omit other relationships. This is not causal-impact prediction, fraud detection, process mining or whole-network analysis.

Support: https://atlynco.github.io/atlyn-powerbi-support/docs/faq/
```

**Search keywords** (three proposed fields):

```text
network graph
radial relationships
directed relationships
```

No certified badge, native platform guarantee, comparative superiority or
publication date is asserted. Do not describe the report as a downloadable
PBIX until its genuine current-version artifact and native evidence exist.

## Existing public links, not new legal terms

All links below returned HTTP 200 over HTTPS on 2026-09-24, and the pages
explicitly cover Atlyn Network. Receipt:
`dist/native-prepublish/public-url-verification.json`.

| Field | Existing URL | What remains |
| --- | --- | --- |
| Support | `https://atlynco.github.io/atlyn-powerbi-support/docs/faq/` | **Owner explicitly approved this Network support FAQ and confirmed `atlyn.help@gmail.com` is a monitored Marketplace support contact on 2026-09-25**, relayed by the coordinator. No response-time SLA is invented. |
| Privacy policy | `https://atlynco.github.io/atlyn-powerbi-support/legal/privacy/` | **Owner explicitly approved this URL for the Atlyn Network offer on 2026-09-25**, relayed by the coordinator. Not publication approval. The published policy distinguishes report-host processing from website/account/billing practices. |
| Publisher EULA: existing Atlyn terms | `https://atlynco.github.io/atlyn-powerbi-support/legal/terms/` | **Owner explicitly approved this existing URL as the publisher EULA option for the Network Marketplace offer on 2026-09-25**, relayed by the coordinator. It has not been entered or accepted in Partner Center. Confirm any required file/upload format before submission without changing the approved terms. |

The terms already describe active paid/trial author rights, free shared
viewing and technically ungated packages. This document records the owner's
selection; it does not revise the terms, accept irreversible portal terms, or
turn the repository's proprietary `LICENSE` into a customer EULA. The support
URL/contact approval is recorded separately from portal configuration.

## Media prepared for owner review

`assets/logo-300.png` is a 300x300 PNG, 4,392 bytes. The following current
package screenshots are 1366x768 PNGs under 1,024,000 bytes, with captions and
explicit offline Chromium/mock-host labels. Preserve those labels; they are
not native Power BI screenshots. Hash/dimension receipt:
`dist/native-prepublish/listing-assets.json`.

| Candidate under `dist/release-screenshots` | Proposed caption |
| --- | --- |
| `services.png` | Explore a directed service cycle, reciprocal links and a real self-loop. |
| `accounts.png` | Inspect text account IDs, parallel relationships and visible data-quality diagnostics. |
| `circular.png` | Place every loaded endpoint on one stable circle without changing edge direction. |
| `radial.png` | Explore undirected loaded-hop rings around a chosen center, with separate disconnected components. |
| `dense-overview.png` | Use visible density disclosures and complete lists for bounded dense networks. |

Owner must approve branding, accessibility, copy and which 1-5 images to use.
Confirm the live upload validator because Microsoft's broad overview and
product-specific pages disagree on image dimensions. New native evidence
captures, if present, are separate and must not be relabeled as these images.

## Technical and reviewer handoff

| Item | Verified candidate / gate |
| --- | --- |
| Visual | Atlyn Network, `1.2.0.0`, API `5.11.0` |
| GUID | `AtlynNetworkAB24C68297094C32AF64D50D92C01711` |
| PBIVIZ | `AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.2.0.0.pbiviz`, 153,889 bytes |
| PBIVIZ SHA-256 | `6136c82c28ecf597634cbb90685f9cb1fbc3c435ce64613a8be180e8ff0f00ff` |
| Native PBIX | Use only the version-matched native artifact and comparison receipt identified by `PREPUBLISH-1.2.md`; do not substitute the old 1.1 PBIX or rename source files. |
| Current source | Exact committed revision in `dist/release-manifest.json`; package build-input hashes must match. |
| Remote certification source | Still `c19276b2d53bc02853737377136973d6fc937242` (1.1.1.0), not the 1.2 source. Owner authorized an update only after final source/native/package verification; the missing verified PBIX keeps that prerequisite open. No update is performed yet. |
| Existing reviewer permission | GitHub API reports `pbicvsupport` has `read` permission on 2026-09-24. This is not proof Microsoft has accepted access or can complete its current secure review process. |
| Publisher/offer | Owner must confirm enrollment, legal identity, existing/new offer ID and rights. The proposed name `atlyn-network` is not evidence of a reserved offer. |

The `certification` branch must match the eventual submitted package and stay
frozen through that submission. Do not provide credentials or recovery codes
in source, this draft, local receipts or chat. Partner Center inputs,
certification requests, publication, Azure redemption and main-branch changes
are outside the current task. The specifically authorized certification-ref
update remains conditional on final verification.
