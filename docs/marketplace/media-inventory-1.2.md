# Atlyn Network 1.2 listing-media review

**Prepared 2026-09-25. Owner approved exactly the native Circular/Radial pair
after viewing them; nothing uploaded.** Services/Accounts and mock-host
media are not approved by this decision.
All paths are relative to this isolated worktree. The existing logo is
`assets\logo-300.png`: PNG, **300x300**, **4,392 bytes**.

## Genuine native candidates

These are actual **Power BI Desktop 2.157.1354.0** report-canvas captures from
a new-process cold reopen of the verified 1.2 PBIX, without refresh. The
originals exclude the account header and contain only the synthetic sample.
No private report/account data was inserted into the public-facing candidates.

`scripts\prepare-native-media.ps1` proportionally fits each entire original
canvas below a 44px explanatory banner, with white letterboxing. It does not
crop, distort, retouch, remove diagnostics, or fabricate Desktop chrome.
Original captures and their hashes are retained; provenance:
`dist\listing-native-1.2\provenance.json`.

| Native candidate | Dimensions | Bytes | Assessment |
| --- | --- | ---: | --- |
| `dist\listing-native-1.2\circular.png` | 1366x768 PNG | 274,853 | Owner-approved and selected: clear native Circular example and explanatory guide |
| `dist\listing-native-1.2\radial.png` | 1366x768 PNG | 272,502 | Owner-approved and selected: genuine restored Orders center and separate components; small diagram, readable controls/guide |
| `dist\listing-native-1.2\services.png` | 1366x768 PNG | 213,153 | Additional candidate; full-page report heading is clipped in the original native textbox, so not recommended without owner review |
| `dist\listing-native-1.2\accounts.png` | 1366x768 PNG | 241,444 | Additional candidate; original report-heading clipping and intentional data-quality diagnostics remain visible |

**Approved listing choice:** the two native Circular/Radial images, which
meet the permitted **1-5 image** count and the product-specific dimension/size
rules. The owner expressly approved this pair on 2026-09-25 after side-panel
review. Receipt: `dist\listing-native-1.2\owner-approval.json`; committed
selection: `docs\marketplace\approved-handoff-1.2.json`.

| Approved file | Bytes | SHA-256 |
| --- | ---: | --- |
| `dist\listing-native-1.2\circular.png` | 274,853 | `c0019937ad83ae93882f2f26032ad8954f40b13f1fb496275e6ca680814bda7d` |
| `dist\listing-native-1.2\radial.png` | 272,502 | `3b738e79e6c048a7c447ef39f96f1cc0019e6ae7e0676de789886576e185ed90` |

The other two native
captures are honest evidence but need presentation review; their defects were
not edited out and the approved PBIX was not resaved to change them.
If a better full-report layout is desired, it requires a separately authorized
new sample save and revalidation, not modifying this verified binary silently.

The native PBIX is
`dist\native-prepublish\AtlynNetwork-1.2.0.0-native.pbix`,
SHA-256 `9248f79d195ec76fe61f278911a79cbb333f50a12bec17a3ab8130419e325ab7`.
Its embedded visual matches PBIVIZ SHA-256
`6136c82c28ecf597634cbb90685f9cb1fbc3c435ce64613a8be180e8ff0f00ff`.
All native images are below **1,024,000 bytes**. The banner identifies native
render evidence, **not Microsoft certification**.

## Existing five mock-host candidates

These remain **offline Chromium / mocked Power BI host** captures. They are
not native screenshots, even though they use the same actual PBIVIZ.
Their existing explicit labels and original files have not been changed.

| Mock-host candidate | Dimensions | Bytes |
| --- | --- | ---: |
| `dist\release-screenshots\services.png` | 1366x768 PNG | 66,560 |
| `dist\release-screenshots\accounts.png` | 1366x768 PNG | 93,817 |
| `dist\release-screenshots\circular.png` | 1366x768 PNG | 104,904 |
| `dist\release-screenshots\radial.png` | 1366x768 PNG | 68,818 |
| `dist\release-screenshots\dense-overview.png` | 1366x768 PNG | 393,387 |

A mixed set must keep the per-image native/mock distinction and stay within
five images. Do not imply the mock dense graph was captured in Desktop.
Frozen 1.1 images under `docs\marketplace\media` are historical and are not
proposed as current-version listing media.

## Approval and format boundary

The direct [Power BI offer-listing page](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-offer-listing)
and [Power BI publishing page](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store)
specify 1366x768 PNG, at most 1024 KB, with explanatory feature callouts.
The broader overview conflicts at 1280x720; confirm the actual portal validator
before upload. Passing file checks alone does not establish branding/media rights or
accessibility approval; the specific owner acceptance above is separately
recorded. Neither establishes submission or publication.

The native/mock PNGs and PBIX live under ignored `dist`, outside the submitted
source tree. Source commits contain only the relevant generator, inventory and
receipts in documentation, not account screenshots or native binary files.
