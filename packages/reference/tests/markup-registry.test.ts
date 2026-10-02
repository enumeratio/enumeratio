// Markup to value through a registry (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §3):
// an example's `notatio` form, read with no engine and evaluated in one that declares only
// what the markup names, means what the example means in the full engine; and so does the
// same call qualified by its package's namespace (`Analytic.HurwitzZeta(…)`). The standard run
// checks the first few examples of each sampled head; `DEEP_TESTS=1` checks all of them.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareEvaluation } from "@enumeratio/evaluation/src";
import { markupOf, readMarkupText } from "@enumeratio/formats/markup";
import { createRegistryResolver, manifestRegistry, namespaceOf } from "@enumeratio/manifest";
import { expect, test } from "vite-plus/test";
import { declaredEngine, LIBRARIES } from "../scripts/engines.ts";
import { loadReferenceData, PACKAGES } from "../src/node.ts";

const SAMPLE = new Set(["HurwitzZeta", "Binomial", "Permutations", "IntegerMod", "Quaternion", "Floor", "Fibonacci"]);
const deep = process.env.DEEP_TESTS === "1";
const PER_HEAD = deep ? Infinity : 12;

// Digits past a double's can differ with the precision an earlier evaluation left behind.
const rounded = (x: unknown): unknown => {
  if (Array.isArray(x)) return x.map(rounded);
  if (x !== null && typeof x === "object" && typeof (x as { num?: unknown }).num === "string")
    return Number((x as { num: string }).num).toPrecision(15);
  if (typeof x === "number") return x.toPrecision(15);
  return x;
};

const value = (ce: ComputeEngine, json: unknown): unknown => {
  try {
    return rounded(ce.box(json as never).evaluate({ materialization: true } as never).json);
  } catch (error) {
    return `throws: ${(error as Error).message}`;
  }
};

test(
  "an example's markup evaluates, through the registry, as the example does",
  { timeout: deep ? 600_000 : 120_000 },
  async () => {
    const full = declaredEngine();
    const resolver = createRegistryResolver(manifestRegistry(LIBRARIES));
    const differ: string[] = [];
    let checked = 0;
    for (const h of loadReferenceData(PACKAGES).heads) {
      if (!SAMPLE.has(h.head)) continue;
      // A row in triage isn't on the page, so it has no markup there.
      for (const example of h.entry.examples.filter((e) => e.role !== "triage").slice(0, PER_HEAD)) {
        const markup = markupOf(example.expr as never, { width: Infinity });
        const { json, errors } = readMarkupText(markup);
        expect(errors).toEqual([]);
        const expected = value(full, example.expr);
        const spellings: [string, unknown][] = [["bare", json]];
        if (Array.isArray(json) && json[0] === h.head && LIBRARIES.some((l) => l.name === h.package))
          spellings.push(["qualified", ["MemberCall", namespaceOf(h.package), `'${h.head}'`, ...json.slice(1)]]);
        for (const [spelling, expr] of spellings) {
          const ce = new ComputeEngine();
          declareEvaluation(ce);
          const { unresolved } = await resolver.ensure(ce, expr);
          checked++;
          if (unresolved.length > 0 || JSON.stringify(value(ce, expr)) !== JSON.stringify(expected))
            differ.push(`${h.package}/${h.head}/${example.id} (${spelling})`);
        }
      }
    }
    expect(checked).toBeGreaterThan(deep ? 300 : 50);
    expect(differ).toEqual([]);
  },
);
