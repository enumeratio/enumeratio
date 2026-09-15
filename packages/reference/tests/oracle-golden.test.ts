import { ComputeEngine } from "@cortex-js/compute-engine";
import {
  DIVERGENCE_KINDS,
  type Divergence,
  emit,
  type Leaf,
  type MathJSON,
  reduce,
  symbolic,
} from "@enumeratio/oracle/src";
import { toWolfram } from "@enumeratio/wolfram/src";
import { expect, test } from "vite-plus/test";
import { entries } from "../src/index.ts";
import catalogue from "../golden/oracle/divergences.json" with { type: "json" };
import sweep from "../golden/oracle/wolfram-sweep.json" with { type: "json" };

// The goldens a Wolfram scan (scripts/oracle-scan.ts) writes. Neither is regenerated here — that
// needs a kernel — so these are consistency checks: the sweep's own arithmetic, the rule
// that every disagreement carries a classification, and that each catalogued row still
// describes the corpus it was cut from.

const divergences = catalogue as readonly Divergence[];
const cases = sweep.cases as readonly { id: string; source: string; verdict: string }[];

test("the sweep summary is the sweep", () => {
  const tally: Record<string, number> = {};
  for (const c of cases) tally[c.verdict] = (tally[c.verdict] ?? 0) + 1;
  expect(tally).toEqual(sweep.summary);
  // A scan that produced nothing readable would be a broken kernel, not a golden.
  expect(sweep.summary.agree).toBeGreaterThan(600);
});

test("every disagreement is catalogued, and nothing else is", () => {
  const disagreeing = cases.filter((c) => c.verdict === "disagree").map((c) => c.id);
  expect(divergences.map((d) => d.id)).toEqual(disagreeing);
});

test("every divergence is classified, with a note", () => {
  for (const d of divergences) {
    expect(d.kind, d.id).not.toBe("unclassified");
    expect(Object.keys(DIVERGENCE_KINDS), d.id).toContain(d.kind);
    expect(d.note.length, d.id).toBeGreaterThan(20);
  }
});

test("each catalogued row still describes the corpus example it names", () => {
  const ce = new ComputeEngine();
  const leaf = (expr: MathJSON): Leaf => {
    try {
      const boxed = ce.box(expr as Parameters<ComputeEngine["box"]>[0]).N();
      const name = (boxed as { symbol?: unknown }).symbol;
      if (name === "True") return true;
      if (name === "False") return false;
      const { re, im } = boxed;
      if (typeof re === "number" && Number.isFinite(re)) {
        return typeof im === "number" && im !== 0 && Number.isFinite(im) ? { re, im } : re;
      }
    } catch {
      // symbolic
    }
    return symbolic(expr);
  };
  const examples = new Map<string, (typeof entries)[number]["examples"][number]>(
    entries.flatMap((entry) =>
      entry.examples
        .filter((example) => example.aspirational !== true)
        .map((example, index) => [`${entry.name}#${index + 1}`, example] as const),
    ),
  );
  for (const d of divergences) {
    const example = examples.get(d.id);
    expect(example, d.id).toBeDefined();
    expect(d.expr, d.id).toEqual(example?.expr);
    // The page for that example shows a "differs from Wolfram" chip; the catalogue is
    // where the classification lives, the reference is where a reader meets it.
    expect(example?.divergence?.wolfram, d.id).toBeTruthy();
    expect(d.ours, d.id).toEqual(reduce(example?.expected as MathJSON, leaf));
    expect(d.source, d.id).toBe(toWolfram(d.expr as never));
    expect(emit(d.expr, "wolfram"), d.id).toEqual({ ok: true, source: d.source });
  }
});
