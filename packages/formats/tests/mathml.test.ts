import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { afterAll, expect, test } from "vite-plus/test";
import { exportFormats, exportTo, getFormat, importFormats } from "../src/index.ts";
import { toMathML } from "../src/mathml.ts";

// MathJSON in, MathML out. The corpus is hand-written trees (both the array and the
// `{fn: …}` object spellings, both canonical and raw shapes) rather than parsed LaTeX,
// so the goldens pin the emitter alone and not compute-engine's parser.
const CORPUS: Record<string, MathJsonExpression> = {
  // atoms
  integer: 42,
  "negative integer": -7,
  "big integer": { num: "123456789012345678901234567890" },
  decimal: 3.25,
  scientific: { num: "6.02e23" },
  "scientific negative exponent": 1e-9,
  "repeating decimal": { num: "1.(3)" },
  "not a number": { num: "NaN" },
  "positive infinity": { num: "+Infinity" },
  "negative infinity": { num: "-Infinity" },
  symbol: "x",
  "multi-letter symbol": "speed",
  "symbol object": { sym: "y" },
  "greek symbol": "alpha",
  "constant pi": "Pi",
  "constant e": "ExponentialE",
  "constant i": "ImaginaryUnit",
  "constant infinity": "PositiveInfinity",
  "constant negative infinity": "NegativeInfinity",
  half: "Half",
  "subscripted symbol": "x_1",
  "symbol with word subscript": "v_max",
  "string literal": { str: "hello" },
  "quoted string": "'hi'",

  // arithmetic
  "add two": ["Add", "x", 1],
  "add many": ["Add", "a", "b", "c", "d"],
  "add negative literal": ["Add", "x", -2],
  "add negate": ["Add", "x", ["Negate", "y"]],
  "add negative coefficient": ["Add", ["Multiply", -2, "x"], 1],
  "add minus-one coefficient": ["Add", 1, ["Multiply", -1, "x"]],
  "add leading negative": ["Add", -2, "x"],
  "add double negative": ["Add", "a", ["Negate", ["Negate", "b"]]],
  "add nested add": ["Add", "a", ["Add", "b", "c"]],
  subtract: ["Subtract", "x", "y"],
  "subtract a sum": ["Subtract", "a", ["Add", "b", "c"]],
  "subtract a negative": ["Subtract", "a", -3],
  "subtract chain": ["Subtract", ["Subtract", "x", "y"], "z"],
  "unary minus": ["Negate", "x"],
  "unary minus of sum": ["Negate", ["Add", "x", 1]],
  "unary minus of product": ["Negate", ["Multiply", 2, "x"]],
  "unary minus of power": ["Negate", ["Power", "x", 2]],
  "double unary minus": ["Negate", ["Negate", "x"]],
  "unary minus of negative literal": ["Negate", -1],
  "multiply symbols": ["Multiply", "a", "b"],
  "multiply coefficient": ["Multiply", 2, "x"],
  "multiply numbers": ["Multiply", 2, 3],
  "multiply minus-one": ["Multiply", -1, "x", "y"],
  "multiply by negative": ["Multiply", "a", ["Negate", "b"]],
  "multiply by negative literal": ["Multiply", "a", -2],
  "multiply sums": ["Multiply", ["Add", "x", 1], ["Subtract", "x", 1]],
  "multiply fraction": ["Multiply", 2, ["Rational", 1, 2]],
  "invisible operator": ["InvisibleOperator", 2, "x"],
  divide: ["Divide", "x", "y"],
  "divide sums": ["Divide", ["Add", "x", 1], ["Subtract", "y", 2]],
  "nested fractions": ["Divide", ["Divide", 1, 2], ["Divide", 3, 4]],
  "fraction in numerator": ["Divide", ["Divide", "a", "b"], "c"],
  rational: ["Rational", 2, 3],
  "negative rational": ["Rational", -1, 3],
  power: ["Power", "x", 2],
  "power of sum": ["Power", ["Add", "x", 1], 2],
  "power of power": ["Power", ["Power", "x", 2], 3],
  "power of negative": ["Power", -2, 2],
  "power of negate": ["Power", ["Negate", "x"], 2],
  "power of fraction": ["Power", ["Rational", 1, 2], "n"],
  "power negative exponent": ["Power", "x", ["Negate", 1]],
  "power fraction exponent": ["Power", "x", ["Rational", 1, 2]],
  "power of product": ["Power", ["Multiply", "a", "b"], 2],
  "power of function": ["Power", ["Sin", "x"], 2],
  "power of subscript": ["Power", "x_1", 2],
  "power tower": ["Power", "a", ["Power", "b", "c"]],
  "power in product": ["Multiply", 3, ["Power", "x", 2]],
  "euler identity": ["Add", ["Power", "ExponentialE", ["Multiply", ["Complex", 0, 1], "Pi"]], 1],
  square: ["Square", "x"],
  exp: ["Exp", ["Negate", "x"]],
  sqrt: ["Sqrt", "x"],
  "sqrt of sum": ["Sqrt", ["Add", ["Power", "x", 2], 1]],
  "nested sqrt": ["Sqrt", ["Add", 1, ["Sqrt", 2]]],
  root: ["Root", "x", 3],
  "root of fraction": ["Root", ["Divide", 1, "x"], "n"],
  abs: ["Abs", ["Subtract", "x", "y"]],
  norm: ["Norm", "v"],
  floor: ["Floor", "x"],
  ceil: ["Ceil", "x"],
  factorial: ["Factorial", "n"],
  "factorial of sum": ["Factorial", ["Add", "n", 1]],
  "double factorial": ["Factorial2", "n"],
  binomial: ["Binomial", "n", "k"],
  "complex number": ["Complex", 2, 3],
  "complex unit imaginary": ["Complex", 2, 1],
  "complex pure imaginary": ["Complex", 0, 3],
  "complex object form": { fn: ["Add", { sym: "x" }, { num: "1" }] },

  // functions
  sin: ["Sin", "x"],
  "sin of product": ["Sin", ["Multiply", 2, "x"]],
  "sin times cos": ["Multiply", ["Sin", "x"], ["Cos", "y"]],
  ln: ["Ln", "x"],
  "log base": ["Log", 8, 2],
  lb: ["Lb", 8],
  "gamma function": ["Gamma", ["Add", "n", 1]],
  "user function": ["f", "x", "y"],
  "user function no args": ["f"],
  "unknown head": ["Zeta", "s"],
  "nested calls": ["f", ["g", "x"], ["h", "y", "z"]],

  // scripts
  subscript: ["Subscript", "a", "n"],
  "subscript of sum": ["Subscript", ["Add", "a", "b"], "n"],
  superscript: ["Superscript", "A", "T"],
  "subscript and power": ["Power", ["Subscript", "a", "n"], 2],

  // collections
  list: ["List", 1, 2, 3],
  "empty list": ["List"],
  "list of lists": ["List", ["List", 1, 2], ["List", 3, 4]],
  set: ["Set", "a", "b"],
  tuple: ["Tuple", "x", 0, 1],
  pair: ["Pair", "x", "y"],
  matrix: ["Matrix", ["List", ["List", 1, 2], ["List", 3, 4]]],
  "matrix with brackets": ["Matrix", ["List", ["List", 1, 2], ["List", 3, 4]], "'[]'"],
  "matrix with str delimiters": ["Matrix", ["List", ["List", 1, 2], ["List", 3, 4]], { str: "||" }],
  "matrix no delimiters": ["Matrix", ["List", ["List", 1, 2], ["List", 3, 4]], "'..'"],
  "matrix of expressions": [
    "Matrix",
    ["List", ["List", ["Divide", 1, 2], ["Negate", "x"]], ["List", ["Power", "x", 2], ["Sqrt", 2]]],
  ],
  "column vector": ["Matrix", ["List", ["List", 1], ["List", 2], ["List", 3]]],
  "nested matrices": [
    "Matrix",
    ["List", ["List", ["Matrix", ["List", ["List", 1, 0], ["List", 0, 1]]], 0], ["List", 0, 1]],
  ],
  delimiter: ["Delimiter", ["Add", "x", 1]],
  "delimiter brackets": ["Delimiter", ["Sequence", "a", "b"], "'[]'", "';'"],
  "delimited negate": ["Negate", ["Delimiter", ["Negate", "x"]]],

  // relations and logic
  equal: ["Equal", "x", 1],
  "equal sum": ["Equal", ["Add", "x", "y"], ["Multiply", 2, "z"]],
  "not equal": ["NotEqual", "x", "y"],
  less: ["Less", "a", "b"],
  "less equal": ["LessEqual", 3, "x"],
  greater: ["Greater", "a", "b"],
  "greater equal": ["GreaterEqual", "x", 3],
  approx: ["Approx", "Pi", 3.14],
  "chained relation": ["Less", "a", "b", "c"],
  "mixed relation": ["LessEqual", ["Less", "a", "b"], "c"],
  "relation of relations": ["Equal", ["Less", "a", "b"], ["Greater", "c", "d"]],
  "relation in sum": ["Add", ["Equal", "a", "b"], 1],
  element: ["Element", "x", "RealNumbers"],
  and: ["And", ["Less", "a", "b"], ["LessEqual", "b", "c"]],
  or: ["Or", "p", "q"],
  "and of or": ["And", ["Or", "p", "q"], "r"],
  "or of and": ["Or", ["And", "p", "q"], "r"],
  not: ["Not", "p"],
  "not of and": ["Not", ["And", "p", "q"]],
  implies: ["Implies", "p", "q"],
  equivalent: ["Equivalent", "p", "q"],

  // calculus
  "sum with limits": ["Sum", ["Power", "n", 2], ["Limits", "n", 1, 10]],
  "sum with tuple": ["Sum", ["Power", "n", 2], ["Tuple", "n", 1, 10]],
  "sum canonical": ["Sum", ["Function", ["Block", ["Power", "n", 2]], "n"], ["Limits", "n", 1, 10]],
  "sum of sum": ["Sum", ["Add", "n", 1], ["Limits", "n", 0, "Infinity"]],
  "sum no bounds": ["Sum", "a_n"],
  "sum variable only": ["Sum", "a_n", "n"],
  product: ["Product", "k", ["Limits", "k", 1, 5]],
  "definite integral": [
    "Integrate",
    ["Function", ["Block", ["Power", "x", 2]], "x"],
    ["Limits", "x", 0, 1],
  ],
  "indefinite integral": ["Integrate", ["Sin", "x"], "x"],
  "integral of sum": ["Integrate", ["Add", "x", 1], ["Tuple", "x", 0, 1]],
  limit: ["Limit", ["Function", ["Block", ["Divide", ["Sin", "x"], "x"]], "x"], 0],
  "limit raw": ["Limit", ["Function", ["Divide", ["Sin", "x"], "x"], "x"], 0],
  derivative: ["D", ["Power", "x", 2], "x"],
  "derivative prime": ["Apply", ["Derivative", "f", 1], "x"],
  "derivative double prime": ["Apply", ["Derivative", "f", 2], "x"],
  "derivative high order": ["Apply", ["Derivative", "f", 5], "x"],
  "derivative default order": ["Apply", ["Derivative", "f"], "x"],
  apply: ["Apply", "f", "x"],
  "apply many": ["Apply", "f", "x", "y"],

  // sets and intervals
  "interval closed": ["Interval", 0, 1],
  "interval open": ["Interval", ["Open", 0], ["Open", 1]],
  "interval half open right": ["Interval", 0, ["Open", 1]],
  "interval half open left": ["Interval", ["Open", 0], 1],
  subset: ["Subset", "A", "B"],
  "subset equal": ["SubsetEqual", "A", "B"],
  "not element": ["NotElement", "x", "Integers"],

  // piecewise
  "piecewise two cases": ["Which", ["Greater", "x", 0], ["Power", "x", 2], "True", ["Negate", "x"]],
  "piecewise no default": ["Which", ["Greater", "x", 0], "x"],

  // geometric algebra
  wedge: ["Wedge", "a", "b"],
  "wedge three": ["Wedge", "a", "b", "c"],
  vee: ["Vee", "a", "b", "algebra"],
  "wedge of sum": ["Wedge", ["Add", "a", 1], "b"],
  "ordered juxtaposition": ["InvisibleOperator", "e_2", "e_1"],

  // errors and oddities
  error: ["Error", "'unknown-symbol'"],
  "xml special characters": ["Less", "'a<b'", "'c&d'"],
  dictionary: { dict: { a: 1 } },
};

// The goldens live in a committed JSON file compared with `toEqual` -- deliberately NOT
// `toMatchSnapshot`, whose client isn't set up when the `test` task runs through
// `vp run`. Regenerate with `UPDATE_MATHML=1 vp test` after an intended change, then
// `vp check --fix` to reformat the JSON.
const GOLDEN = fileURLToPath(new URL("./mathml.golden.json", import.meta.url));
const updating = process.env.UPDATE_MATHML === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

/** Every open tag is closed, in order -- the cheap well-formedness check node lacks. */
function assertBalanced(xml: string, label: string): void {
  const stack: string[] = [];
  for (const m of xml.matchAll(/<(\/?)([a-z]+)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) expect(stack.pop(), `${label}: closing </${m[2]}>`).toBe(m[2]);
    else stack.push(m[2]);
  }
  expect(stack, `${label}: unclosed tags`).toEqual([]);
  // Text outside tags must carry no raw markup characters.
  expect(xml.replace(/<[^>]*>/g, ""), `${label}: unescaped text`).not.toMatch(
    /[<>]|&(?!#x?[0-9a-f]+;|amp;|lt;|gt;|quot;)/i,
  );
}

for (const [name, json] of Object.entries(CORPUS)) {
  test(`MathML: ${name}`, () => {
    const mathml = toMathML(json, { fragment: true });
    assertBalanced(mathml, name);
    if (updating) {
      fresh[name] = { json, mathml };
      return;
    }
    expect({ json, mathml }).toEqual(golden[name]);
  });
}

test("MathML: root element and display option", () => {
  expect(toMathML("x")).toBe('<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>');
  expect(toMathML("x", { display: "block" })).toBe(
    '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mi>x</mi></math>',
  );
});

test("MathML: deterministic", () => {
  const json = CORPUS["matrix of expressions"];
  expect(toMathML(json)).toBe(toMathML(structuredClone(json)));
});

test("MathML: registered as an export-only format", () => {
  const ce = new ComputeEngine();
  const format = getFormat("mathml");
  expect(format?.name).toBe("MathML");
  expect(exportFormats()).toContain("MathML");
  expect(importFormats()).not.toContain("MathML");
  expect(getFormat("MathMLForm")).toBe(format);
  expect(exportTo(ce.box(["Add", "x", 1]), "MathML")).toBe(
    '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow></math>',
  );
  expect(exportTo(ce.parse("\\frac{x+1}{2}", { form: "raw" }), "MathML", { fragment: true })).toBe(
    "<mfrac><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow><mn>2</mn></mfrac>",
  );
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
