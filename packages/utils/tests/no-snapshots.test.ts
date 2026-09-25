import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

// Repo-wide guard: tests assert against committed golden-example JSON (`toEqual`
// a file the test can regenerate with an UPDATE_* env flag), never vitest snapshot
// matchers. Two reasons:
//   1. `toMatchSnapshot` / `toMatchInlineSnapshot` throw "SnapshotClient.setup()"
//      when the `test` task runs through `vp run` (what `vp run -r test` / CI use);
//      they pass only under a bare `vp test`, so a snapshot test is green locally
//      and red in the sweep. This bit us twice (demos.test.ts, cli-demos.test.ts).
//   2. Golden JSON is plain data: reviewable in diffs, and reusable/repurposable
//      (docs, fixtures, cross-checks) in ways an opaque .snap file is not.
// Regenerate a golden with its own flag, e.g. `UPDATE_CLI_DEMOS=1 vp test`.

const SNAPSHOT_CALL = /\btoMatch(?:Inline)?Snapshot\s*\(/;

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

function testFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) testFiles(path, out);
    else if (/\.test\.[cm]?tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

test("no vitest snapshot matchers — assert against committed golden JSON instead", () => {
  const root = repoRoot(fileURLToPath(import.meta.url));
  const self = fileURLToPath(import.meta.url);
  const offenders = testFiles(join(root, "packages"))
    .filter((f) => f !== self && SNAPSHOT_CALL.test(readFileSync(f, "utf8")))
    .map((f) => relative(root, f));
  expect(offenders).toEqual([]);
});
