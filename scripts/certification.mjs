import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { ESLint } from "eslint";
import ts from "typescript";
import { parse } from "acorn";
import { simple } from "acorn-walk";
import { readArtifact, root, verifyBundledNotices, writeReport } from "./artifact.mjs";

const artifact = await readArtifact();
const bundledNotices = await verifyBundledNotices(artifact);
const failures = [];
const banned = new Set([
    "eval", "Function", "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Worker", "SharedWorker",
    "importScripts", "sendBeacon", "localStorage", "sessionStorage", "indexedDB", "fetchMoreData",
    "innerHTML", "outerHTML", "insertAdjacentHTML"
]);
function inspect(code, filename) {
    const report = (node, message) => failures.push(`${filename}:${node.loc?.start.line ?? "?"}: ${message}`);
    const ast = parse(code, { ecmaVersion: "latest", sourceType: "module", locations: true });
    simple(ast, {
        Identifier(node) {
            if (banned.has(node.name)) report(node, `forbidden runtime API ${node.name}`);
        },
        MemberExpression(node) {
            const name = node.computed ? node.property.value : node.property.name;
            if (banned.has(name)) report(node, `forbidden runtime member ${name}`);
            if (node.object.name === "document" && ["write", "writeln", "domain", "cookie"].includes(name)) report(node, `document.${name} forbidden`);
        },
        Literal(node) {
            if (typeof node.value === "string" && /^(?:https?:)?\/\//i.test(node.value) && node.value !== "http://www.w3.org/2000/svg") {
                report(node, `remote runtime URL ${node.value.slice(0, 100)}`);
            }
        },
        ImportExpression(node) { report(node, "dynamic import forbidden"); },
        CallExpression(node) {
            const name = node.callee.name ?? node.callee.property?.name;
            if (["setTimeout", "setInterval", "setImmediate"].includes(name) && node.arguments[0]?.type === "Literal" && typeof node.arguments[0].value === "string") {
                report(node, "string-based timer forbidden");
            }
        }
    });
}
async function sourceFiles(folder) {
    const files = [];
    for (const item of await readdir(folder, { withFileTypes: true })) {
        const filename = path.join(folder, item.name);
        if (item.isDirectory()) files.push(...await sourceFiles(filename));
        else if (filename.endsWith(".ts")) files.push(filename);
    }
    return files;
}
const files = await sourceFiles(path.join(root, "src"));
for (const filename of files) {
    const source = await readFile(filename, "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
    inspect(compiled.outputText, path.relative(root, filename));
}
inspect(artifact.visual.content.js, "actual PBIVIZ/visual.js");
assert.deepEqual(artifact.visual.capabilities.privileges, []);
assert.deepEqual(artifact.visual.externalJS, []);
assert(!/@import\b/i.test(artifact.visual.content.css), "CSS imports forbidden");
for (const match of artifact.visual.content.css.matchAll(/url\(\s*["']?([^)"']+)/gi)) {
    assert(match[1].startsWith("#") || match[1].startsWith("data:image/"), `CSS resource must be local: ${match[1]}`);
}
const eslint = new ESLint();
const results = await eslint.lintFiles(["src"]);
const formatter = await eslint.loadFormatter("stylish");
const lintOutput = formatter.format(results);
if (lintOutput) console.log(lintOutput);
const lintErrors = results.reduce((total, result) => total + result.errorCount, 0);
const report = {
    artifact: artifact.filename, sha256: artifact.sha256,
    sourceFiles: files.length, staticApiFindings: [...new Set(failures)], lintErrors, bundledNotices,
    gates: ["actual ZIP/source manifest equality", "no certificate/key containers, PEM/OpenSSH private keys or private JWKs in ZIP entries", "empty privileges/externalJS", "source and actual compiled JavaScript AST API checks", "no remote runtime URLs or CSS imports", "Power BI recommended ESLint rules"],
    passed: failures.length === 0 && lintErrors === 0,
    disclaimer: "Automated preflight only. This is not Microsoft certification, an AppSource approval, a security proof, or native Power BI host validation."
};
await writeReport("certification-preflight.json", report);
assert(report.passed, [...new Set(failures), `${lintErrors} ESLint errors`].join("\n"));
console.log(`Certification preflight passed for ${artifact.filename}. NOT Microsoft-certified; native-host review remains required.`);
