// Fetch Wolfram's curated data for every Wolfram name we map a head to, into a local cache
// (gitignored: it is Wolfram's content, and a kernel refetches it). `adopt-wolfram-examples.ts`
// reads the cache into our records.
//
//   node packages/reference/scripts/farm-wolfram-data.ts                   language + function
//   node packages/reference/scripts/farm-wolfram-data.ts --source formula  one source
//   node packages/reference/scripts/farm-wolfram-data.ts --refresh Zeta    refetch these names
//
// Sources: `language` (WolframLanguageData's documentation examples), `function`
// (MathematicalFunctionData's identities), `relation` (its free-variable identities,
// instantiated at sample points), `formula` (FormulaData, raw; every formula -- all physical
// or applied, none about a function, so nothing adopts them).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fetchWolframData, wolframDataNames, type WolframDataSource } from "@enumeratio/oracle/src";
import { WOLFRAM_CACHE, cachePath, mappedWolframNames } from "./wolfram-cache.ts";

const { values, positionals } = parseArgs({
  options: { source: { type: "string", multiple: true }, refresh: { type: "boolean", default: false } },
  allowPositionals: true,
});
const sources = (values.source ?? ["language", "function"]) as WolframDataSource[];

/** The entity names to fetch: ours by Wolfram name, or a function's variants (`ArcTan:TwoArgument`). */
async function namesFor(source: WolframDataSource): Promise<string[]> {
  const ours = positionals.length > 0 ? new Set(positionals) : mappedWolframNames();
  if (source === "language") return [...ours].toSorted();
  const all = await wolframDataNames(source);
  return source === "formula" && positionals.length === 0 ? all : all.filter((n) => ours.has(n.split(":")[0]!));
}

for (const source of sources) {
  mkdirSync(`${WOLFRAM_CACHE}/${source}`, { recursive: true });
  const names = await namesFor(source);
  const todo = values.refresh ? names : names.filter((n) => !existsSync(cachePath(source, n)));
  process.stderr.write(`${source}: ${todo.length} of ${names.length} to fetch\n`);
  let done = 0;
  await fetchWolframData(source, todo, (records) => {
    for (const record of records) writeFileSync(cachePath(source, record.name), `${JSON.stringify(record, null, 1)}\n`);
    done += records.length;
    process.stderr.write(`${source}: ${done} fetched\n`);
  });
}
