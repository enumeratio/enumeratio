// Where the farmed Wolfram data lives, and which Wolfram names we farm.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { WolframDataRecord, WolframDataSource } from "@enumeratio/oracle/src";
import { HEADS } from "@enumeratio/wolfram/src";

export const WOLFRAM_CACHE = fileURLToPath(new URL("../.cache/wolfram-data", import.meta.url));

/** One entity's cache file; `:` and `/` (in `ArcTan:TwoArgument`, formula names) made safe. */
export const cachePath = (source: WolframDataSource, name: string): string =>
  `${WOLFRAM_CACHE}/${source}/${name.replace(/[:/\\]/g, "_")}.json`;

export function readCached<T extends WolframDataRecord>(source: WolframDataSource, name: string): T | undefined {
  const path = cachePath(source, name);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : undefined;
}

/** Every Wolfram name one of our heads maps to. */
export const mappedWolframNames = (): Set<string> => new Set(Object.values(HEADS));

/** Every record cached for `source`. */
export const cachedRecords = <T extends WolframDataRecord>(source: WolframDataSource): T[] =>
  existsSync(`${WOLFRAM_CACHE}/${source}`)
    ? readdirSync(`${WOLFRAM_CACHE}/${source}`)
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(readFileSync(`${WOLFRAM_CACHE}/${source}/${f}`, "utf8")) as T)
    : [];

/** The rows the adopter wrote, by head: what `prune-wolfram-examples.ts` may take back. */
export const ADOPTED = `${WOLFRAM_CACHE}/adopted.json`;

/** Expressions dropped from a head by hand, by head, as MathJSON text: wrong as examples (one
 * that leaks state into the others), so the adopter doesn't write them again. */
export const DECLINED = `${WOLFRAM_CACHE}/declined.json`;

export const readDeclined = (): Record<string, string[]> =>
  existsSync(DECLINED) ? (JSON.parse(readFileSync(DECLINED, "utf8")) as Record<string, string[]>) : {};

export function decline(rows: Readonly<Record<string, readonly unknown[]>>): void {
  const declined = readDeclined();
  for (const [head, exprs] of Object.entries(rows))
    declined[head] = [...new Set([...(declined[head] ?? []), ...exprs.map((e) => JSON.stringify(e))])];
  writeFileSync(DECLINED, `${JSON.stringify(declined, null, 1)}\n`);
}
