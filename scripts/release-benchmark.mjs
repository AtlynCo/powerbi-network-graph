import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { open, readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createBrowserHarness, HOST_DISCLAIMER, releaseFixtures } from "./browser-harness.mjs";
import { digest, root, writeReport } from "./artifact.mjs";

const argument = (key, fallback) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const samples = Number(argument("samples", "30"));
const warmup = Number(argument("warmup", "5"));
const tag = argument("tag", "final");
assert(Number.isInteger(samples) && samples >= 30, "At least 30 measured samples are required");
assert(Number.isInteger(warmup) && warmup >= 3, "At least 3 warmup samples are required");
assert(/^[a-z0-9-]+$/i.test(tag), "Use a filename-safe evidence tag");
const lockPath = path.join(root, "dist", ".release-benchmark.lock");
const lock = await open(lockPath, "wx");
await lock.writeFile(JSON.stringify({ pid: process.pid, started: new Date().toISOString() }));
let harness;
const cpu = () => os.cpus().map(core => ({ ...core.times }));
const processSnapshot = () => {
    if (process.platform !== "win32") return { unavailable: "Process context probe is Windows-specific", loadAverage: os.loadavg() };
    try {
        const result = execFileSync("powershell.exe", ["-NoProfile", "-Command",
            "Get-Process | Where-Object { $_.ProcessName -match '^(node|chrome|chromium|msedge|PBIDesktop|msmdsrv|Copilot|Code)$' } | Select-Object Id,ProcessName,CPU,WorkingSet64 | ConvertTo-Json -Compress"],
        { encoding: "utf8", windowsHide: true, timeout: 15000 });
        return JSON.parse(result || "[]");
    } catch (error) { return { unavailable: String(error) }; }
};
const summarize = values => {
    const sorted = [...values].sort((a, b) => a - b);
    const percentile = p => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
    return { n: sorted.length, p50: percentile(0.5), p95: percentile(0.95), max: sorted.at(-1), min: sorted[0] };
};
const budgets = {
    typical: { "cold-render": 400, "data-update": 250, "local-neighborhood-focus": 150, "relationship-selection-hostmock": 250 },
    maximum: { "cold-render": 1500, "data-update": 1000, "local-neighborhood-focus": 350, "relationship-selection-hostmock": 750 }
};
const report = {
    artifact: null, sha256: null,
    protocolVersion: 2, host: HOST_DISCLAIMER, started: new Date().toISOString(), tag, samples, warmup,
    clock: "Browser performance.now(): synchronous action plus mock-host completion and two requestAnimationFrame opportunities; no Node/Playwright transport included",
    methodology: {
        serial: "One browser/page and one operation at a time; exclusive worktree benchmark lock. Does not claim machine-wide process isolation.",
        fixtureConstruction: "Categorical DataView construction and reset/clear excluded from timed region; cold-render uses an empty topology first, not a cold browser/JIT",
        localNavigation: "Entity change followed by explicit neighbors-mode change, supported identically in v1.0 and v1.1; not the new incident-only mode.",
        selection: "DOM click dispatch enters the packaged event handler; awaits actual mock API promise settlement and two frames. This is NOT native Power BI selection latency.",
        paint: "Two rAF callbacks provide a browser paint opportunity, not proof of native host export readiness or completed GPU presentation.",
        percentile: "Nearest rank ceil(p*n), raw samples retained; no outlier removal",
        random: "Fixed topology, seeded LCG Fisher-Yates row permutation, seed=0xA71A2026, multiplier=1664525, increment=1013904223, modulus=2^32",
        budgetBasis: "Predeclared engineering p95 wall-clock responsiveness targets: sub-400ms typical first render and <=1.5s maximum first render; tighter repeated/local-action budgets. Not a Power BI limit or competitor comparison.",
        contention: "Other editor/visual/browser sessions may be active on this shared machine. Relevant process CPU counters and aggregate CPU busy delta recorded before/after; Windows os.loadavg is not a useful load signal."
    },
    machine: { hostname: os.hostname(), platform: os.platform(), release: os.release(), architecture: os.arch(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, ramBytes: os.totalmem(), freeRamBefore: os.freemem(), node: process.version },
    budgetsP95EndToEndMs: budgets, results: [], passed: false
};
try {
    harness = await createBrowserHarness();
    const { page, artifact } = harness;
    if (tag === "final") assert(!artifact.historical, "Final benchmark must use strict current artifact/source validation; unset BROWSER_ARTIFACT");
    Object.assign(report, {
        artifact: artifact.filename, sha256: artifact.sha256, version: artifact.config.visual.version,
        currentSourceValidated: !artifact.historical, buildInputSha256: artifact.buildInputSha256
    });
    report.machine.browser = await harness.browser.version();
    report.processesBefore = processSnapshot();
    const cpuBefore = cpu();
    const fixtures = releaseFixtures();
    for (const fixtureName of ["typical", "maximum"]) {
        let seed = 0xA71A2026;
        const rows = [...fixtures[fixtureName]];
        for (let i = rows.length - 1; i > 0; i--) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const j = Math.floor(seed / 4294967296 * (i + 1));
            [rows[i], rows[j]] = [rows[j], rows[i]];
        }
        await harness.mount({ width: 1366, height: 768 });
        await harness.update(rows, { edgeIds: true });
        await page.evaluate(({ rows, focus }) => {
            window.benchmarkView = window.fixture.createView(rows, { edgeIds: true });
            window.benchmarkFocus = focus;
        }, { rows, focus: fixtureName === "maximum" ? "s:N000" : "s:Review" });
        for (const operation of ["cold-render", "data-update", "local-neighborhood-focus", "relationship-selection-hostmock"]) {
            await page.locator('[data-action="reset-focus"]').click();
            const values = await page.evaluate(async ({ operation, samples, warmup }) => {
                const state = window.fixture;
                const frame = () => new Promise(resolve => window.requestAnimationFrame(resolve));
                const paint = async () => { await frame(); await frame(); };
                const click = action => state.container.querySelector(`[data-action="${action}"]`).click();
                const results = [];
                for (let sample = -warmup; sample < samples; sample++) {
                    if (operation === "cold-render") state.update([], { edgeIds: true });
                    if (operation === "local-neighborhood-focus") click("reset-focus");
                    if (operation === "relationship-selection-hostmock") {
                        click("relationships");
                        state.setHostSelection([]);
                    }
                    await paint();
                    const before = state.calls.settled;
                    const started = window.performance.now();
                    if (operation === "cold-render" || operation === "data-update") {
                        state.view = window.benchmarkView;
                        state.visual.update({ dataViews: [state.view], viewport: { width: 1366, height: 768 }, type: 2 });
                    } else if (operation === "local-neighborhood-focus") {
                        const entity = state.container.querySelector('[data-control="entity"]');
                        entity.value = window.benchmarkFocus;
                        entity.dispatchEvent(new window.Event("change", { bubbles: true }));
                        const mode = state.container.querySelector('[data-control="focus-mode"]');
                        mode.value = "neighbors";
                        if (mode.value !== "neighbors") throw new Error("The archive does not support the common neighborhood navigation contract");
                        mode.dispatchEvent(new window.Event("change", { bubbles: true }));
                    } else click("select-edge");
                    const synchronousMs = window.performance.now() - started;
                    if (operation === "relationship-selection-hostmock") {
                        let frames = 0;
                        while (state.calls.settled <= before) {
                            if (++frames > 180) throw new Error("Selection did not settle");
                            await frame();
                        }
                    }
                    await paint();
                    if (state.calls.lifecycle.at(-1) !== "finished") throw new Error("Benchmark rendered an error state");
                    if (sample >= 0) results.push({ synchronousMs, endToEndMs: window.performance.now() - started });
                }
                return results;
            }, { operation, samples, warmup });
            const visibleTopology = await page.locator("#visual").evaluate(element => ({
                nodes: element.querySelectorAll(".network-node").length,
                edges: element.querySelectorAll(".network-edge").length
            }));
            const expectedTopology = operation === "local-neighborhood-focus" ?
                (fixtureName === "maximum" ? { nodes: 3, edges: 9 } : { nodes: 4, edges: 6 }) :
                (fixtureName === "maximum" ? { nodes: 250, edges: 1000 } : { nodes: 7, edges: 10 });
            assert.deepEqual(visibleTopology, expectedTopology, "Timed operation ended on the wrong topology");
            const result = {
                fixture: fixtureName, rows: rows.length, fixtureSha256: digest(JSON.stringify(rows)), operation, visibleTopology,
                synchronousMs: summarize(values.map(value => value.synchronousMs)),
                endToEndMs: summarize(values.map(value => value.endToEndMs)),
                budgetP95Ms: budgets[fixtureName][operation], values
            };
            result.withinBudget = result.endToEndMs.p95 <= result.budgetP95Ms;
            report.results.push(result);
            console.log(`${fixtureName} ${operation}: p50 ${result.endToEndMs.p50.toFixed(1)} / p95 ${result.endToEndMs.p95.toFixed(1)} / max ${result.endToEndMs.max.toFixed(1)} ms (${samples} samples, ${result.withinBudget ? "within" : "OVER"} budget)`);
            await writeReport(`release-benchmark-${tag}.json`, report);
        }
    }
    const cpuAfter = cpu();
    const total = values => Object.values(values).reduce((sum, value) => sum + value, 0);
    const elapsed = cpuAfter.reduce((sum, core, i) => sum + total(core) - total(cpuBefore[i]), 0);
    const idle = cpuAfter.reduce((sum, core, i) => sum + core.idle - cpuBefore[i].idle, 0);
    report.aggregateCpuBusyPercent = elapsed ? (elapsed - idle) / elapsed * 100 : null;
    report.processesAfter = processSnapshot();
    report.machine.freeRamAfter = os.freemem();
    report.runtimeRequests = harness.requests;
    report.browserErrors = harness.errors;
    const baselinePath = argument("baseline", "");
    if (baselinePath) {
        const resolved = path.resolve(baselinePath);
        assert(!path.relative(root, resolved).startsWith(".."), "Baseline must be inside this worktree");
        const baseline = JSON.parse(await readFile(resolved, "utf8"));
        assert.equal(baseline.protocolVersion, report.protocolVersion, "Baseline protocol differs; regenerate using the same operation definitions");
        report.comparison = {
            artifact: typeof baseline.artifact === "string" ? baseline.artifact : baseline.artifact.filename,
            sha256: baseline.sha256 ?? baseline.artifact.sha256,
            warning: "Local observations on a shared machine, not controlled native-host or competitive measurements",
            results: report.results.map(result => {
                const previous = baseline.results.find(item => item.fixture === result.fixture && item.operation === result.operation);
                assert(previous?.fixtureSha256 === result.fixtureSha256, "Baseline fixture differs");
                return { fixture: result.fixture, operation: result.operation, p95BeforeMs: previous.endToEndMs.p95, p95AfterMs: result.endToEndMs.p95, ratio: result.endToEndMs.p95 / previous.endToEndMs.p95 };
            })
        };
    }
    report.passed = report.results.every(result => result.withinBudget) && !harness.requests.length && !harness.errors.length;
    if (!report.passed) process.exitCode = 1;
} catch (error) {
    report.error = String(error);
    process.exitCode = 1;
    console.error(error);
} finally {
    report.finished = new Date().toISOString();
    await writeReport(`release-benchmark-${tag}.json`, report);
    await harness?.close();
    await lock.close();
    await unlink(lockPath);
}
