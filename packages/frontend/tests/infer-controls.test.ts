import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { parseExpression } from "@enumeratio/formats/expression";
import { afterAll, expect, test } from "vite-plus/test";
import {
  freeSymbols,
  type HeadSignature,
  inferControls,
  inferFromSignature,
  type InferContext,
  paramsOf,
} from "../src/infer-controls.ts";
import { tryItOf } from "../src/try-it.ts";
import { choiceEntries, parseControls } from "../src/manipulate.ts";

// What each expression's free symbols get as controls: golden JSON compared with
// `toEqual` (AGENTS.md), regenerated with `UPDATE_INFER_CONTROLS=1 vp test` after an
// intended change.
const ce = new ComputeEngine();
ce.declare("copies", "integer");
ce.assume(ce.box(["Greater", "copies", 0]));
ce.declare("depth", "integer");
ce.assume(ce.box(["GreaterEqual", "depth", 0]));
ce.declare("deficit", "integer");
ce.assume(ce.box(["LessEqual", "deficit", 0]));
ce.declare("offset", "integer");
ce.declare("on", "boolean");
ce.declare("label", "string");
ce.declare("w", "complex");
ce.declare("height", "real");
ce.assume(ce.box(["Greater", "height", 0]));
ce.declare("gain", "real");

const SIX = "'a' | 'b' | 'c' | 'd' | 'e' | 'f'";

const CASES: Record<string, { src: string; ctx?: InferContext }> = {
  "free symbol is a real": { src: "a * Sin(b)" },
  "bound variable of a plot is skipped": { src: "Plot(Sin(a * x), (x, 0, 10))" },
  "bound variable of a sum is skipped": { src: "Sum(k^m, (k, 1, 10))" },
  "bound index of a sum is skipped, tuple form": { src: "Sum(k * x, (k, 1, 3))" },
  "bound indices of nested iterators are skipped": { src: "Sum(Product(j * x, (j, 1, 2)), (k, 1, 3))" },
  "bound variable of a table, count form": { src: "Table(k * x, (k, 3))" },
  "a plot's body point is not an iterator": { src: "ParametricPlot((a, b), (t, 0, 1))" },
  "typed integer": { src: "offset + 1", ctx: { engine: ce } },
  "positive integer clamps at 1": { src: "copies", ctx: { engine: ce } },
  "non-negative integer clamps at 0": { src: "depth", ctx: { engine: ce } },
  "non-positive integer clamps at 0 from above": { src: "deficit", ctx: { engine: ce } },
  "positive real stays off zero": { src: "height", ctx: { engine: ce } },
  "declared real": { src: "gain", ctx: { engine: ce } },
  boolean: { src: "on", ctx: { engine: ce } },
  string: { src: "label", ctx: { engine: ce } },
  complex: { src: "w", ctx: { engine: ce } },
  "enum of five or fewer is a setter bar": { src: "c", ctx: { types: { c: "'a' | 'b' | 'c'" } } },
  "enum of more than five is a popup menu": { src: "c", ctx: { types: { c: SIX } } },
  "numeric enum": { src: "c", ctx: { types: { c: "2 | 3 | 5 | 7" } } },
  "several symbols, in order of appearance": { src: "b + a * copies", ctx: { engine: ce } },
  "bound names are skipped": { src: "a + b", ctx: { bound: new Set(["a"]) } },
  "names restrict the symbols": { src: "a + b", ctx: { names: ["b"] } },
  "hint range overrides the inferred one": { src: "a", ctx: { hints: { a: { min: 0, max: 5, step: 0.5, start: 2 } } } },
  "hint type overrides the engine": { src: "gain", ctx: { engine: ce, hints: { gain: { type: "integer" } } } },
  "hint choices": { src: "k", ctx: { hints: { k: { choices: [2, 3, 5, 7], start: 5 } } } },
  "control type, compatible": { src: "a", ctx: { hints: { a: { controlType: "Knob" } } } },
  "control type, incompatible with the domain": {
    src: "on",
    ctx: { engine: ce, hints: { on: { controlType: "Slider" } } },
  },
  "control type on a menu": {
    src: "c",
    ctx: { types: { c: "'a' | 'b'" }, hints: { c: { controlType: "PopupMenu" } } },
  },
  "letter conventions off": { src: "n + z" },
  "letter conventions on": { src: "n + z + a", ctx: { letterConventions: true } },
  "the engine beats a letter": { src: "offset", ctx: { engine: ce, letterConventions: true } },
  "a hint beats a letter": { src: "n", ctx: { letterConventions: true, hints: { n: { min: 0, max: 1 } } } },
};

// A head's typed signature lifts the literals at its TYPED positions of a call into controls.
const SIGNATURES: Record<string, { src: string; signature: HeadSignature }> = {
  "signature: typed count, any positions stay": {
    src: "IntegerPartitions(8)",
    signature: {
      head: "IntegerPartitions",
      parameters: [
        { name: "n", type: "integer" },
        { name: "k", type: "any" },
        { name: "parts", type: "any" },
      ],
    },
  },
  "signature: any is not lifted": {
    src: "IntegerPartitions(8, 3)",
    signature: { head: "IntegerPartitions", parameters: [{ type: "any" }, { type: "any" }] },
  },
  "signature: unnamed parameters get p<i>": {
    src: "Binomial(10, 3)",
    signature: { head: "Binomial", parameters: [{ type: "integer" }, { type: "integer" }] },
  },
  "signature: a literal past the span stretches it": {
    src: "Fibonacci(30)",
    signature: { head: "Fibonacci", parameters: [{ name: "n", type: "integer" }] },
  },
  "signature: real, and a boolean": {
    src: "Scaled(2.5, True)",
    signature: {
      head: "Scaled",
      parameters: [
        { name: "x", type: "real" },
        { name: "flag", type: "boolean" },
      ],
    },
  },
  "signature: union takes its controllable member": {
    src: "Zeta(2)",
    signature: { head: "Zeta", parameters: [{ name: "s", type: "infinity | real" }] },
  },
  "signature: a complex parameter is not lifted from a real literal": {
    src: "Zeta(2)",
    signature: { head: "Zeta", parameters: [{ name: "s", type: "complex | infinity" }] },
  },
  "signature: a non-integer literal does not fit an integer": {
    src: "Fibonacci(2.5)",
    signature: { head: "Fibonacci", parameters: [{ name: "n", type: "integer" }] },
  },
  "signature: variadic repeats its type": {
    src: "Gcd(12, 18, 24)",
    signature: { head: "Gcd", parameters: [{ name: "n", type: "integer", variadic: true }] },
  },
  "signature: the first call of the head, inside another": {
    src: "Length(IntegerPartitions(6))",
    signature: { head: "IntegerPartitions", parameters: [{ name: "n", type: "integer" }] },
  },
  "signature: a record's cap bounds the size parameter": {
    src: "SymmetricGroup(5)",
    signature: { head: "SymmetricGroup", parameters: [{ name: "n", type: "integer<0..>" }], maxSize: 8 },
  },
  "signature: the cap tightens a type bound and applies to the first integer only": {
    src: "Foo(4, 3)",
    signature: {
      head: "Foo",
      parameters: [
        { name: "n", type: "integer<0..20>" },
        { name: "k", type: "integer" },
      ],
      maxSize: 8,
    },
  },
  "options: a boolean option is a checkbox starting at the example's value": {
    src: "Plot(Sin(x), (x, 0, 6), GridLines -> True)",
    signature: { head: "Plot", parameters: [{ type: "any", variadic: true }], options: { GridLines: [true, false] } },
  },
  "options: a few strings are a setter bar starting at the example's value": {
    src: 'Plot(Exp(x), (x, 0, 5), ScalingFunctions -> "Log")',
    signature: {
      head: "Plot",
      parameters: [{ type: "any", variadic: true }],
      options: { ScalingFunctions: ["Linear", "Log", "Log10", "Log2", "Sqrt"] },
    },
  },
  "options: past the bar's limit a popup menu": {
    src: 'Foo(1, Mode -> "c")',
    signature: {
      head: "Foo",
      parameters: [{ type: "any", variadic: true }],
      options: { Mode: ["a", "b", "c", "d", "e", "f"] },
    },
  },
  "options: symbols written bare are a setter bar over symbols": {
    src: "AdditionTable(R, ElementOrder -> ChineseRemainder)",
    signature: {
      head: "AdditionTable",
      parameters: [{ type: "any", variadic: true }],
      options: { ElementOrder: ["Natural", "ChineseRemainder", "Adic"] },
    },
  },
  "options: a value the record does not list stays as written": {
    src: 'Foo(1, Mode -> "z")',
    signature: { head: "Foo", parameters: [{ type: "any", variadic: true }], options: { Mode: ["a", "b"] } },
  },
  "options: an option the record does not list stays as written": {
    src: "Foo(1, Axes -> True)",
    signature: { head: "Foo", parameters: [{ type: "any", variadic: true }], options: { Mode: ["a", "b"] } },
  },
  "signature: no typed literal": {
    src: "Foo(Bar)",
    signature: { head: "Foo", parameters: [{ name: "n", type: "integer" }] },
  },
};

const GOLDEN = fileURLToPath(new URL("./infer-controls.golden.json", import.meta.url));
const updating = process.env.UPDATE_INFER_CONTROLS === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

for (const [id, { src, ctx }] of Object.entries(CASES)) {
  test(`infers: ${id}`, () => {
    const { json, errors } = parseExpression(src);
    expect(errors).toEqual([]);
    const specs = inferControls(json, ctx);
    fresh[id] = specs;
    // Nothing a golden cannot hold: no functions, no NaN.
    expect(JSON.parse(JSON.stringify(specs))).toEqual(specs);
    if (!updating) expect(specs).toEqual(golden[id]);
  });
}

for (const [id, { src, signature }] of Object.entries(SIGNATURES)) {
  test(`infers: ${id}`, () => {
    const { json, errors } = parseExpression(src);
    expect(errors).toEqual([]);
    const lifted = inferFromSignature(json, signature);
    fresh[id] = lifted;
    expect(JSON.parse(JSON.stringify(lifted))).toEqual(lifted);
    if (!updating) expect(lifted).toEqual(golden[id]);
  });
}

test("a Try it panel: typed tuples and a body over slots", () => {
  const signature = { head: "IntegerPartitions", parameters: [{ name: "n", type: "integer" }] };
  expect(tryItOf(parseExpression("IntegerPartitions(8)").json, signature)).toEqual({
    params: "{{n, 8}, 0, 8, 1, Slider}",
    value: "IntegerPartitions(_n)",
  });
  expect(tryItOf(parseExpression("IntegerPartitions(8)").json, { head: "IntegerPartitions", parameters: [] })).toBe(
    undefined,
  );
});

test("an option's Try it: the rule's value is a slot", () => {
  const signature = { head: "Plot", parameters: [], options: { GridLines: [true, false] } };
  const found = tryItOf(parseExpression("Plot(Sin(x), (x, 0, 6), GridLines -> True)").json, signature);
  expect(found?.params).toBe("{{gridLines, True}, Boolean, Checkbox}");
  expect(found?.value).toContain("_gridLines");
});

test("a string enum is a params tuple over strings, read back as the same choices", () => {
  const [spec] = inferControls(parseExpression("f(m)").json, { types: { m: "'sin' | 'cos'" } });
  expect(paramsOf(spec as never)).toBe('{{m, "sin"}, {"sin", "cos"}, SetterBar}');
  expect(parseControls(paramsOf(spec as never) as string)).toEqual([
    { kind: "choice", name: "m", value: "sin", choices: ["sin", "cos"], control: "SetterBar" },
  ]);
});

test("a symbol choice is a params tuple over bare names, read back as symbols", () => {
  const params = "{{o, Natural}, {Natural, ChineseRemainder, Adic}, SetterBar}";
  const [control] = parseControls(params);
  expect(control).toEqual({
    kind: "choice",
    name: "o",
    value: "Natural",
    choices: ["Natural", "ChineseRemainder", "Adic"],
    symbol: true,
    control: "SetterBar",
  });
  expect(choiceEntries(control as never)).toEqual(["Natural", "ChineseRemainder", "Adic"]);
  const [spec] = inferControls(null, {
    names: ["o"],
    hints: { o: { choices: ["Natural", "ChineseRemainder", "Adic"], start: "Adic" } },
  });
  expect(paramsOf(spec as never)).toBe("{{o, Adic}, {Natural, ChineseRemainder, Adic}, SetterBar}");
  // Strings stay strings: quoted entries are not symbols.
  expect(parseControls('{{m, "a"}, {"a", "b"}}')[0]).not.toHaveProperty("symbol");
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});

test("free symbols leave out constants, wildcards and heads", () => {
  expect(freeSymbols(parseExpression("Sin(a) + Pi * i + _s").json)).toEqual(["a"]);
});

test("every spec reads back as a control of the same kind", () => {
  const kinds = {
    integers: "slider",
    reals: "slider",
    choices: "choice",
    booleans: "toggle",
    points: "point",
    any: "text",
  } as const;
  for (const [id, { src, ctx }] of Object.entries(CASES)) {
    for (const spec of inferControls(parseExpression(src).json, ctx)) {
      const params = paramsOf(spec);
      expect(params, id).toBeDefined();
      const [control] = parseControls(params as string);
      expect(control?.kind, id).toBe(kinds[spec.domain.kind as keyof typeof kinds]);
      expect(control?.name, id).toBe(spec.name);
    }
  }
});
