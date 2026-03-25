/**
 * Build public/og.png (1200x630) for Open Graph / Twitter cards. Requires sharp.
 * Run: node scripts/generate-og.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const out = path.join(root, "public", "og.png");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0" stop-color="#9d96ff"/>
      <stop offset="0.5" stop-color="#635bff"/>
      <stop offset="1" stop-color="#4b44cc"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#0d0d0f"/>
  <rect x="2" y="2" width="1196" height="626" rx="48" fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="2"/>
  <text x="600" y="260" text-anchor="middle" fill="#fafafa" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="72" font-weight="700">RunnerSheet</text>
  <text x="600" y="340" text-anchor="middle" fill="#a1a1aa" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="28">Journeys and reports for drivers and managers</text>
  <rect x="380" y="400" width="440" height="36" rx="18" fill="url(#g)"/>
  <rect x="420" y="460" width="320" height="36" rx="18" fill="url(#g)" opacity="0.85"/>
  <rect x="400" y="520" width="380" height="36" rx="18" fill="url(#g)" opacity="0.7"/>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log("Wrote public/og.png");
