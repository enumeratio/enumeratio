import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

// Ratchet on libraries (packages/symbols) importing @cortex-js/compute-engine directly: they
// go through @enumeratio/engine, and the full API through @enumeratio/engine/unstable (or its
// unstable/latex-syntax subpath).
// The lint rule (no-restricted-imports, root vite.config.ts) enforces it for every file not in
// the baseline; this test keeps the baseline honest. It can only shrink: a file that no longer
// imports compute-engine has to leave it (`UPDATE_CE_BASELINE=1 vp test` drops those), and
// nothing is ever added by hand or by the flag.

const BASELINE = join(dirname(fileURLToPath(import.meta.url)), "compute-engine-imports.baseline.json");
const IMPORT = /(?:\bfrom|\bimport\s*\(?|\brequire\s*\()\s*["']@cortex-js\/compute-engine[^"']*["']/;
const UNSTABLE_IMPORT = /["']@enumeratio\/engine\/unstable(?:\/[\w-]+)?["']/;
const UNSTABLE_REASON = /\/\/ unstable: \S/;

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
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

const root = repoRoot(fileURLToPath(import.meta.url));
const files = sourceFiles(join(root, "packages", "symbols")).map((f) => [relative(root, f), f] as const);
const importing = files.filter(([, f]) => IMPORT.test(readFileSync(f, "utf8"))).map(([name]) => name);
const baseline: string[] = JSON.parse(readFileSync(BASELINE, "utf8"));

if (process.env.UPDATE_CE_BASELINE) {
  const kept = baseline.filter((name) => importing.includes(name));
  writeFileSync(BASELINE, `${JSON.stringify(kept, null, 2)}\n`);
  baseline.splice(0, baseline.length, ...kept);
}

test("no library file imports compute-engine unless it is in the baseline", () => {
  expect(importing.filter((name) => !baseline.includes(name))).toEqual([]);
});

test("the baseline lists only files that still do — migrated ones leave it", () => {
  expect(baseline.filter((name) => !importing.includes(name))).toEqual([]);
});

test("the baseline is sorted and free of duplicates", () => {
  expect(baseline).toEqual([...new Set(baseline)].toSorted());
});

test("a file using the unstable entry carries an `// unstable: <reason>` comment", () => {
  const unjustified = files
    .filter(([, f]) => {
      const text = readFileSync(f, "utf8");
      return UNSTABLE_IMPORT.test(text) && !UNSTABLE_REASON.test(text);
    })
    .map(([name]) => name);
  expect(unjustified).toEqual([]);
});
