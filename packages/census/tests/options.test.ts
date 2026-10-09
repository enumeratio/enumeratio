// A name is a head or an option, never both. Options are Wolfram-style trailing rules
// (`PlotRange -> All`), so an option key that is also a head reads as a call in one place and a
// key in another, and `Options(f)` could not say which it meant. Enforced for now.

import { DRAWING_SYMBOLS, PLOT_SETTINGS } from "@enumeratio/frontend";
import { recordsRoot, referenceData } from "@enumeratio/reference/node";
import { expect, test } from "vite-plus/test";
import { declaredNames } from "../src/engine.ts";

const { heads: records } = referenceData(recordsRoot(import.meta.dirname));

/** Every option key a head accepts: the keys of a component's lowered options, and the
 *  optional (`name: type?`) parameters and defaults of a record's definition. */
function optionKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  for (const symbol of [...DRAWING_SYMBOLS, ...PLOT_SETTINGS])
    for (const key of Object.keys(symbol.options ?? {})) keys.set(key, `${symbol.tag} options`);
  for (const { head, entry } of records) {
    const definition = entry.definition;
    if (definition === undefined) continue;
    for (const key of Object.keys(definition.defaults ?? {})) keys.set(key, `${head} defaults`);
    for (const [, key] of definition.signature.matchAll(/(\w+)\s*:\s*[^,()]*\?/g)) keys.set(key!, `${head} signature`);
  }
  return keys;
}

/** Names that are both, each with the reason it stays for now. Empty is the goal. */
const BOTH: Record<string, string> = {};

const options = optionKeys();
const heads = new Set([...declaredNames(), ...records.map(({ head }) => head)]);

test("no name is both a head and an option key", () => {
  const clash = [...options.keys()].filter((key) => heads.has(key) && BOTH[key] === undefined).toSorted();
  expect(clash.map((key) => `${key} (${options.get(key)})`)).toEqual([]);
});

test("the allowlist names only clashes that still exist", () => {
  expect(Object.keys(BOTH).filter((name) => !(options.has(name) && heads.has(name)))).toEqual([]);
});

test("the census sees option keys and heads", () => {
  expect(options.has("PlotRange")).toBe(true);
  expect(heads.has("Plot")).toBe(true);
});
