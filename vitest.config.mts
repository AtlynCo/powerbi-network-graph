import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";

export default defineConfig({
    plugins: [{
        name: "test-vendor-maps",
        enforce: "pre",
        load(id) {
            // These published SDK utilities reference TS sources absent from their npm packages.
            // Load their actual JS unchanged except unusable debug-map comments; keep application maps and all warnings.
            if (/[/\\]node_modules[/\\]powerbi-visuals-utils-(?:formattingmodel|formattingutils|typeutils|dataviewutils)[/\\].*\.js$/.test(id)) {
                return readFileSync(id, "utf8").replace(/^\/\/# sourceMappingURL=.*$/gm, "");
            }
        }
    }],
    test: {
        environment: "jsdom",
        include: ["test/**/*.test.ts"],
        clearMocks: true,
        restoreMocks: true
    }
});
