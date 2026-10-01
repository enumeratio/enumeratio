// Write a library's index from its definitions, before publishing it:
//
//   node packages/manifest/scripts/pack-library.ts <package-dir> [--since <previous-dir>]
//
// With `--since`, the previous version (packed, as its host serves it) is diffed against this
// one, and a version number that says less than what changed is refused (check-version.ts).
//
// Reads `package.json`'s `enumeratio` field and each symbol beside the index it names, writes
// `definition.json` for each symbol whose record holds its definition in Epsil
// (epsil-definitions.ts; one without is read as written), writes each symbol's examples (from its record, `index.md` and
// `examples.tsv`, less the aspirational and triage ones) as `examples.json` for the install check,
// each symbol's mappings to the targets the package names as `mappings.json` (§4.4), and
// writes the index (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2), and the package's
// JavaScript entry, `dist/index.js` and `dist/index.d.ts` (library-entry.ts).

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isCrosswalkSystem, mappingsOf, targetsOf } from "@enumeratio/entry";
import { readHead } from "@enumeratio/entry/node";
import { SYMBOL_MAPPINGS_SCHEMA, validateSchema } from "@enumeratio/entry/schema";
import { validRange } from "semver";
import { type NotationData, notationProblem } from "../src/notation-data.ts";
import type { Definition, Example } from "../src/registry.ts";
import { definitionsOf } from "./epsil-definitions.ts";
import { entryOf } from "./library-entry.ts";
import {
  type LibraryField,
  type LibraryIndex,
  libraryIndexOf,
  type NotationSummary,
  notationSummaryOf,
  paramsOf,
} from "../src/libraries/format.ts";

/** Pack the package at `dir`: its index, written and returned. */
export async function packLibrary(dir: string): Promise<string> {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
    enumeratio?: LibraryField;
    dependencies?: Record<string, string>;
    exports?: Record<string, unknown>;
  };
  if (pkg.enumeratio === undefined) throw new Error(`${dir}: package.json has no "enumeratio" field`);
  if (pkg.enumeratio.system !== undefined && validRange(pkg.enumeratio.system) === null)
    throw new Error(`${dir}: "system" is ${pkg.enumeratio.system}, which isn't a version range`);
  const indexPath = join(dir, pkg.enumeratio.index);
  const symbolsDir = dirname(indexPath);
  const targets = pkg.enumeratio.mappings ?? [];
  const unknown = targets.filter((t) => !isCrosswalkSystem(t));
  if (unknown.length > 0) throw new Error(`${dir}: "mappings" names ${unknown.join(", ")}, which no target is`);
  // A namespace another package serves is its scope's: `ada.*` from the `@ada/…` dependency.
  const packages: Record<string, string> = {};
  for (const dependency of Object.keys(pkg.dependencies ?? {})) {
    const scope = /^@([^/]+)\//.exec(dependency)?.[1];
    if (scope === undefined) continue;
    if (scope in packages) throw new Error(`${dir}: two dependencies are in the scope ${scope}`);
    packages[scope] = dependency;
  }
  const dependencyIndex = installedIndexes(dir, packages);
  // A definition written in Epsil, in its record's front matter, is made into definition.json.
  const records = new Map(
    readdirSync(symbolsDir)
      .filter((name) => existsSync(join(symbolsDir, name, "index.md")))
      .map((name) => [name, readHead(symbolsDir, name)] as const),
  );
  const written = Object.fromEntries(
    [...records].flatMap(([name, { entry }]) =>
      entry.definition === undefined ? [] : [[name, { definition: entry.definition, attributes: entry.attributes }]],
    ),
  );
  const made = await definitionsOf(pkg.enumeratio.namespace, written, (used) => {
    const [namespace, member] = used.split(".") as [string, string];
    return dependencyIndex(namespace)?.symbols[member]?.pin;
  });
  for (const [name, definition] of Object.entries(made))
    writeFileSync(join(symbolsDir, name, "definition.json"), `${JSON.stringify(definition, null, 2)}\n`);
  const definitions: Record<string, Definition> = {};
  const mapped: Record<string, string[]> = {};
  for (const name of readdirSync(symbolsDir)) {
    const file = join(symbolsDir, name, "definition.json");
    if (!existsSync(file)) continue;
    const definition = made[name] ?? (JSON.parse(readFileSync(file, "utf8")) as Definition);
    const problem = declarationProblem(definition);
    if (problem !== undefined) throw new Error(`${dir}: ${name} ${problem}`);
    const notation = readJson<NotationData>(join(symbolsDir, name, "notation.json"));
    const unwritable = notation === undefined ? undefined : notationProblem(notation);
    if (unwritable !== undefined) throw new Error(`${dir}: ${name}'s notation: ${unwritable}`);
    const record = records.get(name);
    const mappings = record === undefined ? undefined : mappingsOf(record, targets);
    if (mappings !== undefined) {
      const invalid = validateSchema(SYMBOL_MAPPINGS_SCHEMA, mappings);
      if (invalid.length > 0) throw new Error(`${dir}: ${name}'s mappings\n  ${invalid.join("\n  ")}`);
      writeFileSync(join(symbolsDir, name, "mappings.json"), `${JSON.stringify(mappings, null, 2)}\n`);
      mapped[name] = targetsOf(mappings);
    }
    const examples: Example[] = (record?.entry.examples ?? [])
      .filter((e) => e.role !== "aspirational" && e.role !== "triage")
      .map(({ id, expr, expected, tolerance }) => ({
        id,
        expr,
        expected,
        ...(tolerance === undefined ? {} : { tolerance }),
      }));
    if (examples.length > 0)
      writeFileSync(join(symbolsDir, name, "examples.json"), `${JSON.stringify(examples, null, 2)}\n`);
    const summary = record?.entry.summary;
    definitions[name] = {
      ...definition,
      examples,
      ...(notation === undefined ? {} : { notation }),
      ...(summary === undefined ? {} : { summary }),
    };
  }
  const index = await libraryIndexOf(pkg.enumeratio.namespace, definitions, await notationOf(dir, pkg), mapped);
  const unresolved = unresolvedPins(index, dependencyIndex);
  if (unresolved.length > 0) throw new Error(`${dir}: pins that don't resolve\n  ${unresolved.join("\n  ")}`);
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  const { js, dts } = await entryOf({ index, definitions, packages });
  mkdirSync(join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "dist/index.js"), js);
  writeFileSync(join(dir, "dist/index.d.ts"), dts);
  return indexPath;
}

const ATTRIBUTES: ReadonlySet<string> = new Set(["HoldAll"]);

/** Why a definition's attributes or defaults can't be declared, or undefined if they can. */
function declarationProblem(definition: Definition): string | undefined {
  const unknown = (definition.attributes ?? []).filter((a) => !ATTRIBUTES.has(a));
  if (unknown.length > 0)
    return `has attributes ${unknown.join(", ")}, and only ${[...ATTRIBUTES].join(", ")} are known`;
  const params = paramsOf(definition);
  if (definition.attributes?.length && params === undefined) return "has attributes, and its body isn't a Function";
  const names = Object.keys(definition.defaults ?? {});
  if (names.length === 0) return undefined;
  if (params === undefined) return "has defaults, and its body isn't a Function";
  const trailing = params.slice(params.length - names.length);
  if (names.some((n) => !trailing.includes(n)))
    return `has defaults for ${names.join(", ")}, which must be its body's last parameters (${params.join(", ")})`;
  return undefined;
}

/** The notation entry `enumeratio.notation` names, by the package's own `exports`, summarized. */
async function notationOf(
  dir: string,
  pkg: { enumeratio?: LibraryField; exports?: Record<string, unknown> },
): Promise<NotationSummary | undefined> {
  const subpath = pkg.enumeratio?.notation;
  if (subpath === undefined) return undefined;
  const target = pkg.exports?.[subpath];
  const file = typeof target === "string" ? target : (target as { import?: string } | undefined)?.import;
  if (file === undefined) throw new Error(`${dir}: "notation" is ${subpath}, which package.json doesn't export`);
  const module = (await import(pathToFileURL(resolve(dir, file)).href)) as { notation?: object };
  if (module.notation === undefined) throw new Error(`${dir}: ${file} doesn't export notation`);
  return notationSummaryOf(module.notation);
}

/**
 * Each pin no version this library can see has: its own symbols, and those of the dependencies
 * installed beside it. A dependency that isn't installed can't be checked here; the resolver
 * reports its unresolved pins when it declares the library.
 */
function unresolvedPins(
  index: LibraryIndex,
  dependencyIndex: (namespace: string) => LibraryIndex | undefined,
): string[] {
  const indexOf = (namespace: string): LibraryIndex | undefined =>
    namespace === index.namespace ? index : dependencyIndex(namespace);
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

/** The index of the library installed beside `dir` that serves each namespace, read once. */
function installedIndexes(
  dir: string,
  packages: Readonly<Record<string, string>>,
): (namespace: string) => LibraryIndex | undefined {
  const indexes = new Map<string, LibraryIndex | undefined>();
  return (namespace) => {
    if (indexes.has(namespace)) return indexes.get(namespace);
    const pkg = packages[namespace];
    const root = pkg === undefined ? undefined : join(dir, "node_modules", pkg);
    const field =
      root === undefined ? undefined : readJson<{ enumeratio?: LibraryField }>(join(root, "package.json"))?.enumeratio;
    const found = field === undefined ? undefined : readJson<LibraryIndex>(join(root!, field.index));
    indexes.set(namespace, found);
    return found;
  };
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
