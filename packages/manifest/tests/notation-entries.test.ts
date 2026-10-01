// Each package's notation entry (`package.json`'s `enumeratio.notation`) against the code: it is
// exported, the manifest lists it, and it stays light. A host imports every one of them before
// it builds an engine, so an entry reaches nothing beyond boxes' main entry and compute-engine's
// types, through its own files.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { NOTATIONS } from "../src/generated/notations.ts";
import { notationSpecifier, type PackageField } from "../src/package-field.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PACKAGES = join(ROOT, "packages");

interface Workspace {
  readonly name: string;
  readonly dir: string;
  readonly field?: PackageField;
  readonly exports: Readonly<Record<string, unknown>>;
}

function workspaces(): Workspace[] {
  const dirs = [
    ...readdirSync(PACKAGES).map((name) => join(PACKAGES, name)),
    ...readdirSync(join(PACKAGES, "symbols")).flatMap((group) =>
      readdirSync(join(PACKAGES, "symbols", group)).map((name) => join(PACKAGES, "symbols", group, name)),
    ),
  ];
  return dirs
    .filter((dir) => existsSync(join(dir, "package.json")))
    .map((dir) => {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
        name: string;
        enumeratio?: PackageField;
        exports?: Record<string, unknown>;
      };
      return { name: pkg.name, dir, field: pkg.enumeratio, exports: pkg.exports ?? {} };
    });
}

const WORKSPACES = workspaces();
const WITH_NOTATION = WORKSPACES.filter((ws) => ws.field?.notation !== undefined);

/** The source behind an export: its `dist/<x>.mjs` as `src/<x>.ts`. */
function sourceOf(ws: Workspace, subpath: string): string | undefined {
  const entry = ws.exports[subpath];
  const target = typeof entry === "string" ? entry : (entry as { import?: string } | undefined)?.import;
  if (target === undefined) return undefined;
  return join(ws.dir, target.replace(/^\.\/dist\//, "./src/").replace(/\.mjs$/, ".ts"));
}

const STATEMENT =
  /(import|export)\s+(type\s+)?(?:\{([^}]*)\}|\*(?:\s+as\s+\w+)?|\w+)?\s*(?:from\s*)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']/g;

/** Why an entry may not import `specifier` this way, or undefined when it may. */
function forbidden(specifier: string, typeOnly: boolean): string | undefined {
  if (specifier === "@enumeratio/boxes") return undefined;
  if (specifier.startsWith("@cortex-js/compute-engine")) return typeOnly ? undefined : "compute-engine beyond types";
  return specifier;
}

/** What an entry reaches that it shouldn't, through its own files. */
function heavyImports(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  const bad: string[] = [];
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(STATEMENT)) {
    const specifier = (m[4] ?? m[5])!;
    if (specifier.startsWith(".")) {
      bad.push(...heavyImports(resolve(dirname(file), specifier), seen));
      continue;
    }
    const names =
      m[3]
        ?.split(",")
        .map((n) => n.trim())
        .filter(Boolean) ?? [];
    const typeOnly = m[2] !== undefined || (names.length > 0 && names.every((n) => n.startsWith("type ")));
    const why = forbidden(specifier, typeOnly);
    if (why !== undefined) bad.push(`${relative(ROOT, file)}: ${why}`);
  }
  return bad;
}

test("every notation entry is exported, from a source that exports `notation`", () => {
  expect(WITH_NOTATION.length).toBeGreaterThan(0);
  for (const ws of WITH_NOTATION) {
    const source = sourceOf(ws, ws.field!.notation!);
    expect(source, `${ws.name}: ${ws.field!.notation} isn't exported`).toBeDefined();
    expect(readFileSync(source!, "utf8"), ws.name).toMatch(/^export const notation\b/m);
  }
});

test("a package whose src/notation.ts exports `notation` names it in package.json", () => {
  const unnamed = WORKSPACES.filter(
    (ws) =>
      ws.field?.notation === undefined &&
      existsSync(join(ws.dir, "src/notation.ts")) &&
      /^export const notation\b/m.test(readFileSync(join(ws.dir, "src/notation.ts"), "utf8")),
  ).map((ws) => ws.name);
  expect(unnamed).toEqual([]);
});

test("the manifest lists every notation entry", () => {
  const expected = Object.fromEntries(
    WITH_NOTATION.map((ws) => [ws.name.replace(/^@enumeratio\//, ""), notationSpecifier(ws.name, ws.field)]),
  );
  expect({ ...NOTATIONS }).toEqual(expected);
});

test("notation entries import nothing beyond boxes and compute-engine's types", () => {
  const bad = WITH_NOTATION.flatMap((ws) => heavyImports(sourceOf(ws, ws.field!.notation!)!));
  expect(bad).toEqual([]);
});
