import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { en, ar } from "../src/strings.ts";

// All artwork is original. A small raster graph matches the visual's cyclic, directed topology.
const width = 20;
const pixels = Buffer.alloc(width * width * 4, 255);
const set = (x, y, color) => {
    if (x >= 0 && x < width && y >= 0 && y < width) pixels.set(color, (y * width + x) * 4);
};
const teal = [0, 125, 135, 255];
const ink = [23, 45, 61, 255];
function line(x0, y0, x1, y1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) set(Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps), ink);
}
line(4, 5, 15, 5);
line(15, 5, 10, 16);
line(10, 16, 4, 5);
line(9, 3, 12, 5);
line(12, 5, 9, 7);
line(14, 10, 14, 13);
line(14, 13, 11, 12);
line(5, 10, 5, 7);
line(5, 7, 8, 9);
for (const [cx, cy] of [[4, 5], [15, 5], [10, 16]]) {
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) set(cx + x, cy + y, teal);
}
function crc32(bytes) {
    let value = 0xffffffff;
    for (const byte of bytes) {
        value ^= byte;
        for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    }
    return (value ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(bytes.length);
    const payload = Buffer.concat([Buffer.from(type), bytes]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(payload));
    return Buffer.concat([header, payload, crc]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(width, 4);
header[8] = 8;
header[9] = 6;
const rows = [];
for (let y = 0; y < width; y++) rows.push(Buffer.from([0]), pixels.subarray(y * width * 4, (y + 1) * width * 4));
writeFileSync(new URL("./icon.png", import.meta.url), Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))
]));
for (const [locale, strings] of [["en-US", en], ["ar-SA", ar]]) {
    const folder = new URL(`../stringResources/${locale}/`, import.meta.url);
    mkdirSync(folder, { recursive: true });
    writeFileSync(new URL("resources.resjson", folder), `${JSON.stringify(strings, null, 2)}\n`);
}
console.log("Generated original 20x20 PNG icon and en-US/ar-SA SDK resources.");
