import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const run = (command, fallback = "unknown") => {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
};

const gitSha = run("git rev-parse HEAD");
const gitShortSha = run("git rev-parse --short HEAD");
const gitBranch = run("git rev-parse --abbrev-ref HEAD");
const gitDirty = run("git status --porcelain", "") !== "";
const builtAt = new Date().toISOString();

const outputDir = resolve("src", "generated");
const outputPath = resolve(outputDir, "build-meta.ts");

mkdirSync(outputDir, { recursive: true });

const content = `export const buildMeta = {
  gitSha: ${JSON.stringify(gitSha)},
  gitShortSha: ${JSON.stringify(gitShortSha)},
  gitBranch: ${JSON.stringify(gitBranch)},
  gitDirty: ${JSON.stringify(gitDirty)},
  builtAt: ${JSON.stringify(builtAt)},
} as const;
`;

writeFileSync(outputPath, content, "utf8");
console.log(`Stamped build metadata -> ${outputPath}`);
