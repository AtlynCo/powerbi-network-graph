import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertUniqueMeasureNames, measureDefinitions } from "../scripts/sample-measures.mjs";

const sample = path.join(process.cwd(), "samples", "release");
const tables = ["Services", "Accounts"];
const names = ["Total Weight", "Input Rows", "Events", "Average Duration ms", "Blank Weights", "Nonpositive Weights", "Visible Nodes"];

describe("model-global sample measures", () => {
    it.each(names)("rejects the original cross-table duplicate %s", name => {
        expect(() => assertUniqueMeasureNames(tables.map(table => ({ table, measures: [name] })))).toThrow(/Duplicate model-global measure name/);
    });

    it("rejects case-only collisions across tables", () => {
        expect(() => assertUniqueMeasureNames([
            { table: "Services", measures: ["Services Events"] },
            { table: "Accounts", measures: ["services events"] }
        ])).toThrow(/Duplicate model-global measure name/);
    });

    it("rejects duplicates within one table", () => {
        expect(() => assertUniqueMeasureNames([{ table: "Services", measures: ["Events", "Events"] }])).toThrow(/Duplicate/);
    });

    it("keeps column references, expressions and formats while prefixing all fourteen names", () => {
        for (const table of tables) {
            const definitions = measureDefinitions(table);
            expect(definitions.map(([name]) => name)).toEqual(names.map(name => `${table} ${name}`));
            expect(definitions[0]).toEqual([`${table} Total Weight`, `SUM('${table}'[Weight])`, "#,0.##"]);
            expect(definitions[1]).toEqual([`${table} Input Rows`, `COUNTROWS('${table}')`, "#,0"]);
            expect(definitions.every(([, expression]) => expression.includes(`'${table}'`))).toBe(true);
        }
        expect(() => assertUniqueMeasureNames(tables.map(table => ({
            table, measures: measureDefinitions(table).map(([name]) => name)
        })))).not.toThrow();
    });

    it("finds fourteen globally unique measures in the actual TMDL, matching metadata and definitions", () => {
        const contract = JSON.parse(readFileSync(path.join(sample, "sample-contract.json"), "utf8")) as {
            domains: { table: string; measures: string[][] }[];
        };
        const directory = path.join(sample, "Network.SemanticModel", "definition", "tables");
        const actual = readdirSync(directory).map(file => {
            const source = readFileSync(path.join(directory, file), "utf8");
            return { table: path.basename(file, ".tmdl"), measures: [...source.matchAll(/^\s*measure '([^']+)' =/gm)].map(match => match[1]) };
        });
        const allNames = actual.flatMap(table => table.measures);
        expect(allNames).toHaveLength(14);
        expect(new Set(allNames.map(name => name.toLowerCase())).size).toBe(14);
        for (const table of tables) {
            expect(actual.find(item => item.table === table)?.measures).toEqual(names.map(name => `${table} ${name}`));
            expect(contract.domains.find(item => item.table === table)?.measures).toEqual(measureDefinitions(table));
        }
        expect(() => assertUniqueMeasureNames(actual)).not.toThrow();
    });

    it.each(tables)("keeps every %s graph/detail measure projection and query identifier consistent", table => {
        let count = 0;
        for (const suffix of ["Graph", "Details"]) {
            const visual = JSON.parse(readFileSync(path.join(sample, "Network.Report", "definition", "pages", `Page${table}`,
                "visuals", `${table[0]}${suffix}`, "visual.json"), "utf8"));
            for (const state of Object.values(visual.visual.query.queryState) as { projections: {
                field: { Measure?: { Expression: { SourceRef: { Entity: string } }; Property: string } };
                queryRef: string; nativeQueryRef: string;
            } }[]) {
                for (const projection of state.projections) {
                    const measure = projection.field.Measure;
                    if (!measure) continue;
                    expect(measure.Expression.SourceRef.Entity).toBe(table);
                    expect(names.map(name => `${table} ${name}`)).toContain(measure.Property);
                    expect(projection.queryRef).toBe(`${table}.${measure.Property}`);
                    expect(projection.nativeQueryRef).toBe(measure.Property);
                    count++;
                }
            }
        }
        expect(count).toBe(8);
    });
});
