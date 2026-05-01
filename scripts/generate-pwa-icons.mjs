/**
 * Rasterise `public/icons/runnersheet-mark.svg` to PWA / Apple touch PNGs and `src/app/favicon.ico`
 * (requires sharp + to-ico).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const toIco = require("to-ico");

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

const rasterize = (size) =>
  sharp(svgBuffer, { density: 300 })
    .resize(size, size, { fit: "contain", background: { r: 13, g: 13, b: 15, alpha: 1 } })
    .png();

for (const { name, size } of targets) {
  await rasterize(size).toFile(path.join(outDir, name));
}

const faviconSizes = [16, 32, 48];
const faviconPngs = await Promise.all(faviconSizes.map((size) => rasterize(size).toBuffer()));
const faviconIco = await toIco(faviconPngs);
const appDir = path.join(root, "src", "app");
mkdirSync(appDir, { recursive: true });
writeFileSync(path.join(appDir, "favicon.ico"), faviconIco);

const apple180 = path.join(outDir, "apple-touch-180.png");
copyFileSync(apple180, path.join(root, "public", "apple-touch-icon.png"));

console.log(
  [
    ...targets.map((t) => `public/icons/${t.name}`),
    "public/apple-touch-icon.png",
    "src/app/favicon.ico",
  ].join(", "),
);
