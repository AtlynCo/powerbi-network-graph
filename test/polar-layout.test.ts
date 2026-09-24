import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildGraph, InputRow } from "../src/graph";
import { Layout, layoutGraph, Point, resolveLayout } from "../src/layout";

const make = (rows: Omit<InputRow, "index">[]) => buildGraph(rows.map((row, index) => ({ ...row, index })), {
    weighted: true, edgeIds: true, hasHighlights: false, partial: false
});
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

// Independent SVG endpoint-arc conversion and curve flattening; never uses the production router.
function flatten(path: string): Point[] {
    const tokens = path.match(/[MLQCA]|[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)!;
    const points: Point[] = [];
    let at = { x: 0, y: 0 }, index = 0;
    const number = (): number => Number(tokens[index++]);
    const point = (): Point => ({ x: number(), y: number() });
    while (index < tokens.length) {
        const command = tokens[index++];
        if (command === "M" || command === "L") {
            const end = point();
            const steps = command === "M" ? 1 : Math.max(1, Math.ceil(distance(at, end) / 4));
            const start = at;
            for (let i = 1; i <= steps; i++) points.push({ x: start.x + (end.x - start.x) * i / steps, y: start.y + (end.y - start.y) * i / steps });
            at = end;
        } else if (command === "A") {
            const r = number();
            expect(number()).toBe(r);
            expect(number()).toBe(0);
            const large = number(), sweep = number(), end = point();
            const dx = (at.x - end.x) / 2, dy = (at.y - end.y) / 2;
            const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (r * r - dx * dx - dy * dy) / (dx * dx + dy * dy)));
            const center = { x: (at.x + end.x) / 2 + factor * dy, y: (at.y + end.y) / 2 - factor * dx };
            const startAngle = Math.atan2(at.y - center.y, at.x - center.x);
            let delta = Math.atan2(end.y - center.y, end.x - center.x) - startAngle;
            if (sweep && delta < 0) delta += Math.PI * 2;
            if (!sweep && delta > 0) delta -= Math.PI * 2;
            const steps = Math.max(1, Math.ceil(Math.abs(delta) * r / 4));
            for (let i = 1; i <= steps; i++) points.push({ x: center.x + r * Math.cos(startAngle + delta * i / steps), y: center.y + r * Math.sin(startAngle + delta * i / steps) });
            at = end;
        } else {
            expect(["Q", "C"]).toContain(command);
            const start = at, a = point(), b = point(), end = command === "C" ? point() : b;
            for (let i = 1; i <= 80; i++) {
                const t = i / 80, u = 1 - t;
                points.push(command === "C" ?
                    { x: u ** 3 * start.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t ** 3 * end.x, y: u ** 3 * start.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t ** 3 * end.y } :
                    { x: u * u * start.x + 2 * u * t * a.x + t * t * end.x, y: u * u * start.y + 2 * u * t * a.y + t * t * end.y });
            }
            at = end;
        }
    }
    return points;
}

function checkGeometry(graph: ReturnType<typeof make>, layout: Layout): void {
    expect(new Set(layout.positions.keys())).toEqual(new Set(graph.nodes.map(node => node.id)));
    expect(new Set(layout.routes.keys())).toEqual(new Set(graph.edges.map(edge => edge.id)));
    expect(new Set([...layout.routes.values()].map(route => route.path)).size).toBe(graph.edges.length);
    const points = [...layout.positions.values()];
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) expect(distance(points[i], points[j])).toBeGreaterThanOrEqual(72 - 1e-7);
    for (const edge of graph.edges) {
        const route = layout.routes.get(edge.id)!;
        expect(distance(route.controls[0], layout.positions.get(edge.source)!)).toBeCloseTo(15, 7);
        expect(distance(route.controls.at(-1)!, layout.positions.get(edge.target)!)).toBeCloseTo(21, 7);
        let minimum = Infinity;
        let inBounds = true;
        for (const point of flatten(route.path)) {
            inBounds &&= Number.isFinite(point.x) && Number.isFinite(point.y) &&
                point.x >= layout.bounds.x - 1e-6 && point.y >= layout.bounds.y - 1e-6 &&
                point.x <= layout.bounds.x + layout.bounds.width + 1e-6 && point.y <= layout.bounds.y + layout.bounds.height + 1e-6;
            for (const node of graph.nodes) if (node.id !== edge.source && node.id !== edge.target) {
                minimum = Math.min(minimum, distance(point, layout.positions.get(node.id)!));
            }
        }
        expect(inBounds).toBe(true);
        // Search glyph radius 18 + selected stroke 2.5 + hit-path half-width 7 = 27.5.
        expect(minimum).toBeGreaterThanOrEqual(27.9);
    }
}

describe("unchanged force geometry from c19276b", () => {
    it.each([
        [0, "4b3760c77304177edd7ed4a0bb7787df2b6a00da4e080f2a79c27bf1969e4e66"],
        [1, "07c4c9ff265bdc7f4182d732ef35fbf49b52e7010cf0a3c43f8933917916e9cf"],
        [7, "59bfb1e1ac013b9e070689f68b3d5bfb2e54e231f103f5fa1426dead8fdf0dca"],
        [250, "c74587553a871feb7532fd856744aa886fb5ab0248ec15b01cd5d0e70afbf4f0"]
    ] as const)("preserves default and explicit force output for %i nodes", (count, expected) => {
        const graph = make(Array.from({ length: count * 4 }, (_, i) => ({
            source: i % count, target: i % 4 === 0 ? i % count : (i + 1) % count,
            edgeId: `E${String(i).padStart(4, "0")}`, weight: i
        })));
        const result = layoutGraph(graph);
        expect(layoutGraph(graph, "force", "missing")).toEqual(result);
        const text = JSON.stringify({ positions: [...result.positions], routes: [...result.routes], bounds: result.bounds, signature: result.signature });
        expect(createHash("sha256").update(text).digest("hex")).toBe(expected);
    });

    describe("rooted radial geometry", () => {
        it.each([7, 41, 2026])("matches independent undirected all-pairs distances for every center (seed %i)", initial => {
            const count = 14;
            let seed = initial;
            const rows = Array.from({ length: count }, (_, i) => ({ source: i, target: i, edgeId: `L${i}`, weight: 1 }));
            const distances = Array.from({ length: count }, (_, i) => Array.from({ length: count }, (_, j) => i === j ? 0 : Infinity));
            for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                if (seed / 4294967296 < 0.13) {
                    distances[i][j] = distances[j][i] = 1;
                    rows.push({ source: j, target: i, edgeId: `${i}-${j}`, weight: seed });
                }
            }
            for (let k = 0; k < count; k++) for (let i = 0; i < count; i++) for (let j = 0; j < count; j++) {
                distances[i][j] = Math.min(distances[i][j], distances[i][k] + distances[k][j]);
            }
            const graph = make(rows);
            const before = JSON.stringify(graph);
            for (let root = 0; root < count; root++) {
                const layout = layoutGraph(graph, "radial", `n:${root}`);
                const levels = new Map<string, Map<number, number>>();
                for (const node of graph.nodes) {
                    const info = layout.polar!.get(node.id)!;
                    const componentRoot = Number(info.root.slice(2));
                    expect(info.depth).toBe(distances[componentRoot][Number(node.id.slice(2))]);
                    if (Number.isFinite(distances[root][Number(node.id.slice(2))])) expect(componentRoot).toBe(root);
                    expect(distance(layout.positions.get(node.id)!, info.center)).toBeCloseTo(info.radius, 7);
                    if (!levels.has(info.root)) levels.set(info.root, new Map());
                    const radii = levels.get(info.root)!;
                    if (radii.has(info.depth)) expect(info.radius).toBe(radii.get(info.depth));
                    radii.set(info.depth, info.radius);
                }
                for (const radii of levels.values()) for (const [depth, radius] of radii) {
                    if (depth) expect(radius - radii.get(depth - 1)!).toBeGreaterThanOrEqual(96 - 1e-7);
                }
                if (root === 0) checkGeometry(graph, layout);
            }
            expect(JSON.stringify(graph)).toBe(before);
        });

        it("re-layers a shortcut that formerly spanned multiple depths; no retained edge can skip a BFS ring", () => {
            const chain = Array.from({ length: 6 }, (_, i) => ({ source: i, target: i + 1, edgeId: `chain${i}`, weight: i }));
            expect(layoutGraph(make(chain), "radial", "n:0").polar!.get("n:5")!.depth).toBe(5);
            const graph = make([...chain, { source: 0, target: 5, edgeId: "shortcut", weight: 0 }, { source: 5, target: 0, edgeId: "reverse", weight: 100 }]);
            const layout = layoutGraph(graph, "radial", "n:0");
            expect(layout.polar!.get("n:5")!.depth).toBe(1);
            for (const edge of graph.edges) expect(Math.abs(layout.polar!.get(edge.source)!.depth - layout.polar!.get(edge.target)!.depth)).toBeLessThanOrEqual(1);
            checkGeometry(graph, layout);
        });

        it("routes diametral same-ring edges around the center and packs disconnected components separately", () => {
            const rows = [
                ...Array.from({ length: 8 }, (_, i) => ({ source: "root", target: `N${i}`, edgeId: `spoke${i}` })),
                ...Array.from({ length: 8 }, (_, i) => ({ source: `N${i}`, target: `N${(i + 4) % 8}`, edgeId: `diameter${i}` })),
                ...Array.from({ length: 8 }, (_, i) => ({ source: "root", target: "root", edgeId: `loop${i}` })),
                { source: "X", target: "Y", edgeId: "other" }, { source: "Z", target: "Z", edgeId: "isolated-loop" }
            ];
            const graph = make(rows);
            const layout = layoutGraph(graph, "radial", "s:root");
            expect(layout.roots).toEqual(["s:root", "s:X", "s:Z"]);
            checkGeometry(graph, layout);
            expect(layoutGraph(make([...rows].reverse()), "radial", "s:root")).toEqual(layout);
        });

        it("chooses largest component then distinct non-self degree then typed ID, never edge count or weight", () => {
            const rows = [
                { source: "B", target: "A", edgeId: "BA" }, { source: "B", target: "C", edgeId: "BC" },
                { source: "X", target: "Y", edgeId: "XY" },
                ...Array.from({ length: 20 }, (_, i) => ({ source: "A", target: i % 2 ? "A" : "B", edgeId: i, weight: 1e200 }))
            ];
            const graph = make(rows);
            expect(resolveLayout(graph, "radial").root).toBe("s:B");
            expect(resolveLayout(graph, "radial", "s:missing")).toEqual({ ...resolveLayout(graph, "radial"), missingRoot: true });
            expect(layoutGraph(graph, "radial", "s:Y").roots).toEqual(["s:B", "s:Y"]);
            const reappeared = make([...rows, { source: "missing", target: "B", edgeId: "back" }]);
            expect(resolveLayout(reappeared, "radial", "s:missing").root).toBe("s:missing");
        });

        it.each(["circular", "radial"] as const)("keeps every row and all 1,000 routes in %s mode", mode => {
            const rows = Array.from({ length: 1000 }, (_, i) => ({
                source: i % 250, target: i < 250 ? i % 250 : (i + 1) % 250, edgeId: `E${i}`
            }));
            const graph = make(Array.from({ length: 5 }, () => rows).flat());
            const before = JSON.stringify(graph);
            const layout = layoutGraph(graph, mode);
            expect(graph.nodes).toHaveLength(250);
            expect(graph.edges).toHaveLength(1000);
            expect(graph.edges.flatMap(edge => edge.rows)).toHaveLength(5000);
            checkGeometry(graph, layout);
            expect(JSON.stringify(graph)).toBe(before);
        }, 30000);

        it.each(["loop", "parallel", "reciprocal"])("preserves 1,000 distinct bounded %s routes", kind => {
            const graph = make(Array.from({ length: 1000 }, (_, i) => ({
                source: kind === "reciprocal" && i % 2 ? "B" : "A",
                target: kind === "loop" || (kind === "reciprocal" && i % 2) ? "A" : "B", edgeId: i
            })));
            for (const mode of ["circular", "radial"] as const) checkGeometry(graph, layoutGraph(graph, mode));
        }, 30000);
    });
});

describe("circular geometry", () => {
    it.each([0, 1, 2, 3, 12, 250])("places all %i nodes on one stable ring, including disconnected nodes", count => {
        const graph = make(Array.from({ length: count }, (_, i) => ({ source: i, target: i, edgeId: i })));
        const layout = layoutGraph(graph, "circular");
        const radii = [...layout.positions.values()].map(point => Math.hypot(point.x, point.y));
        for (const radius of radii) expect(radius).toBeCloseTo(radii[0], 7);
        if (count <= 12) checkGeometry(graph, layout);
        expect(layout.signature).toBe(resolveLayout(graph, "circular", "ignored").key);
    });
    it("routes skip-one, diametral, reciprocal, parallel and loop paths away from unrelated glyphs", () => {
        const rows = Array.from({ length: 36 }, (_, i) => ({
            source: `N${String(i % 12).padStart(2, "0")}`,
            target: `N${String((i + (i < 12 ? 2 : i < 24 ? 6 : 0)) % 12).padStart(2, "0")}`, edgeId: i
        }));
        const graph = make(rows);
        const layout = layoutGraph(graph, "circular");
        checkGeometry(graph, layout);
        const reordered = make([...rows].reverse().map(row => ({ ...row, weight: 999, highlight: 0 })));
        expect([...layoutGraph(reordered, "circular").positions]).toEqual([...layout.positions]);
        expect([...layoutGraph(reordered, "circular").routes]).toEqual([...layout.routes]);
    });
    it("uses exact typed ID ordering, not display labels or locale", () => {
        const graph = make([7, "7", " 7", "A", "a"].map((source, edgeId) => ({ source, target: source, edgeId })));
        expect([...layoutGraph(graph, "circular").positions.keys()]).toEqual(["n:7", "s: 7", "s:7", "s:A", "s:a"]);
    });
});
