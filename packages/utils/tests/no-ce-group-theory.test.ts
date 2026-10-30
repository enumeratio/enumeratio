import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

// compute-engine's opt-in `group-theory` entry declares PermutationGroup, PermutationCycles
// and PermutationPower, which clash with groupalgebra's. Nothing may load it until the
// names are reconciled.
const ENTRY = /@cortex-js\/compute-engine\/group-theory/;

function repoRoot(start: string): string {
  let dir = start;
  while (dir !== dirname(dir)) {
    try {
      statSync(join(dir, "pnpm-workspace.yaml"));
      return dir;
    } catch {
      dir = dirname(dir);
    }
  }
  throw new Error("repo root (pnpm-workspace.yaml) not found");
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, out);
    else if (/\.([cm]?[jt]sx?|vue|md)$/.test(entry.name) && path !== fileURLToPath(import.meta.url)) out.push(path);
  }
  return out;
}

test("nothing imports compute-engine's group-theory entry", () => {
  const root = repoRoot(fileURLToPath(import.meta.url));
  const offenders = ["packages", "web"]
    .flatMap((d) => sourceFiles(join(root, d)))
    .filter((f) => ENTRY.test(readFileSync(f, "utf8")))
    .map((f) => relative(root, f));
  expect(offenders).toEqual([]);
});
