# Historical pre-fix candidate observations

**Historical snapshot only.** All "current" and "blocker" language below describes the earlier `7ba7a015...` candidate. The tooltip teardown bug is fixed in the sealed package; [RESULTS.md](RESULTS.md) contains the authoritative new package, measurements, media and remaining gates.

## Status and scope

These are **frozen v1.0.0.0 and current v1.1.0.0 candidate observations, not
final-release evidence**. The measured candidate passed strict package/source
contract checks, and its recorded build-input hashes matched every build input
at that baseline. Only the frozen v1 archive required historical-archive mode. Final
measurements/screenshots remain gated on the owner's explicit final freeze.

**Current release blocker:** the rebuilt candidate passes source/build-input
matching, but the expanded 21-group browser run has **20 passing groups and one
failure**: an extra uncaught tooltip-hide exception escapes focused-row
destruction. Thirty independent source tests and all 17 legacy browser groups
pass. Do not present this as a passing release gate or freeze the screenshots.
The requested Services/Accounts screenshot inputs are now wired to the actual
sample contract, with two more independently audited source cases passing
(32 total). Its additional browser group/captures await the fixed package;
the prior 21-group result must not be presented as a 22-group run.

### Reproduced tooltip-destroy blocker

On SHA `7ba7a015…`, mount the accounts fixture, open Relationships, focus a
relationship row, make the mock host's `tooltipService.hide()` throw, and call
`visual.destroy()` inside a try/catch. The explicit cleanup error is caught and
the root is removed, but `hide()` is called twice and Chromium emits a second
uncaught page error:

```text
Error: Injected tooltip hide failure
    at Object.hide
    at Visual.hideTooltip
    at HTMLButtonElement.<anonymous>
    at Visual.destroy
```

The relationship-row blur handler at `src/visual.ts:649` calls `hideTooltip()`
without a destroyed guard. Removing the focused root at line 1054 triggers that
handler after `destroyed` has become true. DOM event-handler exceptions do not
propagate into the caller's surrounding destroy try/catch. Event-driven tooltip
handlers should not issue additional host calls after destruction; the explicit
destroy cleanup error should still propagate as required by the contract.

`dist/release-browser-results.json` now records the failing named group,
matching artifact/SHA, and browser stack detail. The global error gate is not
suppressed or reclassified as an expected error merely because it was injected.

The frozen v1.0 archive was subsequently provided under `.tmp\baseline-v1`;
the following freshly paired measurements supersede the earlier cached
candidate (`2db38cac…`) and initial incident-focus experiment. Both use
**protocol version 2**, identical fixture
SHA-256 values, the common neighborhood action, and selection on full topology.

| Archive | SHA-256 | Measurement interval, UTC |
|---|---|---|
| `AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.0.0.0.pbiviz` | `249d315a6db0e928a10e3fc3aa90b3307f484e08b47e30dffa126221ec4cdacc` | 2026-09-09 22:41:48–22:42:47 |
| `AtlynNetworkAB24C68297094C32AF64D50D92C01711.1.1.0.0.pbiviz` | `7ba7a015af4dc62e79024a987c1b11c6caa9ce7ad3a345c4a4ad68bebcd0a7bc` | 2026-09-09 22:42:49–22:43:27 |

* Windows `10.0.26200`, x64; Node `v24.17.0`; Chromium `145.0.7632.6`.
* AMD EPYC 7763; 16 logical CPUs exposed to this machine.
* RAM: 68,665,831,424 bytes total; free RAM before each run was
  39,071,625,216 bytes (v1.0) and 39,207,845,888 bytes (candidate).
* Shared-machine aggregate CPU busy: **24.4% v1.0 / 38.3% candidate**.
  Relevant process snapshots included 7→8 Chrome, 20 Edge, 12 Copilot,
  4→1 Node, 1 Power BI Desktop, and 1 Analysis Services process.
  These applications were observed by process metadata only, not controlled
  or used as native-host evidence.
* Each run was serialized in one headless Chromium page, with 5 warmups and
  30 retained samples for each of eight fixture/operation pairs: 240 samples
  per archive, 480 retained samples in the paired comparison.

Contention varied and was not controlled. A worktree-local benchmark lock
does not isolate other visual/editor sessions or emulate Power BI's scheduler.
The two archives were measured sequentially, not simultaneously. These are
observations on one shared machine, **not causal attribution, a native-host
performance guarantee, or a competitor comparison**.

## Browser/mock-host wall-clock timings

Milliseconds, rounded to one decimal. Each cell is **p50 / p95 / max**, with
30 samples. Values include action processing, mock-selection settlement when
applicable, and two browser paint opportunities. They are **not native Power BI
selection or rendering latency**.

| Fixture | Operation | Frozen v1.0 | Current v1.1 candidate |
|---|---|---:|---:|
| Typical 7 / 10 / 10 | Topology-cold render | 33.1 / 34.1 / 35.0 | 33.0 / 34.1 / 34.1 |
| Typical | Data update | 33.9 / 34.9 / 35.0 | 33.0 / 35.0 / 35.1 |
| Typical | Local neighborhood focus | 33.1 / 34.1 / 34.9 | 33.9 / 35.0 / 35.0 |
| Typical | Relationship selection, mock host | 50.0 / 51.0 / 51.1 | 50.0 / 51.0 / 51.1 |
| Maximum 250 / 1000 / 5000 | Topology-cold render | 348.9 / 366.2 / 369.9 | 249.9 / 296.2 / 316.9 |
| Maximum | Data update | 250.2 / 287.2 / 315.9 | 84.1 / 103.0 / 104.6 |
| Maximum | Local neighborhood focus | 33.0 / 35.4 / 38.5 | 33.4 / 36.2 / 37.1 |
| Maximum | Relationship selection, mock host | 195.8 / 212.8 / 218.0 | 66.1 / 68.1 / 69.4 |

Candidate maximum render/update/selection observations were lower, but its
maximum neighborhood p95 was slightly higher. The small typical end-to-end
differences are dominated by browser frame scheduling. Do not convert these
observations into a blanket claim that every action is faster.

### Synchronous action timings, separate from the table above

Milliseconds, **p50 / p95 / max**, 30 samples per cell.

| Fixture | Operation | Frozen v1.0 | Current v1.1 candidate |
|---|---|---:|---:|
| Typical | Topology-cold render | 3.2 / 5.0 / 5.5 | 4.1 / 5.9 / 6.2 |
| Typical | Data update | 2.5 / 3.7 / 4.5 | 4.2 / 5.6 / 6.1 |
| Typical | Local neighborhood focus | 2.7 / 3.8 / 4.8 | 5.1 / 7.2 / 7.4 |
| Typical | Selection click handler only | 0.1 / 0.2 / 0.2 | 0.1 / 0.2 / 0.2 |
| Maximum | Topology-cold render | 320.3 / 337.3 / 347.6 | 225.1 / 258.8 / 288.5 |
| Maximum | Data update | 230.3 / 260.0 / 292.8 | 70.4 / 73.7 / 86.6 |
| Maximum | Local neighborhood focus | 10.3 / 15.4 / 23.9 | 9.1 / 13.6 / 13.9 |
| Maximum | Selection click handler only | 0.1 / 0.2 / 0.5 | 0.1 / 0.2 / 0.5 |

The very short synchronous selection number is only event enqueue/handler
return. Asynchronous host action and resulting visual styling are included in
the first table. It must not be quoted as complete selection latency.

All sixteen p95 observations were inside the explicit engineering budgets in
`METHODOLOGY.md`. The initial candidate timing implementation was corrected to
restore the **full graph** before selection. Protocol 2 also uses the common
neighborhood action and rejects changed fixture/protocol comparisons; only the
paired protocol-2 measurements above should be compared.

## Functional observations

* 32 new independent source tests passed: input-driven distance-matrix and
  hand-audited topology oracles, simultaneous data limits, concentrated routing,
  minimum node spacing, saved-view boundary cases, exact compensated-sum
  expectations, edge-ID path ties, nonfabricated tooltip-highlight weights,
  and the exact Services/Accounts literal sample contracts.
* The original 18-group run passed. The expanded current run passes the
  additional typed-label and help/toolbar groups, but fails the new tooltip
  destruction group described above. Passing coverage includes
  normal and maximum fixtures at all five exact tile sizes, every
  entity/relationship pagination page, true
  mouse/wheel/touch input, isolated concurrent instances, state replay, rejected
  promises, empty/error/destroy, high contrast, RTL, and reduced motion.
  The path/incident group explicitly verifies hidden incident row identities
  remain selected and context menus never substitute an arbitrary aggregate row.
* The retained legacy compiled-package suite also passed all 17 groups on this
  same current candidate. Its refusal checks now use real keyboard activation:
  Playwright correctly refuses a normal mouse click on `aria-disabled` controls,
  while focused activation exercises the explicit explanation/no-native-action
  path without bypassing accessibility state.
* Actual mixed maximum topology retained all 250 entity IDs / 1000 edge IDs.
  Three separate 1000-edge concentration fixtures retained 1000 distinct finite
  nonhidden paths each. No geometry-level route cap was observed.
* No attempted runtime resource requests were observed. The new focused-destroy
  scenario produces the one uncaught browser error described above.
* Four refreshed preliminary screenshots are banner-labelled compiled-package
  mock-host renders, each verified as PNG **1366×768**. Encoded sizes are
  60,911 bytes (cyclic workflow), 393,176 (dense overview), 85,936 (dense
  neighborhood), and 63,620 (reciprocal accounts), all below 1024 KB.
  These are not a final screenshot freeze while the browser gate fails.
  In the normal workflow image, Review and Deploy labels cross relationship
  strokes. Label/label collision checks passed; edge-stroke avoidance is a
  separate remaining visual limitation.

Raw JSON (`dist/release-benchmark-baseline-v1-current-pair.json`,
`dist/release-benchmark-candidate-current.json`) and preliminary screenshots remain
ignored under `dist/`; they are not checked-in publication/submission assets.
Final checked-package execution, final screenshots, and native-host/manual
release gates remain open until the package owner completes the final baseline.
