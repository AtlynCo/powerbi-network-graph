import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { en, ar } from "../src/strings.ts";

function artwork(size) {
    const width = size * 2;
    const scale = width / 20;
    const raster = Buffer.alloc(width * width * 4, 255);
    const teal = [0, 125, 135, 255];
    const ink = [23, 45, 61, 255];
    const circle = (cx, cy, radius, color) => {
        for (let y = Math.max(0, Math.floor((cy - radius) * scale)); y < Math.min(width, Math.ceil((cy + radius) * scale)); y++) {
            for (let x = Math.max(0, Math.floor((cx - radius) * scale)); x < Math.min(width, Math.ceil((cx + radius) * scale)); x++) {
                if (Math.hypot((x + 0.5) / scale - cx, (y + 0.5) / scale - cy) <= radius) raster.set(color, (y * width + x) * 4);
            }
        }
    };
    const stroke = (points, thickness = 0.55) => {
        for (let i = 1; i < points.length; i++) {
            const [a, b] = [points[i - 1], points[i]];
            const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * scale * 2));
            for (let step = 0; step <= steps; step++) circle(a[0] + (b[0] - a[0]) * step / steps, a[1] + (b[1] - a[1]) * step / steps, thickness / 2, ink);
        }
    };
    // Original Atlyn network artwork: a directed cycle with reciprocal and self relationships.
    stroke([[4, 5], [15, 5], [10, 16], [4, 5]]);
    stroke([[9.5, 3.8], [11.3, 5], [9.5, 6.2]]);
    stroke([[14.5, 10], [13, 12], [11.6, 10.6]]);
    stroke([[5.1, 10.3], [5.5, 8.1], [7.6, 8.9]]);
    const reciprocal = [];
    const loop = [];
    for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        reciprocal.push([14 - 9 * t, 6 + Math.sin(t * Math.PI) * 2]);
        loop.push([16 + Math.cos(t * Math.PI * 1.7 - 0.5) * 2.4, 3.5 + Math.sin(t * Math.PI * 1.7 - 0.5) * 2.4]);
    }
    stroke(reciprocal, 0.4);
    stroke([[7, 6.3], [5.8, 6.7], [6.4, 8]], 0.4);
    stroke(loop, 0.4);
    for (const [x, y] of [[4, 5], [15, 5], [10, 16]]) circle(x, y, 2.1, teal);
    const pixels = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (let channel = 0; channel < 4; channel++) {
        let sum = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) sum += raster[((y * 2 + dy) * width + x * 2 + dx) * 4 + channel];
        pixels[(y * size + x) * 4 + channel] = Math.round(sum / 4);
    }
    return pixels;
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
for (const [size, filename] of [[20, "icon.png"], [300, "logo-300.png"]]) {
    const pixels = artwork(size);
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = 6;
    const rows = [];
    for (let y = 0; y < size; y++) rows.push(Buffer.from([0]), pixels.subarray(y * size * 4, (y + 1) * size * 4));
    writeFileSync(new URL(filename, import.meta.url), Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header),
        chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))
    ]));
}
for (const [locale, strings] of [["en-US", en], ["ar-SA", ar]]) {
    const folder = new URL(`../stringResources/${locale}/`, import.meta.url);
    mkdirSync(folder, { recursive: true });
    writeFileSync(new URL("resources.resjson", folder), `${JSON.stringify(strings, null, 2)}\n`);
}
console.log("Generated original 20px icon, 300px logo, and en-US/ar-SA SDK resources.");
