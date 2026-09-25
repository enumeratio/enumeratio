import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

// Repo-wide guard: `@enumeratio/entry` owns the strict YAML schema and the single reader/
// writer (design/examples-as-data.md §4, §9 "YAML typing"). Nothing else may import `yaml`
// directly -- a stray `yaml.parse()`/`YAML.stringify()` with the library's own default (YAML
// 1.2 core) schema would quietly turn `True` into `true` and `0o17` into `15`, exactly the
// trap the strict schema exists to close. Go through `parseYaml`/`stringifyYaml` instead.

const YAML_IMPORT = /(?:from\s+["']yaml["']|require\(\s*["']yaml["']\s*\))/;

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
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith("."))
      continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, out);
    else if (/\.[cm]?tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

test('only @enumeratio/entry imports "yaml" -- everyone else uses parseYaml/stringifyYaml', () => {
  const root = repoRoot(fileURLToPath(import.meta.url));
  const entryPackage = join(root, "packages", "entry");
  const offenders = sourceFiles(join(root, "packages"))
    .filter((f) => !f.startsWith(entryPackage + "/"))
    .filter((f) => YAML_IMPORT.test(readFileSync(f, "utf8")))
    .map((f) => relative(root, f));
  expect(offenders).toEqual([]);
});
