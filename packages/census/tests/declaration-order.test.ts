// BL-13: a head several packages extend answers the same whichever declares first. Each pair
// is declared in every order we can build from the real list (a package moved earlier or
// later than its usual slot), and every order answers the same calls the same way.
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { PACKAGE_DECLARATIONS } from "../src/engine.ts";

type Entry = (typeof PACKAGE_DECLARATIONS)[number];

const indexOf = (pkg: string): number => PACKAGE_DECLARATIONS.findIndex(([name]) => name === pkg);

/** The usual list with the `pkg` entry moved to `to` (an index into the list without it). */
const moved = (pkg: string, to: number): readonly Entry[] => {
  const rest = PACKAGE_DECLARATIONS.filter(([name]) => name !== pkg);
  return rest.toSpliced(to, 0, PACKAGE_DECLARATIONS[indexOf(pkg)]!);
};

const engineWith = (order: readonly Entry[]): ComputeEngine => {
  const ce = new ComputeEngine();
  for (const [, declare] of order) declare(ce);
  return ce;
};

const answers = (ce: ComputeEngine, calls: readonly unknown[]): unknown[] =>
  calls.map((call) => {
    const expr = ce.box(call as never);
    return { evaluate: expr.evaluate().json, type: String(expr.type) };
  });

/** One test per order, each against the usual one: two engines apiece keeps a test well under its budget. */
const compare = (title: string, calls: readonly unknown[], orders: Record<string, readonly Entry[]>): void => {
  let usual: unknown[] | undefined;
  for (const [label, order] of Object.entries(orders)) {
    if (label === "usual") continue;
    test(`${title}: ${label}`, () => {
      usual ??= answers(engineWith(orders.usual!), calls);
      expect(answers(engineWith(order), calls), `${label} vs usual`).toEqual(usual);
    });
  }
};

const first = (pkg: string): number => indexOf(pkg) - 1;

const nt = indexOf("number-theory");
compare(
  "adeles' and number-theory's Fibonacci rows answer the same in any order",
  [
    ["Fibonacci", 10],
    ["Fibonacci", 2.5],
    ["Fibonacci", 7, "x"],
    ["Fibonacci", ["Rational", 1, 2], "x"],
    ["Fibonacci", ["ProfiniteNumber", 3, 5]],
    ["LucasL", ["ProfiniteNumber", 3, 5]],
    ["Fibonacci", "'s'"],
  ],
  {
    usual: PACKAGE_DECLARATIONS,
    "adeles before number-theory": moved("adeles", nt - 1),
    "adeles last": moved("adeles", PACKAGE_DECLARATIONS.length),
    "number-theory after adeles": moved("number-theory", indexOf("adeles")),
  },
);

const permutation = ["Permutation", ["List", 2, 3, 1]];
compare(
  "modular's and combinatorics' Inverse rows answer the same in any order",
  [
    ["Inverse", permutation],
    ["Inverse", ["ModularMatrix", 1, 1, 0, 1]],
    ["Inverse", ["Matrix", ["List", ["List", 1, 2], ["List", 3, 4]]]],
    ["Inverse", 4],
    ["Inverse", "'s'"],
  ],
  {
    usual: PACKAGE_DECLARATIONS,
    "modular last": moved("modular", PACKAGE_DECLARATIONS.length),
    "modular before combinatorics": moved("modular", indexOf("combinatorics")),
    "modular first": moved("modular", first("groupalgebra")),
  },
);

compare(
  "modular's ContinuedFraction wrapper and number-theory's widening answer the same in any order",
  [
    ["ContinuedFraction", ["Rational", 355, 113]],
    ["ContinuedFraction", ["Sqrt", 7]],
    ["ContinuedFraction", ["Rational", 355, 113], 2],
    ["ContinuedFraction", "Pi", 4],
    ["ContinuedFraction", ["List", 1, 2, 3]],
    ["ContinuedFraction", "'s'"],
  ],
  {
    usual: PACKAGE_DECLARATIONS,
    "modular after number-theory": moved("modular", nt),
    "modular last": moved("modular", PACKAGE_DECLARATIONS.length),
  },
);
