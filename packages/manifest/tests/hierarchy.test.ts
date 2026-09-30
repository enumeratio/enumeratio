// The hierarchy (src/hierarchy.ts) against the code: every workspace package is placed, and
// none imports up it. A symbol package imports only what it extends, transitively, and the
// infrastructure; presentation imports any library; nothing but tooling imports tooling.
// Imports are read from each package's `dependencies` and its shipped source, type-only
// ones included.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { HIERARCHY, PACKAGES } from "../src/hierarchy.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SCOPE = "@enumeratio/";

/** Not shipped: what a package's tests, scripts and records hold. */
const SKIP = new Set([
  "node_modules",
  "dist",
  "generated",
  "tests",
  "scripts",
  "reference",
  "docs",
  "fixtures",
  "bench",
]);

interface Workspace {
  readonly name: string;
  readonly dir: string;
  readonly dependencies: readonly string[];
}

function workspaces(): Workspace[] {
  const packages = join(ROOT, "packages");
  const dirs = [
    ...readdirSync(packages).map((name) => join(packages, name)),
    ...readdirSync(join(packages, "symbols")).flatMap((group) =>
      readdirSync(join(packages, "symbols", group)).map((name) => join(packages, "symbols", group, name)),
    ),
  ];
  return dirs
    .filter((dir) => existsSync(join(dir, "package.json")))
    .map((dir) => {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
        name: string;
        dependencies?: Record<string, string>;
      };
      const dependencies = Object.keys(pkg.dependencies ?? {})
        .filter((dep) => dep.startsWith(SCOPE))
        .map((dep) => dep.slice(SCOPE.length));
      return { name: pkg.name.slice(SCOPE.length), dir, dependencies };
    })
    .filter((ws) => ws.name.length > 0);
}

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name) || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, out);
    else if (/\.(m?ts|vue|m?js)$/.test(entry.name) && !/\.(test|config|d)\.[cm]?ts$|\.config\./.test(entry.name))
      out.push(path);
  }
  return out;
}

/** The node an `@enumeratio/…` specifier lands on: `boxes/render` for that entry point. */
function nodeOf(specifier: string): string {
  const [pkg, sub] = specifier.slice(SCOPE.length).split("/");
  return sub !== undefined && Object.hasOwn(HIERARCHY, `${pkg}/${sub}`) ? `${pkg}/${sub}` : pkg!;
}

/** The node a file belongs to: an entry point placed apart owns `src/<subpath>/`. */
function ownerOf(ws: Workspace, file: string): string {
  const [top, sub] = relative(ws.dir, file).split("/");
  return top === "src" && sub !== undefined && Object.hasOwn(HIERARCHY, `${ws.name}/${sub}`)
    ? `${ws.name}/${sub}`
    : ws.name;
}

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;
function closure(name: string, seen = new Set<string>()): Set<string> {
  for (const parent of HIERARCHY[name]?.extends ?? []) {
    if (seen.has(parent)) continue;
    seen.add(parent);
    closure(parent, seen);
  }
  return seen;
}

/** Why `from` may not import `to`, or undefined when it may. */
function violation(from: string, to: string): string | undefined {
  if (from === to) return undefined;
  const source = HIERARCHY[from]!;
  const target = HIERARCHY[to];
  if (target === undefined) return `${to} isn't placed`;
  if (source.layer === "tooling") return undefined;
  if (target.layer === "tooling") return `${to} is tooling`;
  if (source.layer === "presentation") return undefined;
  if (target.layer === "infra") return undefined;
  if (source.layer === "infra") return `infra imports ${target.layer} ${to}`;
  return closure(from).has(to) ? undefined : `${from} doesn't extend ${to}`;
}

const WORKSPACES = workspaces();

test("every workspace package is placed, and every placement is one", () => {
  const names = new Set(WORKSPACES.map((ws) => ws.name));
  expect(WORKSPACES.map((ws) => ws.name).filter((name) => !Object.hasOwn(HIERARCHY, name))).toEqual([]);
  expect(Object.keys(HIERARCHY).filter((name) => !names.has(name.split("/")[0]!))).toEqual([]);
});

test("a library extends only libraries, below it and without a cycle", () => {
  const bad: string[] = [];
  for (const [name, placement] of Object.entries(HIERARCHY)) {
    if (closure(name).has(name)) bad.push(`${name}: cycle`);
    for (const parent of placement.extends) {
      const layer = HIERARCHY[parent]?.layer;
      if (layer === undefined || layer === "infra" || layer === "tooling")
        bad.push(`${name} extends ${parent} (${layer})`);
      else if (layer === "presentation" && placement.layer !== "presentation") bad.push(`${name} extends ${parent}`);
      else if (placement.layer === "base" && layer !== "base") bad.push(`base ${name} extends ${parent}`);
    }
  }
  expect(bad).toEqual([]);
});

test("the resolver's requirements are the hierarchy's", () => {
  for (const [name, placement] of Object.entries(HIERARCHY))
    expect(PACKAGES[name]?.requires).toEqual(placement.extends);
});

test("no package depends up the hierarchy", () => {
  const bad: string[] = [];
  for (const ws of WORKSPACES) {
    for (const dep of ws.dependencies) {
      const why = violation(ws.name, dep);
      if (why !== undefined) bad.push(`${ws.name}/package.json: ${why}`);
    }
  }
  expect(bad).toEqual([]);
});

test("no shipped source imports up the hierarchy", () => {
  const bad: string[] = [];
  for (const ws of WORKSPACES) {
    for (const file of sources(ws.dir)) {
      const text = readFileSync(file, "utf8");
      const where = relative(ROOT, file);
      const from = ownerOf(ws, file);
      for (const [, specifier] of text.matchAll(IMPORT)) {
        if (specifier!.startsWith(SCOPE)) {
          const why = violation(from, nodeOf(specifier!));
          if (why !== undefined) bad.push(`${where}: ${why}`);
        } else if (specifier!.startsWith(".")) {
          // Within a package, an entry point placed apart is reached only through the hierarchy.
          const target = resolve(dirname(file), specifier!);
          const to = target.startsWith(ws.dir) ? ownerOf(ws, target) : from;
          if (to !== from && violation(from, to) !== undefined && relative(ws.dir, file) !== "src/index.ts")
            bad.push(`${where}: ${violation(from, to)}`);
        }
      }
    }
  }
  expect(bad).toEqual([]);
});

test("boxes' main entry doesn't reach its serialisers: they're `/render`'s", () => {
  const index = readFileSync(join(ROOT, "packages/boxes/src/index.ts"), "utf8");
  expect(index).not.toMatch(/from ["']\.\/render/);
});
