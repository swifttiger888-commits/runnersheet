#!/usr/bin/env node
/**
 * OpenNext + esbuild can emit a CommonJS `require` polyfill as
 *   eval("quire".replace(/^/,"re"))
 * which fails on Cloudflare Workers when that module loads after startup (lazy require).
 * @see https://github.com/opennextjs/opennextjs-cloudflare/issues/1155
 *
 * Run after `opennextjs-cloudflare build`, before `deploy` / `preview`.
 */
import fs from "node:fs";
import path from "node:path";

const handlerPath = path.join(
	process.cwd(),
	".open-next/server-functions/default/handler.mjs",
);

const OLD = 'eval("quire".replace(/^/,"re"))';
const NEW = "require";

let src = fs.readFileSync(handlerPath, "utf8");
if (!src.includes(OLD)) {
	console.warn(
		"[fix-opennext-workers-eval] Pattern not found; OpenNext may have fixed this — skipping.",
	);
	process.exit(0);
}
src = src.split(OLD).join(NEW);
fs.writeFileSync(handlerPath, src, "utf8");
console.log("[fix-opennext-workers-eval] Patched handler.mjs (ncc require polyfill → require).");
