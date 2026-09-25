import { expect, test } from "vite-plus/test";
import { pqaExpansion } from "../src/continued-fraction.ts";

// Pure bigint arithmetic, no engine — mirrors convergents.test.ts's approach (see
// tests/backlog.test.ts for the engine-level ContinuedFractionK coverage).

test("pqaExpansion: sqrt(13) = [3; 1,1,1,1,6,...]", () => {
  expect(pqaExpansion(0n, 1n, 1n, 13n)).toEqual({ pre: [3n], period: [1n, 1n, 1n, 1n, 6n] });
});

test("pqaExpansion: sqrt(2) = [1; 2,2,2,...]", () => {
  expect(pqaExpansion(0n, 1n, 1n, 2n)).toEqual({ pre: [1n], period: [2n] });
});

test("pqaExpansion: the golden ratio (1+sqrt5)/2 is purely periodic, all 1s", () => {
  expect(pqaExpansion(1n, 1n, 2n, 5n)).toEqual({ pre: [], period: [1n] });
});

test("pqaExpansion: (3+sqrt7)/2 = [2; 1,4,1,1,...]", () => {
  expect(pqaExpansion(3n, 1n, 2n, 7n)).toEqual({ pre: [2n], period: [1n, 4n, 1n, 1n] });
});

test("pqaExpansion: 1+sqrt(2), a rational shift of sqrt(2)", () => {
  expect(pqaExpansion(1n, 1n, 1n, 2n)).toEqual({ pre: [], period: [2n] });
});

/** a0 + 1/(a1 + 1/(a2 + ...)), folded right to left — a from-scratch reference evaluator. */
function reassemble(terms: readonly bigint[]): number {
  let value = Number(terms[terms.length - 1]);
  for (let i = terms.length - 2; i >= 0; i--) value = Number(terms[i]) + 1 / value;
  return value;
}

test("pqaExpansion: a negative radical coefficient, 1 - sqrt(3)", () => {
  // floor(1 - 1.732...) = -1, then a longer pre-period before it locks into [1,2].
  const { pre, period } = pqaExpansion(1n, -1n, 1n, 3n);
  expect(pre[0]).toBe(-1n);
  expect(period.length).toBeGreaterThan(0);
  const terms = [...pre, ...period, ...period, ...period, ...period, ...period, ...period];
  expect(reassemble(terms)).toBeCloseTo(1 - Math.sqrt(3), 6);
});

test("pqaExpansion: every case's pre+period reassembles (via doubles) to the source value", () => {
  const cases: readonly [bigint, bigint, bigint, bigint, number][] = [
    [0n, 1n, 1n, 13n, Math.sqrt(13)],
    [0n, 1n, 1n, 2n, Math.sqrt(2)],
    [3n, 1n, 2n, 7n, (3 + Math.sqrt(7)) / 2],
    [1n, 1n, 1n, 2n, 1 + Math.sqrt(2)],
  ];
  for (const [a, b, c, d, expected] of cases) {
    const { pre, period } = pqaExpansion(a, b, c, d);
    const cycles = Array.from({ length: 20 }, () => period).flat();
    expect(reassemble([...pre, ...cycles])).toBeCloseTo(expected, 6);
  }
});
