import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assertBundledNoticeText, assertNoPrivateKeyMaterial } from "../scripts/artifact.mjs";

describe("certification command contract", () => {
    it("provides Microsoft's named eslint command without removing the focused lint command", () => {
        const metadata = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
        expect(metadata.scripts.eslint).toBe("npx eslint . --ext .js,.jsx,.ts,.tsx");
        expect(metadata.scripts.lint).toBe("eslint src test scripts");
    });
});

describe("packaged private-key exclusion", () => {
    it.each(["developer.pfx", "nested/localhost.P12", "private.key", "server.pem", "certificate.der"])("rejects certificate/key container %s", filename => {
        expect(() => assertNoPrivateKeyMaterial(filename, new Uint8Array())).toThrow(/forbidden/);
    });

    describe("distributed runtime license text", () => {
        it("accepts complete escaped license text retained in compiled JavaScript", () => {
            const notice = "Copyright example\nPermission is hereby granted...\n";
            expect(() => assertBundledNoticeText(`const licenses = ${JSON.stringify(notice)};`, notice)).not.toThrow();
        });
        it("rejects comments, sidecar references and truncated text instead of pretending licenses are bundled", () => {
            const notice = "Copyright example\nComplete license terms\n";
            for (const javascript of ["/* For license information see visual.js.LICENSE.txt */", `/* ${notice} */`, 'const licenses = "Copyright example";']) {
                expect(() => assertBundledNoticeText(javascript, notice)).toThrow(/complete generated/);
            }
        });
        it("accepts a preserved static template literal", () => {
            expect(() => assertBundledNoticeText("const licenses = `Copyright example\\nLicense terms`;", "Copyright example\nLicense terms")).not.toThrow();
        });
    });
    it.each(["PRIVATE KEY", "RSA PRIVATE KEY", "EC PRIVATE KEY", "ENCRYPTED PRIVATE KEY", "OPENSSH PRIVATE KEY"])("rejects recognizable %s even embedded in JS/JSON", label => {
        const text = JSON.stringify({ embedded: `-----BEGIN ${label}-----\nnot-a-real-key\n-----END ${label}-----` });
        expect(() => assertNoPrivateKeyMaterial("resources/visual.json", text)).toThrow(/Private-key material/);
    });
    it("rejects binary OpenSSH key markers in otherwise innocent assets", () => {
        expect(() => assertNoPrivateKeyMaterial("resources/icon.png", "openssh-key-v1\0")).toThrow(/Private-key material/);
    });
    it.each([{ kty: "RSA", d: "not-a-key" }, { kty: "EC", d: "not-a-key" }, { kty: "oct", k: "not-a-key" }])("rejects nested private JWKs", key => {
        expect(() => assertNoPrivateKeyMaterial("resources/config.json", JSON.stringify({ values: [key] }))).toThrow(/Private JSON Web Key/);
    });
    it("permits ordinary assets and non-secret public JWK metadata", () => {
        expect(() => assertNoPrivateKeyMaterial("resources/visual.json", JSON.stringify({ kty: "RSA", n: "public", e: "AQAB", content: { js: "const safe = true;" } }))).not.toThrow();
        expect(() => assertNoPrivateKeyMaterial("resources/icon.png", new Uint8Array([137, 80, 78, 71]))).not.toThrow();
    });
});
