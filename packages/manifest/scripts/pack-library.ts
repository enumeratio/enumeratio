// Write a library's index from its definitions, before publishing it:
//
//   node packages/manifest/scripts/pack-library.ts <package-dir> [--since <previous-dir>]
//
// With `--since`, the previous version (packed, as its host serves it) is diffed against this
// one, and a version number that says less than what changed is refused (check-version.ts).
//
// Reads `package.json`'s `enumeratio` field and every `symbols/<Name>/definition.json` beside
// the index it names, writes each symbol's examples (from its record, `index.md` and
// `examples.tsv`, less the aspirational and triage ones) as `examples.json` for the install check, and
// writes the index (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2), and the package's
// JavaScript entry, `dist/index.js` and `dist/index.d.ts` (library-entry.ts).

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readEntries } from "@enumeratio/entry/node";
import { validRange } from "semver";
import type { Definition, Example } from "../src/registry.ts";
import { entryOf } from "./library-entry.ts";
import { type LibraryField, type LibraryIndex, libraryIndexOf } from "../src/libraries/format.ts";

/** Pack the package at `dir`: its index, written and returned. */
export async function packLibrary(dir: string): Promise<string> {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
    enumeratio?: LibraryField;
    dependencies?: Record<string, string>;
  };
  if (pkg.enumeratio === undefined) throw new Error(`${dir}: package.json has no "enumeratio" field`);
  if (pkg.enumeratio.system !== undefined && validRange(pkg.enumeratio.system) === null)
    throw new Error(`${dir}: "system" is ${pkg.enumeratio.system}, which isn't a version range`);
  const indexPath = join(dir, pkg.enumeratio.index);
  const symbolsDir = dirname(indexPath);
  const records = new Map(readEntries(symbolsDir).map((entry) => [entry.name, entry]));
  const definitions: Record<string, Definition> = {};
  for (const name of readdirSync(symbolsDir)) {
    const file = join(symbolsDir, name, "definition.json");
    if (!existsSync(file)) continue;
    const definition = JSON.parse(readFileSync(file, "utf8")) as Definition;
    const examples: Example[] = (records.get(name)?.examples ?? [])
      .filter((e) => e.role !== "aspirational" && e.role !== "triage")
      .map(({ id, expr, expected, tolerance }) => ({
        id,
        expr,
        expected,
        ...(tolerance === undefined ? {} : { tolerance }),
      }));
    if (examples.length > 0)
      writeFileSync(join(symbolsDir, name, "examples.json"), `${JSON.stringify(examples, null, 2)}\n`);
    definitions[name] = { ...definition, examples };
  }
  const index = await libraryIndexOf(pkg.enumeratio.namespace, definitions);
  // A namespace another package serves is its scope's: `ada.*` from the `@ada/…` dependency.
  const packages: Record<string, string> = {};
  for (const dependency of Object.keys(pkg.dependencies ?? {})) {
    const scope = /^@([^/]+)\//.exec(dependency)?.[1];
    if (scope === undefined) continue;
    if (scope in packages) throw new Error(`${dir}: two dependencies are in the scope ${scope}`);
    packages[scope] = dependency;
  }
  const unresolved = unresolvedPins(dir, index, packages);
  if (unresolved.length > 0) throw new Error(`${dir}: pins that don't resolve\n  ${unresolved.join("\n  ")}`);
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  const { js, dts } = await entryOf({ index, definitions, packages });
  mkdirSync(join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "dist/index.js"), js);
  writeFileSync(join(dir, "dist/index.d.ts"), dts);
  return indexPath;
}

/**
 * Each pin no version this library can see has: its own symbols, and those of the dependencies
 * installed beside it. A dependency that isn't installed can't be checked here; the resolver
 * reports its unresolved pins when it declares the library.
 */
function unresolvedPins(dir: string, index: LibraryIndex, packages: Readonly<Record<string, string>>): string[] {
  const indexes = new Map<string, LibraryIndex>([[index.namespace, index]]);
  const indexOf = (namespace: string): LibraryIndex | undefined => {
    if (indexes.has(namespace)) return indexes.get(namespace);
    const pkg = packages[namespace];
    const root = pkg === undefined ? undefined : join(dir, "node_modules", pkg);
    const field =
      root === undefined ? undefined : readJson<{ enumeratio?: LibraryField }>(join(root, "package.json"))?.enumeratio;
    const found = field === undefined ? undefined : readJson<LibraryIndex>(join(root!, field.index));
    if (found !== undefined) indexes.set(namespace, found);
    return found;
  };
  const out: string[] = [];
  for (const [name, entry] of Object.entries(index.symbols))
    for (const [used, pin] of Object.entries(entry.requires ?? {})) {
      const [namespace, member] = used.split(".") as [string, string];
      const serving = indexOf(namespace);
      if (serving === undefined) continue;
      const has = serving.symbols[member]?.pin;
      if (has !== pin)
        out.push(
          `${index.namespace}.${name} pins ${used}@${pin}, and ${has === undefined ? "there's no such symbol" : `it's ${has}`}`,
        );
    }
  return out;
}

const readJson = <T>(path: string): T | undefined =>
  existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : undefined;

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, flag, previous] = process.argv.slice(2);
  if (dir === undefined || (flag !== undefined && (flag !== "--since" || previous === undefined)))
    throw new Error("usage: pack-library.ts <package-dir> [--since <previous-dir>]");
  console.log(`wrote ${await packLibrary(dir)}`);
  if (previous !== undefined) {
    const { checkVersion } = await import("./check-version.ts");
    const { level, changes, says } = await checkVersion(dir, previous);
    for (const { symbol, level: needs, what } of changes) console.log(`  ${needs}: ${symbol ?? "(library)"} ${what}`);
    if (!says) {
      console.error(`the changes need a ${level} version, and the version number doesn't say so`);
      process.exitCode = 1;
    } else console.log(`${level === "none" ? "no change" : `a ${level} change`}, and the version says so`);
  }
}
