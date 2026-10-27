// A literal divisor is lowered exactly (`x / 6`, not `x * 0.1666…`; before compute-engine 0.170 the
// Rational coefficient went out as a double), so an integer statistic stays an integer however large its
// operand. Every compiled definition that divides by a literal other than a power of two must equal the
// interpreter on subjects with big entries; a regression in either the compiler or a definition shows up here.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { ALL_STATISTICS } from "../src/statistics/all.ts";
import { compiledStatistic } from "../src/statistics/compiled.ts";
import { interpretDefinition } from "../src/statistics/declare.ts";
import { signatureOf } from "../src/statistics/types.ts";

const ce = bareEngine();
const list = (values: readonly unknown[]): unknown => ["List", ...values];

/** Whether `expr` divides by a literal that is not a power of two (so `1/literal` is inexact). */
function dividesByInexactLiteral(expr: unknown): boolean {
  if (!Array.isArray(expr)) return false;
  if (expr[0] === "Divide" && typeof expr[2] === "number" && !Number.isInteger(Math.log2(Math.abs(expr[2]))))
    return true;
  return expr.some(dividesByInexactLiteral);
}

const AFFECTED = ALL_STATISTICS.filter((d) => dividesByInexactLiteral(d.expr));

const ones = (n: number): number[] => Array.from({ length: n }, () => 1);
const block = (from: number, n: number): number[] => Array.from({ length: n }, (_, i) => from + i);

// Subjects with large entries or many of them (the divided product grows with either).
const SUBJECTS: Record<string, unknown[]> = {
  IntegerPartition: [
    [100],
    [1000, 7],
    [123456, 3, 1],
    [5000, 5000],
    [20, 19, 18, 17, 16, 15],
    [3, 3, 3, 2, 2, 1, 1, 1],
    [10 ** 6, 10 ** 5, 10 ** 4],
    ones(16),
    ones(19),
    ones(100),
    [50, ...ones(150)],
  ].map(list),
  SetPartition: [[block(1, 16)], [block(1, 19)], [block(1, 300)], [block(1, 120), block(121, 5)], [block(1, 700)]].map(
    (blocks) => list(blocks.map(list)),
  ),
};

for (const definition of AFFECTED) {
  test(`${signatureOf(definition)}: compiled agrees with interpreted on large subjects`, () => {
    const subjects = SUBJECTS[definition.on];
    expect(subjects, `no large subjects for ${definition.on}`).toBeDefined();
    const run = compiledStatistic(ce, definition);
    if (run === undefined) return; // not compiled: nothing to check
    for (const subject of subjects!) {
      const answer = run(subject);
      if (answer === undefined) continue;
      expect(answer, JSON.stringify(subject).slice(0, 80)).toEqual(
        interpretDefinition(ce, definition, ce.box(subject as never)).json,
      );
    }
  });
}

// `n(n-1)(n-2) / 6` at n = 16 was 559.9999999999999, so the compiled code declined and the interpreter answered.
test("compiled code answers where the divided product is not exactly representable", () => {
  const definition = AFFECTED.find((d) => d.head === "InvariantThreeElementSubsetCount")!;
  expect(compiledStatistic(ce, definition)!(list(ones(16)))).toBeDefined();
});
