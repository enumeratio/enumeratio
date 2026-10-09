import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

// A package that replaces a library head's `evaluate` or `canonical` in place (`operator.evaluate = ...`)
// bypasses `extendHead` and `wrapOperator`, which state how the head compiles. Such a file says it itself
// with `declareCompile` (@enumeratio/engine), or a head silently keeps compute-engine's lowering of what
// the replacement changed. This is a source scan: a new unrouted writer fails it.

const WRITER =
  /^[ \t]*(?:operator|d|derivative|\(operator as \{[^}]*\}\))\.(?:evaluate|canonical)\s*=[^=]|Object\.assign\(operator[,)]/m;

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
    if (["node_modules", "dist", "tests", "scripts"].includes(entry.name) || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, out);
    else if (/\.[cm]?tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

const root = repoRoot(dirname(fileURLToPath(import.meta.url)));

test("every file that replaces a head's evaluate or canonical in place states how the head compiles", () => {
  const unrouted = sourceFiles(join(root, "packages"))
    .filter((file) => {
      const text = readFileSync(file, "utf8");
      return WRITER.test(text) && !/\bdeclareCompile\(/.test(text);
    })
    .map((file) => relative(root, file));
  expect(unrouted).toEqual([]);
});

test("the scan recognizes the writers it is meant to catch", () => {
  for (const line of [
    "  operator.evaluate = (ops) => ops;",
    "      operator.canonical = (ops, options) => {",
    "  (operator as { evaluate: unknown }).evaluate = () => 1;",
    "    d.evaluate = (ops) => ops;",
    "  derivative.evaluate = (ops) => ops;",
    "  Object.assign(operator, { lazy: false });",
  ]) {
    expect(WRITER.test(line), line).toBe(true);
  }
  expect(WRITER.test("      nativeOperator.canonical = nativeCanonical;")).toBe(false);
});
