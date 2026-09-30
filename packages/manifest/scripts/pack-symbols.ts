// Write a symbol package's index from its definitions, before publishing it:
//
//   node packages/manifest/scripts/pack-symbols.ts <package-dir>
//
// Reads `package.json`'s `enumeratio` field and every `symbols/<Name>/definition.json` beside
// the index it names, and writes the index (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2).

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Definition } from "../src/registry.ts";
import { type SymbolPackageField, symbolIndexOf } from "../src/npm-registry.ts";

/** Pack the package at `dir`: its index, written and returned. */
export async function packSymbols(dir: string): Promise<string> {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { enumeratio?: SymbolPackageField };
  if (pkg.enumeratio === undefined) throw new Error(`${dir}: package.json has no "enumeratio" field`);
  const indexPath = join(dir, pkg.enumeratio.index);
  const symbolsDir = dirname(indexPath);
  const definitions: Record<string, Definition> = {};
  for (const name of readdirSync(symbolsDir)) {
    const file = join(symbolsDir, name, "definition.json");
    if (existsSync(file)) definitions[name] = JSON.parse(readFileSync(file, "utf8")) as Definition;
  }
  const index = await symbolIndexOf(pkg.enumeratio.namespace, definitions);
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  return indexPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (dir === undefined) throw new Error("usage: pack-symbols.ts <package-dir>");
  console.log(`wrote ${await packSymbols(dir)}`);
}
