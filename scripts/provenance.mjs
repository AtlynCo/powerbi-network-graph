import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { digest, root } from "./artifact.mjs";

export function git(...args) {
    return execFileSync("git", ["--no-pager", ...args], { cwd: root, encoding: "utf8" }).trim();
}

export async function hashFiles(files) {
    const result = {};
    for (const file of [...files].sort()) {
        const bytes = await readFile(path.join(root, file));
        result[file.replaceAll("\\", "/")] = { bytes: bytes.length, sha256: digest(bytes) };
    }
    return result;
}

export async function buildInputs() {
    const files = [
        "pbiviz.json", "capabilities.json", "package.json", "package-lock.json", "tsconfig.json",
        "scripts/artifact.mjs", "scripts/canonical-zip.mjs", "scripts/package.mjs", "scripts/provenance.mjs"
    ];
    const visit = async folder => {
        for (const item of await readdir(path.join(root, folder), { withFileTypes: true })) {
            const file = path.join(folder, item.name);
            if (item.isDirectory()) await visit(file);
            else files.push(file);
        }
    };
    for (const folder of ["src", "style", "assets", "stringResources"]) await visit(folder);
    return hashFiles(files);
}

export async function toolVersions() {
    const packages = {};
    for (const name of ["powerbi-visuals-api", "powerbi-visuals-tools", "typescript", "vitest", "eslint", "@playwright/test"]) {
        packages[name] = JSON.parse(await readFile(path.join(root, "node_modules", name, "package.json"), "utf8")).version;
    }
    return { node: process.version, platform: process.platform, architecture: process.arch, npmUserAgent: process.env.npm_config_user_agent ?? null, packages };
}
