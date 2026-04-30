/**
 * Rasterise `public/icons/runnersheet-mark.svg` to PWA / Apple touch PNGs (requires sharp).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "icons");
const svgPath = path.join(outDir, "runnersheet-mark.svg");

mkdirSync(outDir, { recursive: true });

const svgBuffer = readFileSync(svgPath);

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  /** iOS home-screen / Safari; bump filename when artwork changes to bust caches. */
  { name: "apple-touch-180.png", size: 180 },
];

for (const { name, size } of targets) {
  await sharp(svgBuffer, { density: 300 })
    .resize(size, size, { fit: "contain", background: { r: 13, g: 13, b: 15, alpha: 1 } })
    .png()
    .toFile(path.join(outDir, name));
}

const apple180 = path.join(outDir, "apple-touch-180.png");
copyFileSync(apple180, path.join(root, "public", "apple-touch-icon.png"));

console.log(
  `Wrote ${targets.map((t) => `public/icons/${t.name}`).join(", ")}, public/apple-touch-icon.png`,
);
