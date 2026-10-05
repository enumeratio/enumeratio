#!/usr/bin/env node
// A library's `dist/declares.json`: what declaring it finds, into a fresh engine that already
// holds what it requires (declares.ts). Run by the library's build after `vp pack`, from its
// directory, so its own dist and those of what it requires are what get declared:
//
//   node ../../manifest/scripts/collect-declares.ts .

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { loadLibraries, type StagedLibrary } from "../src/engine.ts";
import { PACKAGES } from "../src/hierarchy.ts";
import { plan } from "../src/resolve.ts";
import { declaresOf } from "./declares-of.ts";
import { cached } from "./stamp.ts";

const dir = resolve(process.argv[2] ?? ".");
const own = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name: string };
const SCOPE = "@enumeratio/";
const self = own.name.slice(SCOPE.length);

// Each package resolved from the one that requires it, as Node would: the manifest depends on
// no library, and a library need not depend on what its requirements require.
const homes = new Map<string, string>([[own.name, dir]]);
function resolveFrom(specifier: string): string {
  const [, pkg, subpath = ""] = /^(@[^/]+\/[^/]+|[^/]+)(\/.*)?$/.exec(specifier)!;
  const manifest = createRequire(join(homes.get(pkg!) ?? dir, "package.json")).resolve(`${pkg}/package.json`);
  if (subpath === "/package.json") return manifest;
  let target: unknown = (JSON.parse(readFileSync(manifest, "utf8")) as { exports: Record<string, unknown> }).exports[
    `.${subpath}`
  ];
  while (target !== null && typeof target === "object")
    target = (target as { import?: unknown; default?: unknown }).import ?? (target as { default?: unknown }).default;
  if (typeof target !== "string") throw new Error(`${specifier}: no import entry`);
  return join(dirname(manifest), target);
}
const load = (specifier: string, options?: { readonly json: true }): Promise<unknown> =>
  import(pathToFileURL(resolveFrom(specifier)).href, options?.json ? { with: { type: "json" } } : {}).then(
    (m: { default?: unknown }) => (options?.json ? m.default : m),
  );

// The library and what it requires, transitively.
const libraries = new Map<string, StagedLibrary<ComputeEngine>>();
const tried = new Set<string>();
for (let wanted = [self]; wanted.length > 0;) {
  for (const name of wanted) tried.add(name);
  const loaded = await loadLibraries<ComputeEngine>(wanted, load, SCOPE, { declares: false });
  wanted = [];
  for (const library of loaded) {
    libraries.set(library.name, library);
    const home = dirname(resolveFrom(`${SCOPE}${library.name}/package.json`));
    for (const dep of [...(PACKAGES[library.name]?.requires ?? []), ...(library.requires ?? [])])
      if (!tried.has(dep) && !wanted.includes(dep)) {
        homes.set(`${SCOPE}${dep}`, home);
        wanted.push(dep);
      }
  }
}
const library = libraries.get(self);
if (library === undefined) throw new Error(`${own.name} declares nothing`);

// Declaring reads only the built libraries (this one and what it requires, transitively) and the
// code here, so it is skipped while their dists hash the same as at its last run.
const output = join(dir, "dist", "declares.json");
const dists = [...libraries.keys()].map((name) => join(dirname(resolveFrom(`${SCOPE}${name}/package.json`)), "dist"));
const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));
const ran = await cached(
  "declares",
  { dir, roots: [...dists, here("."), here("../src")], skip: (path) => path.endsWith("declares.json") },
  [output],
  async () => {
    const ce = new ComputeEngine();
    for (const dep of plan([self], [...libraries.values()]).libraries) if (dep !== library) await dep.declare(ce);
    const declares = await declaresOf(ce, self, library.declare);
    writeFileSync(output, `${JSON.stringify(declares)}\n`);
    console.log(`${own.name}: declares ${declares.names.length} names`);
  },
  { restore: true }, // `vp pack` wipes dist before each build
);
if (!ran) console.log(`${own.name}: declares up to date`);
