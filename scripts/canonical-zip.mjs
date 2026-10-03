import assert from "node:assert/strict";
import JSZip from "jszip";

const DOS_DATE_1980_01_01 = (1 << 5) | 1;
const compareNames = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function readDirectory(bytes) {
    const archive = Buffer.from(bytes);
    assert(archive.length >= 22, "ZIP is too short to contain an end-of-central-directory record");

    let endOffset = -1;
    const earliestOffset = Math.max(0, archive.length - 22 - 0xffff);
    for (let offset = archive.length - 22; offset >= earliestOffset; offset--) {
        if (archive.readUInt32LE(offset) === 0x06054b50) {
            endOffset = offset;
            break;
        }
    }
    assert.notEqual(endOffset, -1, "ZIP end-of-central-directory record is missing");

    const disk = archive.readUInt16LE(endOffset + 4);
    const centralDisk = archive.readUInt16LE(endOffset + 6);
    const diskEntries = archive.readUInt16LE(endOffset + 8);
    const entryCount = archive.readUInt16LE(endOffset + 10);
    const centralSize = archive.readUInt32LE(endOffset + 12);
    const centralOffset = archive.readUInt32LE(endOffset + 16);
    const archiveCommentLength = archive.readUInt16LE(endOffset + 20);
    assert.equal(disk, 0, "Multi-disk ZIPs are not supported");
    assert.equal(centralDisk, 0, "Multi-disk ZIPs are not supported");
    assert.equal(diskEntries, entryCount, "Multi-disk ZIPs are not supported");
    assert.notEqual(entryCount, 0xffff, "ZIP64 archives are not supported");
    assert.notEqual(centralSize, 0xffffffff, "ZIP64 archives are not supported");
    assert.notEqual(centralOffset, 0xffffffff, "ZIP64 archives are not supported");
    assert.equal(archiveCommentLength, 0, "Canonical ZIP archive comments must be empty");
    assert.equal(endOffset + 22, archive.length, "Unexpected ZIP bytes follow the end record");
    assert.equal(centralOffset + centralSize, endOffset, "Central directory bounds are invalid");

    const entries = [];
    let cursor = centralOffset;
    for (let index = 0; index < entryCount; index++) {
        assert.equal(archive.readUInt32LE(cursor), 0x02014b50, "Central directory entry is invalid");
        const versionMadeBy = archive.readUInt16LE(cursor + 4);
        const flags = archive.readUInt16LE(cursor + 8);
        const compression = archive.readUInt16LE(cursor + 10);
        const modifiedTime = archive.readUInt16LE(cursor + 12);
        const modifiedDate = archive.readUInt16LE(cursor + 14);
        const uncompressedSize = archive.readUInt32LE(cursor + 24);
        const fileNameLength = archive.readUInt16LE(cursor + 28);
        const extraLength = archive.readUInt16LE(cursor + 30);
        const commentLength = archive.readUInt16LE(cursor + 32);
        const externalAttributes = archive.readUInt32LE(cursor + 38);
        const localOffset = archive.readUInt32LE(cursor + 42);
        const fileNameStart = cursor + 46;
        const fileNameBytes = archive.subarray(fileNameStart, fileNameStart + fileNameLength);
        const name = fileNameBytes.toString("utf8");
        const next = fileNameStart + fileNameLength + extraLength + commentLength;
        assert(next <= endOffset, "Central directory entry exceeds the end record");
        assert.equal(commentLength, 0, `Canonical ZIP entry comment must be empty: ${name}`);

        assert.equal(archive.readUInt32LE(localOffset), 0x04034b50, `Local ZIP header is invalid: ${name}`);
        const localFlags = archive.readUInt16LE(localOffset + 6);
        const localCompression = archive.readUInt16LE(localOffset + 8);
        const localModifiedTime = archive.readUInt16LE(localOffset + 10);
        const localModifiedDate = archive.readUInt16LE(localOffset + 12);
        const localNameLength = archive.readUInt16LE(localOffset + 26);
        const localExtraLength = archive.readUInt16LE(localOffset + 28);
        const localName = archive.subarray(localOffset + 30, localOffset + 30 + localNameLength);
        assert(localName.equals(fileNameBytes), `Local and central ZIP names differ: ${name}`);

        entries.push({
            name,
            directory: name.endsWith("/"),
            versionMadeBy,
            flags,
            compression,
            uncompressedSize,
            extraLength,
            modifiedTime,
            modifiedDate,
            externalAttributes,
            localExtraLength,
            localFlags,
            localCompression,
            localModifiedTime,
            localModifiedDate
        });
        cursor = next;
    }
    assert.equal(cursor, endOffset, "Central directory length does not match its entries");
    return { entries, archiveCommentLength };
}

export function assertCanonicalZipMetadata(bytes) {
    const { entries } = readDirectory(bytes);
    const names = entries.map(entry => entry.name);
    assert(names.length > 0, "Canonical PBIVIZ ZIP must contain entries");
    assert.equal(new Set(names).size, names.length, "ZIP entry names must be unique");
    assert.deepEqual(names, [...names].sort(compareNames), "ZIP entries must be sorted by name");

    for (const entry of entries) {
        assert.equal(entry.versionMadeBy, 0x0014, `ZIP entry must use DOS platform metadata: ${entry.name}`);
        assert.equal(entry.extraLength, 0, `Canonical ZIP entry must not contain extra fields: ${entry.name}`);
        assert.equal(entry.localExtraLength, 0, `Canonical local ZIP header must not contain extra fields: ${entry.name}`);
        assert.equal(entry.modifiedDate, DOS_DATE_1980_01_01, `ZIP timestamp must be UTC 1980-01-01: ${entry.name}`);
        assert.equal(entry.modifiedTime, 0, `ZIP timestamp must be UTC midnight: ${entry.name}`);
        assert.equal(entry.localModifiedDate, entry.modifiedDate, `Local/central ZIP dates differ: ${entry.name}`);
        assert.equal(entry.localModifiedTime, entry.modifiedTime, `Local/central ZIP times differ: ${entry.name}`);
        assert.equal(entry.localFlags, entry.flags, `Local/central ZIP flags differ: ${entry.name}`);
        assert.equal(entry.localCompression, entry.compression, `Local/central ZIP compression differs: ${entry.name}`);
        assert.equal(entry.flags & 0x0008, 0, `Streaming data descriptors are not canonical: ${entry.name}`);
        assert.equal(entry.compression, entry.directory || entry.uncompressedSize === 0 ? 0 : 8,
            `ZIP compression method is not canonical: ${entry.name}`);
        if (entry.directory) assert.equal(entry.uncompressedSize, 0, `Canonical ZIP directory must be empty: ${entry.name}`);
        assert.equal(entry.externalAttributes, entry.directory ? 0x10 : 0x20, `ZIP permissions are not canonical: ${entry.name}`);
    }

    return entries;
}

export async function canonicalizeZip(bytes) {
    const sourceBytes = Buffer.from(bytes);
    const source = await JSZip.loadAsync(sourceBytes, { checkCRC32: true });
    const centralNames = readDirectory(sourceBytes).entries.map(entry => entry.name).sort(compareNames);
    const sourceFiles = Object.values(source.files).sort((left, right) => compareNames(left.name, right.name));
    assert.deepEqual(sourceFiles.map(file => file.name), centralNames, "ZIP entries must be unique and readable");

    const canonical = new JSZip();
    canonical.comment = "";
    for (const file of sourceFiles) {
        const content = file.dir ? Buffer.alloc(0) : await file.async("nodebuffer");
        canonical.file(file.name, content, {
            binary: true,
            comment: "",
            compression: file.dir ? "STORE" : "DEFLATE",
            compressionOptions: { level: 9 },
            createFolders: false,
            date: new Date(Date.UTC(1980, 0, 1, 0, 0, 0)),
            dir: file.dir,
            dosPermissions: file.dir ? 0x10 : 0x20,
            unixPermissions: null
        });
    }

    const result = await canonical.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
        platform: "DOS",
        streamFiles: false,
        comment: ""
    });
    assertCanonicalZipMetadata(result);
    const verified = await JSZip.loadAsync(result, { checkCRC32: true });
    for (const file of sourceFiles) {
        const rebuiltFile = verified.files[file.name];
        assert(rebuiltFile, `Canonical ZIP entry is missing: ${file.name}`);
        assert.equal(rebuiltFile.dir, file.dir, `Canonical ZIP entry type changed: ${file.name}`);
        if (!file.dir) {
            const originalContent = await file.async("nodebuffer");
            const rebuiltContent = await rebuiltFile.async("nodebuffer");
            assert(originalContent.equals(rebuiltContent), `Canonicalization changed ZIP member bytes: ${file.name}`);
        }
    }
    return Buffer.from(result);
}
