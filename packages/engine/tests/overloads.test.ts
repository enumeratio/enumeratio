import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { defineOverload, type Overload } from "../src/index.ts";

// Two packages extending one native head: a carrier row and a general one.
const carrier = (ce: ComputeEngine): Overload => ({
  package: "carriers",
  signature: "(value) -> value",
  on: ["Wrapped"],
  arity: 1,
  native: (op) => op.isInteger !== false,
  evaluate: (ops) => ce.box(["Wrapped", ["Fibonacci", (ops[0]!.json as unknown as unknown[])[1]]] as never).evaluate(),
});
const general = (ce: ComputeEngine): Overload => ({
  package: "general",
  signature: "(number, any?) -> any",
  unless: ["Wrapped"],
  when: (ops) => ops.length === 2 || ops[0]!.isInteger === false,
  native: (op) => op.isInteger !== false,
  evaluate: (ops) =>
    ce.box(
      ops.length === 2
        ? ["Tuple", "'poly'", ...ops.map((op) => op.json)]
        : (["Tuple", "'real'", ops[0]!.json] as never),
    ),
});

const engine = (rows: readonly ((ce: ComputeEngine) => Overload)[]): ComputeEngine => {
  const ce = new ComputeEngine();
  ce.declare("Wrapped", { signature: "(any) -> value" });
  for (const row of rows) defineOverload(ce, "Fibonacci", row(ce));
  return ce;
};
const answers = (ce: ComputeEngine): unknown[] =>
  [
    ["Fibonacci", 10],
    ["Fibonacci", 1.5],
    ["Fibonacci", 7, "x"],
    ["Fibonacci", ["Wrapped", 6]],
    ["Fibonacci", "'s'"],
  ].map((expr) => ce.box(expr as never).evaluate().json);

test("declare order doesn't matter: same signature, same answers", () => {
  const ab = engine([carrier, general]);
  const ba = engine([general, carrier]);
  const signature = (ce: ComputeEngine): string =>
    String((ce.lookupDefinition("Fibonacci") as { operator: { signature: unknown } }).operator.signature);
  expect(signature(ab)).toBe(signature(ba));
  expect(answers(ab)).toEqual(answers(ba));
  expect(answers(ab).slice(0, 4)).toEqual([55, ["Tuple", "'real'", 1.5], ["Tuple", "'poly'", 7, "x"], ["Wrapped", 8]]);
});

test("the head's own handler only sees what the gates let through", () => {
  // A string boxes (the carrier row's `value` admits it), no row answers, and the gates keep it
  // from the integer recurrence: it stays unevaluated.
  const [, , , , s] = answers(engine([carrier, general]));
  expect(s).toEqual(["Fibonacci", "'s'"]);
});

test("overrides puts a row ahead of another package's", () => {
  const ce = new ComputeEngine();
  const row = (pkg: string, overrides?: string[]): Overload => ({
    package: pkg,
    signature: "(real) -> any",
    when: (ops) => ops[0]!.isInteger === false,
    ...(overrides ? { overrides } : {}),
    evaluate: () => ce.string(pkg),
  });
  defineOverload(ce, "Fibonacci", row("a"));
  defineOverload(ce, "Fibonacci", row("b", ["a"]));
  expect(ce.box(["Fibonacci", 1.5]).evaluate().json).toBe("'b'");
});
