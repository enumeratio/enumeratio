// The interim catalogue (design/benchmarking.md §3): `catalogue/*.yaml`, each a map from head
// to its cases, in the example shape plus `bench`. They move into each head's own
// `reference/<Head>.yaml` as `role: bench` examples once the reference loader lands.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXAMPLE_ID, EXAMPLE_ID_MAX, parseYaml } from "@enumeratio/entry";
import type { MathJSON } from "@enumeratio/oracle/src";
import { drawSample, substitute } from "./random.ts";
import { SUITES } from "./suites.ts";
import type { BenchCase, ConcreteCase } from "./types.ts";

export const CATALOGUE_DIR = fileURLToPath(new URL("../catalogue/", import.meta.url));

/**
 * Answers pinned by `scripts/pin.ts` for cases the YAML gives none (sampled ones), each with
 * the formula it was computed for: a pin whose formula has moved on no longer counts.
 */
export const PINS_FILE = join(CATALOGUE_DIR, "pinned.json");

export type Pins = Readonly<Record<string, { readonly formula: string; readonly answer: string }>>;

export function loadPins(file = PINS_FILE): Pins {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Pins;
  } catch {
    return {};
  }
}

export function loadCatalogue(dir = CATALOGUE_DIR): BenchCase[] {
  const cases: BenchCase[] = [];
  const seen = new Set<string>();
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()) {
    const doc = parseYaml(readFileSync(join(dir, file), "utf8")) as Record<string, unknown[]>;
    for (const [head, list] of Object.entries(doc)) {
      for (const raw of list) {
        const c = { head, ...(raw as object) } as BenchCase;
        const name = `${head}/${c.id}`;
        const problem = validate(c);
        if (problem) throw new Error(`${file}: ${name}: ${problem}`);
        if (seen.has(name)) throw new Error(`${file}: duplicate ${name}`);
        seen.add(name);
        cases.push(c);
      }
    }
  }
  return cases;
}

function validate(c: BenchCase): string | undefined {
  if (typeof c.id !== "string" || !EXAMPLE_ID.test(c.id) || c.id.length > EXAMPLE_ID_MAX)
    return `bad id ${JSON.stringify(c.id)}`;
  if (c.role !== "bench") return "role must be bench";
  if (c.expr === undefined) return "no expr";
  if (c.bench === undefined) return "no bench block";
  const p = c.bench.precision;
  if (p !== "exact" && p !== "machine" && !(Number.isInteger(p) && p > 0)) return `bad precision ${JSON.stringify(p)}`;
  if (c.bench.sample !== undefined && c.expected !== undefined) return "a sampled case's answer is pinned, not written";
  if (c.bench.tier !== undefined && !SUITES.deep.includes(c.bench.tier))
    return `bad tier ${JSON.stringify(c.bench.tier)}`;
  return undefined;
}

/**
 * Substitute each case's seeded draws: the inputs every system runs, each a `List` for a
 * sample. Calls take them in turn; the gate checks the first.
 */
export function concretise(c: BenchCase): ConcreteCase {
  const sample = c.bench.sample;
  if (sample === undefined) return { name: `${c.head}/${c.id}`, case: c, inputs: [c.expr] };
  // One draw sequence, cut into lists: the first list is the same whatever `batches` says.
  const values = drawSample({ ...sample, count: sample.count * (sample.batches ?? 1) }).map((binding) =>
    substitute(c.expr, binding),
  );
  const inputs: MathJSON[] = [];
  for (let i = 0; i < values.length; i += sample.count) inputs.push(["List", ...values.slice(i, i + sample.count)]);
  return { name: `${c.head}/${c.id}`, case: c, inputs };
}
