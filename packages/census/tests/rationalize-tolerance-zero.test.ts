// #113: `Rationalize(x, 0)` (packages/collections/src/arith-heads.ts) and
// `Rationalize(x, dx)` for a concrete positive dx (packages/analytic/src/precision-113.ts,
// PR #146) are two separate `wrapOperator` attachments on the same head, with disjoint
// `applies` gates (dx === 0 vs dx > 0). `wrapOperator` chains by capture order -- whichever
// attaches second sees the other as its `native` fallback -- so this checks both heads
// answer correctly regardless of which package declares first, not just in `fullEngine`'s
// own declaration order (analytic, then collections).
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAnalytic } from "@enumeratio/analytic/src";
import { declareCollections } from "@enumeratio/collections/src";
import { expect, test } from "vite-plus/test";

function engineWith(order: readonly ((ce: ComputeEngine) => void)[]): ComputeEngine {
  const ce = new ComputeEngine();
  for (const declare of order) declare(ce);
  return ce;
}

for (const [label, order] of [
  ["analytic then collections", [declareAnalytic, declareCollections]],
  ["collections then analytic", [declareCollections, declareAnalytic]],
] as const) {
  test(`Rationalize(x, dx) and Rationalize(x, 0) both answer, declared ${label}`, () => {
    const ce = engineWith(order);

    const tolerance = ce.box(["Rationalize", "Pi", 0.01] as never).evaluate().json;
    expect(tolerance).toEqual(["Rational", 22, 7]);

    const exact = ce.box(["Rationalize", 0.1, 0] as never).evaluate().json;
    expect(Array.isArray(exact) && exact[0] === "Rational", JSON.stringify(exact)).toBe(true);
    // The denominator 2^55 is past 2^53, so it serialises as {num: "…"}.
    const int = (j: unknown): number =>
      Number(typeof j === "object" && j !== null ? (j as { num: string }).num : j);
    const [, p, q] = exact as [string, unknown, unknown];
    expect(int(p) / int(q)).toBe(0.1);

    // An already-exact x is returned unchanged at dx = 0, same as at dx > 0.
    expect(ce.box(["Rationalize", 2, 0] as never).evaluate().json).toBe(2);
  });
}
