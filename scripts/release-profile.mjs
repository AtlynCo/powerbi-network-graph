import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createBrowserHarness, releaseFixtures, HOST_DISCLAIMER } from "./browser-harness.mjs";
import { digest, root, writeReport } from "./artifact.mjs";

const harness = await createBrowserHarness();
const { page, artifact } = harness;
const report = { artifact: artifact.filename, sha256: artifact.sha256, host: HOST_DISCLAIMER, passed: false };
try {
    assert(!artifact.historical, "Profiling requires the current source-matched package");
    await harness.mount({ width: 1366, height: 768 });
    const session = await page.context().newCDPSession(page);
    await session.send("Profiler.enable");
    await session.send("Profiler.setSamplingInterval", { interval: 1000 });
    await session.send("Performance.enable");
    report.heapBefore = await session.send("Runtime.getHeapUsage");
    await session.send("Profiler.start");
    const maximum = releaseFixtures().maximum;
    for (let iteration = 0; iteration < 5; iteration++) {
        await harness.update([], { edgeIds: true });
        await harness.update(maximum, { edgeIds: true });
        await page.locator('[data-control="entity"]').selectOption("s:N000");
        await page.locator('[data-action="reset-focus"]').click();
        await page.locator('[data-action="relationships"]').click();
        await page.locator('[data-action="select-edge"]').first().click();
        await page.locator('[data-action="clear-selection"]').click();
    }
    const { profile } = await session.send("Profiler.stop");
    report.heapAfterActions = await session.send("Runtime.getHeapUsage");
    report.metrics = await session.send("Performance.getMetrics");
    await page.evaluate(() => window.fixture.visual.destroy());
    report.heapAfterDestroy = await session.send("Runtime.getHeapUsage");
    const bytes = Buffer.from(JSON.stringify(profile));
    await writeFile(path.join(root, "dist", "release-maximum.cpuprofile"), bytes);
    Object.assign(report, {
        browser: await harness.browser.version(), protocol: "Chromium DevTools Profiler, 1000us sampling interval",
        workload: "Five 250-node/1000-edge/5000-row topology rebuilds, neighborhood/reset and mock relationship select/clear cycles",
        profile: { filename: "release-maximum.cpuprofile", sha256: digest(bytes), bytes: bytes.length, samples: profile.samples?.length ?? 0, nodes: profile.nodes.length },
        limitations: "DevTools sampling includes browser/automation scheduling. Heap is the whole mock page, not isolated visual retained memory; no forced collection or leak-freedom claim. Not the percentile benchmark or native host proof.",
        errors: harness.errors, runtimeRequests: harness.requests
    });
    assert(report.profile.samples > 0 && profile.nodes.length > 1);
    assert.deepEqual(harness.errors, []);
    assert.deepEqual(harness.requests, []);
    report.passed = true;
    console.log(`Captured actual-package DevTools CPU profile: ${report.profile.samples} samples, ${report.profile.nodes} call-frame nodes.`);
} finally {
    await writeReport("release-profile.json", report);
    await harness.close();
}
