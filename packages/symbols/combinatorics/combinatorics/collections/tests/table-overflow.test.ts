// A compiled table that stops at the edge of the safe integers is past what doubles hold, and a family
// that declines there says so at once rather than interpret the table in minutes. Any other failure of the
// compiled table leaves it to the interpreter, as before.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { type EpsilFamily, familyHash, kernelOn } from "../src/families/epsil.ts";
import { needsBigint } from "../src/families/types.ts";

const family: EpsilFamily = {
  head: "SyntheticTable",
  kind: "scalar",
  paramCount: 1,
  params: ["_n"],
  declinePastDoubles: true,
  epsil: {
    tables: ["List", 1, 2],
    count: ["At", "_tables", 1],
    unrank: "_r",
    rank: 0,
    valid: ["Equal", "_x", ["At", "_tables", 1]],
  },
};

/** A kernel whose compiled table throws `error`, and how many times the table was asked for in doubles. */
function throwing(error: Error) {
  const generated = {
    [family.head]: {
      hash: familyHash(family),
      tables: () => {
        throw error;
      },
    },
  };
  const asked: string[] = [];
  const kernel = kernelOn(bareEngine(), family, generated, {
    onTables: (_, precision) => asked.push(precision),
  });
  return { kernel, doubles: () => asked.filter((p) => p === "double").length };
}

const overflow = new RangeError(
  "Multiply: 1.9e17 is beyond the safe integer range of compiled code (±9007199254740991); evaluate with the interpreter for the exact result",
);

test("a table that leaves the safe integers declines at once, saying the table doesn't fit", () => {
  const { kernel } = throwing(overflow);
  let error: unknown;
  try {
    kernel.valid(1, [3]);
  } catch (caught) {
    error = caught;
  }
  expect(needsBigint(error)).toBe(true);
  expect((error as Error).message).toMatch(/table doesn't fit in doubles/);
});

test("any other failure of the compiled table is the interpreter's, as before", () => {
  for (const error of [new RangeError("Invalid array length"), new TypeError("x is not iterable")]) {
    const { kernel, doubles } = throwing(error);
    expect(kernel.valid(1, [3])).toBe(true);
    expect(kernel.valid(2, [3])).toBe(false);
    // The failure is kept: the table is asked for in doubles once.
    expect(doubles()).toBe(1);
  }
});

test("a blown stack is no verdict on the params: the table is asked for again", () => {
  const { kernel, doubles } = throwing(new RangeError("Maximum call stack size exceeded"));
  expect(kernel.valid(1, [3])).toBe(true);
  expect(kernel.valid(1, [3])).toBe(true);
  expect(doubles()).toBe(2);
});
