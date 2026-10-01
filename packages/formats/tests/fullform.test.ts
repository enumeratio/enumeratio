import { ComputeEngine } from "@cortex-js/compute-engine";
import { type MathJsonExpression, parseEpsil } from "@cortex-js/compute-engine/epsil";
import { expect, test } from "vite-plus/test";
import { toFullForm } from "../src/fullform.ts";

const ce = new ComputeEngine();
const uncanonical = (json: unknown) => ce.box(json as never, { form: "raw" }).json;
const strip = (json: unknown): unknown =>
  JSON.parse(JSON.stringify(json, (k, v: unknown) => (k === "sourceOffsets" ? undefined : v)));

const CASES: [MathJsonExpression, string][] = [
  [["Take", ["List", "a", "b", "c", "d", "e", "f"], 4], "Take(List(a, b, c, d, e, f), 4)"],
  [["Add", "x", ["Negate", 1]], "Add(x, Negate(1))"],
  [["Power", "x", -1], "Power(x, -1)"],
  [["List"], "List()"],
  // `e` and `i` stay the symbols they are: the tree is printed before any canonicalisation.
  [["List", "e", "i", "ExponentialE"], "List(e, i, ExponentialE)"],
  // Library names keep their MathJSON spelling: not `nothing`, `exponentialE`.
  [["List", "Nothing", "Pi"], "List(Nothing, Pi)"],
  // Shorthand atoms, read as MathJSON reads them.
  [["f", "'abc'", "3", "hello world"], 'f("abc", 3, "hello world")'],
  [["f", { str: "\\(a)" }], 'f("\\\\(a)")'],
  [["f", { num: "1001000000000040037000000000111" }], "f(1001000000000040037000000000111)"],
  [["f", "NaN", "if"], "f(`NaN`, `if`)"],
  [[["Derivative", "f"], "x"] as unknown as MathJsonExpression, "Apply(Derivative(f), x)"],
];

test.each(CASES)("FullForm of %j", (json, printed) => {
  expect(toFullForm(json, ce)).toBe(printed);
});

// Epsil reads `Apply(h, x)` as `Apply`: a non-symbol head is the one spelling that changes.
test.each(CASES.filter(([json]) => !Array.isArray((json as unknown as unknown[])[0])))(
  "%j reads back uncanonicalised",
  (json) => {
    const [back, errors] = parseEpsil(toFullForm(json, ce));
    expect(errors).toEqual([]);
    expect(uncanonical(strip(back))).toEqual(uncanonical(json));
  },
);
