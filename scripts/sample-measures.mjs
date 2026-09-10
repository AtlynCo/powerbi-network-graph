import assert from "node:assert/strict";

export const measureName = (table, name) => `${table} ${name}`;

export function measureDefinitions(table) {
    return [
        ["Total Weight", `SUM('${table}'[Weight])`, "#,0.##"],
        ["Input Rows", `COUNTROWS('${table}')`, "#,0"],
        ["Events", `SUM('${table}'[EventCount])`, "#,0"],
        ["Average Duration ms", `AVERAGE('${table}'[DurationMs])`, "#,0.0"],
        ["Blank Weights", `COUNTROWS(FILTER('${table}', ISBLANK('${table}'[Weight])))`, "#,0"],
        ["Nonpositive Weights", `COUNTROWS(FILTER('${table}', NOT(ISBLANK('${table}'[Weight])) && '${table}'[Weight] <= 0))`, "#,0"],
        ["Visible Nodes", `COUNTROWS(DISTINCT(UNION(SELECTCOLUMNS('${table}', "ID", '${table}'[SourceID]), SELECTCOLUMNS('${table}', "ID", '${table}'[TargetID]))))`, "#,0"]
    ].map(([name, expression, format]) => [measureName(table, name), expression, format]);
}

export function assertUniqueMeasureNames(tables) {
    const owners = new Map();
    for (const { table, measures } of tables) {
        for (const name of measures) {
            assert(typeof name === "string" && name.trim(), `Empty measure name in '${table}'.`);
            const key = name.toLowerCase();
            assert(!owners.has(key), `Duplicate model-global measure name '${name}' in '${owners.get(key)}' and '${table}'.`);
            owners.set(key, table);
        }
    }
}
