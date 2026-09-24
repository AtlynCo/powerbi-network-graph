# Offline relationship samples

All names, accounts, and values are synthetic. These examples demonstrate directed relationships, not real service-impact modeling or fraud detection.

| File | Purpose |
| --- | --- |
| `cyclic-services.csv` | Clean service-dependency example: cycles, reciprocal/parallel relationships, self-link, and disconnected component |
| `reciprocal-accounts.csv` | Text account codes with leading zeros, repeated and conflicting Edge IDs, zero/missing/negative weights |
| `LoadRelationships.pq` | Power Query M import from a local CSV path |
| `OfflineSamples.pq` | Self-contained literal Power Query tables for either sample; no path or network dependency |
| [`release/Network.pbip`](release/README.md) | Fully authored offline PBIP: Force Services/Accounts, hints, Circular and Radial pages, native detail tables/slicers, literal model tables, and exact embedded 1.2.0.0 candidate |

**The PBIP is authored and locally structure-validated; native opening and PBIX conversion remain Desktop gates.** Follow the [authored sample instructions](release/README.md), refresh its literal tables, inspect both bound graph pages, and save/reopen a genuine PBIX. No native opening, query execution, or PBIX is fabricated or claimed here. The alternative M/CSV recipes below remain useful for building your own report.

## Option A: self-contained offline query

1. Open Power BI Desktop and create a blank report.
2. Choose **Get data → Blank query**, then open **Advanced Editor** in Power Query.
3. Paste the complete contents of `OfflineSamples.pq`.
4. Set `Dataset` to `"cyclic-services"` or `"reciprocal-accounts"`.
5. Name the query **Relationships** and choose **Close & Apply**.

The query contains literal data, reads no file, and makes no network request. Its Power Query and subsequent native visual behavior still need verification in Desktop; repository text checks are not an M-engine execution.

## Option B: local CSV import

Either use **Get data → Text/CSV → Transform Data**, or paste `LoadRelationships.pq` into a blank query's Advanced Editor and change `CsvPath` to the actual absolute Windows path. Name the query **Relationships**.

If using the CSV wizard, remove/adjust any automatic **Changed Type** step **before it converts IDs to numbers**. Both endpoint columns and both grouping columns must remain **Text**. In particular, `0001` must not become `1`. Do not trim, clean, uppercase, or otherwise normalize IDs unless that is an intentional modeling decision.

| Column | Power Query type | Usage |
| --- | --- | --- |
| SourceID | Text | Source ID |
| TargetID | Text | Target ID |
| RelationshipType | Text | Relationship type |
| EdgeID | Text | Edge ID |
| Weight | Decimal number; blank permitted | Base column for Weight measure |
| DurationMs | Decimal number | Optional tooltip source |
| EventCount | Whole number | Optional tooltip source |

The file-based query is offline but **not portable**: it references a machine-specific local file. Service refresh may require an authorized gateway and data-source configuration; the custom visual neither performs that refresh nor requests a gateway. Use the literal query when a path-free demonstration is needed.

## Measures and field mapping

Create each DAX measure separately in the **Relationships** table. The examples use comma syntax; your model authoring locale may require a different argument separator.

```dax
Relationship Weight = SUM ( Relationships[Weight] )
```

Bind SourceID → **Source ID**, TargetID → **Target ID**, RelationshipType → **Relationship type**, EdgeID → **Edge ID**, and Relationship Weight → **Weight**. Leave the grouping columns unsummarized. Format Relationship Weight as a suitable number, for example `#,0.00`; the visual should use the model format.

Optional tooltip measures (bind any subset, maximum eight):

```dax
Sample Rows = COUNTROWS ( Relationships )
Sample Events = SUM ( Relationships[EventCount] )
Mean Duration ms = AVERAGE ( Relationships[DurationMs] )
Maximum Duration ms = MAX ( Relationships[DurationMs] )
Minimum Duration ms = MIN ( Relationships[DurationMs] )
Minimum Raw Weight = MIN ( Relationships[Weight] )
Maximum Raw Weight = MAX ( Relationships[Weight] )
Missing Weight Rows =
    COUNTROWS ( FILTER ( Relationships, ISBLANK ( Relationships[Weight] ) ) )
```

These are demonstration measures, not a recommendation to sum averages or distinct counts when the visual aggregates delivered rows. The visual discloses varying tooltip values rather than treating every tooltip measure as additive.

Add a native table visual containing endpoint/type/Edge ID columns and measures. Use it to inspect category grouping and test report selection via **Edit interactions**. A semantic-model row grouping can combine physical CSV rows before Atlyn Network receives them.

## Expected service example

With every row supplied and all four grouping fields bound:

- **8 loaded entities; 14 loaded relationships.**
- Cycle: Orders → Payments → Ledger → Orders.
- Reciprocal links: Gateway ↔ Orders, Orders ↔ Inventory, and Archive ↔ Backup.
- Two separate `calls` edges from Orders to Payments (`S02` and `S12`), plus different-type parallel links from Gateway to Orders.
- A genuine Orders → Orders `retries` loop.
- Archive/Backup is a separate connected component, not two isolated nodes.

Without Edge ID bound, `S02` and `S12` combine into one Orders → Payments `calls` relationship of weight **100**, yielding **13 loaded relationships**. The host may combine these rows before delivery; a visual-level duplicate notice is not guaranteed.

Starting at Orders, loaded downstream traversal reaches Payments, Ledger, Gateway, Inventory, and Alerts, as well as Orders itself; it does not reach Archive or Backup. This is loaded graph reachability, not a prediction of service impact.

## Expected account example

The CSV has **16 physical records**. With Edge ID and relationship type bound, all records supplied, and the measure above:

- **6 loaded entities; 13 loaded relationships.**
- `T01` repeats with the same endpoints/type and sums to **120**. Power BI can deliver it as one category group, so do not equate the physical record count with contributing delivered rows.
- `T05` remains a separate same-type parallel edge; `T06` is a separate `fee` relationship.
- `T-CONFLICT` names both `0007 → 0008` and `0008 → 0007`. Both conflicting occurrences must be omitted. Accounts `0007` and `0008` then disappear because no retained edge uses them.
- `T07` is a real `0003 → 0003` adjustment loop.
- `T11` has valid zero weight and remains present.
- `T12` has a missing weight; `T13` has negative weight. Both relationships remain present with incomplete/unavailable weight and neutral styling.
- The conflicting-ID diagnostics mean topology is known incomplete. Missing weight alone is incomplete measurement, not a reason to remove topology.

If Edge ID is unbound, conflict detection by Edge ID no longer applies: `0007 ↔ 0008` are two ordinary relationships. The three `0001 → 0002` transfer records combine to **150**, and the expected topology becomes **8 loaded entities; 14 loaded relationships**. This deliberate difference illustrates why binding a stable Edge ID changes the model contract.

For unweighted behavior, remove the Weight binding. Do not replace missing/negative weights with made-up ones. To try nonfinite or differently typed identifiers, use controlled DataView fixtures; CSV/model conversion may prevent those values from reaching the visual unchanged.

## Manual exploration recipe

1. Import an approved build of Atlyn Network through **Import a visual from a file**. Tenant policy may block uncertified visuals.
2. Bind the fields and compare the loaded counts above in an unfiltered sample report. If counts differ, inspect report filters, model grouping, host reduction, and diagnostics first.
3. Use the entity list to **Focus locally**. Compare neighborhood, loaded upstream, and loaded downstream modes; cycles must terminate.
4. Activate **Select loaded incident relationships** and inspect the native table. This selects relationship identities, not all records with a matching entity in an arbitrary model dimension.
5. Search for another entity while selection is active. Search must not change native selection. **Clear report selection** must not reset the camera or local focus.
6. Try Ctrl/Cmd selection and keyboard navigation. Inspect reciprocal/parallel curves and self-loop arrows; compare list descriptions and model-formatted weights.
7. Try high contrast, Arabic (`ar-SA`) RTL, reduced motion, and normal/tiny/large viewports.

These small samples do not exercise 5,000-row/250-node/1,000-edge caps, 200-identity refusal, or every native-host behavior. Follow the full [release checklist](../docs/RELEASE.md). Browser/mock checks do not prove native selection, report-page tooltip propagation, tenant policy, or PDF/PPT behavior.

## Save a genuine native sample

After importing, binding, and testing in Desktop:

1. Save an actual **PBIX**, or enable/use Desktop's **Power BI Project (PBIP)** save option if supported by that Desktop version.
2. Reopen the saved result and check the model, visual package, bindings, measures, layout, and selection again.
3. For a portable offline PBIP, use the literal query and verify that the project has no missing files, external dataset references, or local absolute data paths. Test a clean reopen before labeling it self-contained.
4. Keep the report private. Obtain separate authorization before committing native artifacts, sharing screenshots, deploying a service report, or publishing anything.

Desktop/service and PDF/PowerPoint export testing remain manual and must use the exact packaged visual. No native save, reopen, export, or publication outcome is claimed by these instructions.
