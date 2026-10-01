import { ComputeEngine } from "@cortex-js/compute-engine";
import { compile } from "@cortex-js/compute-engine/compile";
import { expect, test } from "vite-plus/test";
import { widenSignature, wrapOperator } from "../src/index.ts";

// Two packages widening one head: a structures-style `(any, any?) -> any` with a handler for
// a non-real operand (floors the parts of a complex), and an analytic-style real-or-infinity
// carrier (adds `~oo`, answers it).
const generic = (ce: ComputeEngine, head: string): void => {
  widenSignature(ce, head, "(any, any?) -> any");
  wrapOperator(
    ce,
    [head],
    (ops) => ops[0]?.im !== 0 && ops[0]?.im !== undefined && !Number.isNaN(ops[0].im),
    () => (ops) =>
      ce.function("Complex", [ce.number(Math.floor(ops[0]!.re)), ce.number(Math.floor(ops[0]!.im))]).evaluate(),
    { min: 1, max: 2 },
  );
};
const infinity = (ce: ComputeEngine, head: string): void => {
  widenSignature(ce, head, "(real | signed_infinity | ~oo) -> integer | signed_infinity | ~oo", () => true);
  wrapOperator(
    ce,
    [head],
    (ops) => ops[0]?.json === "ComplexInfinity",
    () => () => ce.symbol("ComplexInfinity"),
    1,
  );
};

const orders = {
  "generic then infinity": [generic, infinity],
  "infinity then generic": [infinity, generic],
} as const;

const inputs = [
  ["Complex", 2.3, -2.718],
  ["Add", ["Rational", 23, 10], ["Multiply", ["Complex", 0, -1], "ExponentialE"]],
  ["Negate", ["Complex", 1.5, 0.5]],
  "ComplexInfinity",
  2.5,
  ["Rational", -7, 2],
  "x",
];

const answers = (order: readonly ((ce: ComputeEngine, head: string) => void)[]) => {
  const ce = new ComputeEngine();
  for (const head of ["Floor", "Ceil"]) for (const declare of order) declare(ce, head);
  return ["Floor", "Ceil"].flatMap((head) =>
    inputs.map((input) => {
      const expr = ce.box([head, input] as never);
      return { evaluate: expr.evaluate().json, N: expr.N().json };
    }),
  );
};

test("declaration order does not change what Floor and Ceil answer", () => {
  const [first, second] = Object.values(orders).map(answers);
  expect(first).toEqual(second);
});

test.each(Object.entries(orders))("%s: complex and infinite operands both evaluate", (_, order) => {
  const ce = new ComputeEngine();
  for (const declare of order) declare(ce, "Floor");
  expect(ce.box(["Floor", ["Complex", 2.3, -2.718]]).evaluate().json).toEqual(["Complex", 2, -3]);
  expect(ce.box(["Floor", ["Complex", 2.3, -2.718]]).N().json).toEqual(["Complex", 2, -3]);
  expect(ce.box(["Floor", "ComplexInfinity"]).evaluate().json).toEqual("ComplexInfinity");
});

test("compiled Floor agrees with evaluate on a real operand", () => {
  for (const order of Object.values(orders)) {
    const ce = new ComputeEngine();
    for (const declare of order) declare(ce, "Floor");
    const expr = ce.box(["Floor", ["Add", "x", 0.5]]);
    const compiled = compile(expr);
    expect(compiled.run).toBeTypeOf("function");
    const run = compiled.run as (scope: { x: number }) => number;
    for (const x of [2.3, -2.7, 4]) {
      expect(run({ x })).toBe(ce.box(["Floor", ["Add", x, 0.5]]).evaluate().re);
    }
  }
});

test("widening a head never narrows it, and a covered request is a no-op", () => {
  const ce = new ComputeEngine();
  widenSignature(ce, "Floor", "(any, any?) -> any");
  const before = String(ce.lookupDefinition("Floor") && (ce.lookupDefinition("Floor") as any).operator.signature);
  widenSignature(ce, "Floor", "(real) -> integer");
  expect(String((ce.lookupDefinition("Floor") as any).operator.signature)).toBe(before);
});
