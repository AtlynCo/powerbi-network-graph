import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import powerbi from "eslint-plugin-powerbi-visuals";

export default tseslint.config(
    { ignores: ["node_modules/**", "dist/**", ".tmp/**", ".tool-home/**", "webpack.statistics.*", "assets/**", "manual/**"] },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["src/**/*.ts"],
        plugins: { "powerbi-visuals": powerbi },
        rules: {
            ...powerbi.configs.recommended.rules,
            "powerbi-visuals/no-http-string": ["error", ["^http:\\/\\/www\\.w3\\.org\\/2000\\/svg$"]],
            "no-eval": "error",
            "no-implied-eval": "error",
            "no-new-func": "error",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
        }
    },
    {
        files: ["scripts/**/*.mjs", "*.mjs"],
        languageOptions: {
            globals: Object.fromEntries(["process", "console", "Buffer", "URL", "setTimeout", "clearTimeout", "window", "document", "globalThis", "getComputedStyle"].map(name => [name, "readonly"]))
        }
    }
);
