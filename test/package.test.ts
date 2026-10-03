import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { assertBundledNoticeText, assertNoPrivateKeyMaterial } from "../scripts/artifact.mjs";
import { assertCanonicalZipMetadata, canonicalizeZip } from "../scripts/canonical-zip.mjs";

describe("certification command contract", () => {
    it("provides Microsoft's named eslint command without removing the focused lint command", () => {
        const metadata = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
        expect(metadata.scripts.eslint).toBe("npx eslint . --ext .js,.jsx,.ts,.tsx");
        expect(metadata.scripts.lint).toBe("eslint src test scripts");
    });
});

describe("canonical PBIVIZ archive", () => {
    async function createArchive({ platform, date, reverse }: { platform: "DOS" | "UNIX"; date: Date; reverse: boolean }) {
        const files: Array<[string, Buffer]> = [
            ["z.js", Buffer.from("const visual = true;\n")],
            ["empty.txt", Buffer.alloc(0)],
            ["folder/item.txt", Buffer.from("nested member\n")],
            ["a.json", Buffer.from("{\"version\":\"1.2.0.0\"}\n")]
        ];
        const zip = new JSZip();
        for (const [name, content] of reverse ? files.reverse() : files) {
            zip.file(name, content, {
                binary: true,
                date,
                dosPermissions: platform === "DOS" ? 0x21 : null,
                unixPermissions: platform === "UNIX" ? 0o100755 : null
            });
        }
        return zip.generateAsync({ type: "nodebuffer", platform, compression: "DEFLATE", compressionOptions: { level: 1 } });
    }

    it("normalizes entry order, UTC timestamp, DOS metadata, and permissions without changing member bytes", async () => {
        const firstInput = await createArchive({ platform: "UNIX", date: new Date("2024-04-05T06:07:08Z"), reverse: false });
        const secondInput = await createArchive({ platform: "DOS", date: new Date("2026-10-03T10:00:00Z"), reverse: true });
        expect(firstInput.equals(secondInput)).toBe(false);

        const first = await canonicalizeZip(firstInput);
        const second = await canonicalizeZip(secondInput);
        expect(first.equals(second)).toBe(true);

        const entries = assertCanonicalZipMetadata(first);
        expect(entries.map(entry => entry.name)).toEqual(["a.json", "empty.txt", "folder/", "folder/item.txt", "z.js"]);
        expect(entries.every(entry => entry.versionMadeBy === 0x0014)).toBe(true);
        expect(entries.every(entry => entry.modifiedDate === 0x0021 && entry.modifiedTime === 0)).toBe(true);
        expect(entries.every(entry => entry.externalAttributes === (entry.directory ? 0x10 : 0x20))).toBe(true);
        expect(entries.find(entry => entry.name === "empty.txt")?.compression).toBe(0);

        const verified = await JSZip.loadAsync(first, { checkCRC32: true });
        expect(await verified.file("a.json")?.async("nodebuffer")).toEqual(Buffer.from("{\"version\":\"1.2.0.0\"}\n"));
        expect(await verified.file("empty.txt")?.async("nodebuffer")).toEqual(Buffer.alloc(0));
        expect(await verified.file("folder/item.txt")?.async("nodebuffer")).toEqual(Buffer.from("nested member\n"));
        expect(await verified.file("z.js")?.async("nodebuffer")).toEqual(Buffer.from("const visual = true;\n"));
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
