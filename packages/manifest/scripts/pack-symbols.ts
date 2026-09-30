// Write a symbol package's index from its definitions, before publishing it:
//
//   node packages/manifest/scripts/pack-symbols.ts <package-dir>
//
// Reads `package.json`'s `enumeratio` field and every `symbols/<Name>/definition.json` beside
// the index it names, writes each symbol's examples (from its record, `index.md` and
// `examples.tsv`, less the aspirational and triage ones) as `examples.json` for the install check, and
// writes the index (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2), and the package's
// JavaScript entry, `dist/index.js` and `dist/index.d.ts` (symbol-entry.ts).

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readEntries } from "@enumeratio/entry/node";
import { validRange } from "semver";
import type { Definition, Example } from "../src/registry.ts";
import { entryOf } from "./symbol-entry.ts";
import { type SymbolPackageField, symbolIndexOf } from "../src/npm-registry.ts";

/** Pack the package at `dir`: its index, written and returned. */
export async function packSymbols(dir: string): Promise<string> {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
    enumeratio?: SymbolPackageField;
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
  const index = await symbolIndexOf(pkg.enumeratio.namespace, definitions);
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  // A namespace another package serves is its scope's: `ada.*` from the `@ada/…` dependency.
  const packages: Record<string, string> = {};
  for (const dependency of Object.keys(pkg.dependencies ?? {})) {
    const scope = /^@([^/]+)\//.exec(dependency)?.[1];
    if (scope === undefined) continue;
    if (scope in packages) throw new Error(`${dir}: two dependencies are in the scope ${scope}`);
    packages[scope] = dependency;
  }
  const { js, dts } = await entryOf({ index, definitions, packages });
  mkdirSync(join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "dist/index.js"), js);
  writeFileSync(join(dir, "dist/index.d.ts"), dts);
  return indexPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (dir === undefined) throw new Error("usage: pack-symbols.ts <package-dir>");
  console.log(`wrote ${await packSymbols(dir)}`);
}
