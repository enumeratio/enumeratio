// The interim catalogue (design/benchmarking.md §3): `catalogue/*.yaml`, each a map from head
// to its cases, in the example shape plus `bench`. They move into each head's own
// `reference/<Head>.yaml` as `role: bench` examples once the reference loader lands.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXAMPLE_ID, EXAMPLE_ID_MAX, parseYaml } from "@enumeratio/entry";
import type { MathJSON } from "@enumeratio/oracle/src";
import { drawSample, substitute } from "./random.ts";
import type { BenchCase, ConcreteCase } from "./types.ts";

export const CATALOGUE_DIR = fileURLToPath(new URL("../catalogue/", import.meta.url));

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
  if (c.bench.sample === undefined && c.expected === undefined) return "no expected";
  return undefined;
}

/** Substitute each case's seeded draws, giving the concrete inputs every system runs. */
export function concretise(c: BenchCase): ConcreteCase {
  const inputs: MathJSON[] =
    c.bench.sample === undefined ? [c.expr] : drawSample(c.bench.sample).map((binding) => substitute(c.expr, binding));
  return { name: `${c.head}/${c.id}`, case: c, inputs };
}
