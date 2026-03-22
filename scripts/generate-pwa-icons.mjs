/**
 * Regenerate solid-brand PWA icons (requires sharp).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

const bg = { r: 196, g: 30, b: 58, alpha: 1 };

for (const size of [192, 512]) {
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .png()
    .toFile(path.join(outDir, `icon-${size}.png`));
}

console.log("Wrote public/icons/icon-192.png and icon-512.png");
