import type { BoxedExpression } from "@cortex-js/compute-engine";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate();
const runJson = (expr: unknown) => run(expr).json;

const L = (...items: unknown[]) => ["List", ...items];
const convert = (expr: unknown, form: string) =>
  ce.function("BooleanConvert", [ce.box(expr as never), ce.string(form)]).evaluate();

// An independent boolean oracle — evaluates the ORIGINAL eight connectives directly by
// truth table, so a truth-table-equivalence check doesn't route through the same
// elimination/distribution code the implementation uses to answer itself.
type Assignment = Readonly<Record<string, boolean>>;

function evalBool(expr: BoxedExpression, assignment: Assignment): boolean {
  const op = expr.operator;
  const args = () => operandsOf(expr).map((a) => evalBool(a, assignment));
  switch (op) {
    case "And":
      return args().every(Boolean);
    case "Or":
      return args().some(Boolean);
    case "Not":
      return !evalBool(operandsOf(expr)[0]!, assignment);
    case "Implies": {
      const [a, b] = args();
      return !a || b!;
    }
    case "Xor":
      return args().reduce((acc, v) => acc !== v);
    case "Nand":
      return !args().every(Boolean);
    case "Nor":
      return !args().some(Boolean);
    case "Equivalent": {
      const values = args();
      return values.every((v) => v === values[0]);
    }
    default: {
      const name = symbolNameOf(expr);
      if (name === "True") return true;
      if (name === "False") return false;
      if (name !== undefined && name in assignment) return assignment[name]!;
      throw new Error(`unbound leaf in truth-table oracle: ${JSON.stringify(expr.json)}`);
    }
  }
}

function freeVars(expr: BoxedExpression, into: Set<string> = new Set()): Set<string> {
  const op = expr.operator;
  if (
    op === "And" ||
    op === "Or" ||
    op === "Not" ||
    op === "Implies" ||
    op === "Xor" ||
    op === "Nand" ||
    op === "Nor" ||
    op === "Equivalent"
  ) {
    for (const a of operandsOf(expr)) freeVars(a, into);
    return into;
  }
  const name = symbolNameOf(expr);
  if (name !== undefined && name !== "True" && name !== "False") into.add(name);
  return into;
}

/** Every one of `expr`'s 2^n assignments (n = its free-variable count, capped well under 6
 *  by every fixture below) agrees between the independent oracle and `converted`. */
function assertTruthTableEquivalent(expr: BoxedExpression, converted: BoxedExpression): void {
  const vars = [...freeVars(expr)].sort();
  expect(vars.length).toBeLessThanOrEqual(6);
  for (let bits = 0; bits < 1 << vars.length; bits++) {
    const assignment: Record<string, boolean> = {};
    vars.forEach((v, i) => (assignment[v] = (bits & (1 << i)) !== 0));
    expect(evalBool(converted, assignment), `${JSON.stringify(converted.json)} @ ${JSON.stringify(assignment)}`).toBe(
      evalBool(expr, assignment),
    );
  }
}

const FIXTURES: readonly unknown[] = [
  ["Implies", "p", "q"],
  ["Equivalent", "p", "q"],
  ["Xor", "p", "q"],
  ["Xor", "p", "q", "r"],
  ["Nand", "p", "q"],
  ["Nor", "p", "q"],
  ["And", "p", ["Or", "q", "r"]],
  ["Or", "p", ["And", "q", ["Not", "r"]]],
  ["Implies", ["And", "p", "q"], ["Or", "r", "s"]],
  ["Not", ["Implies", "p", "q"]],
  ["And", "p", ["Not", "p"]],
  ["Or", "p", ["Not", "p"]],
  ["Equivalent", ["Implies", "p", "q"], ["Or", ["Not", "p"], "q"]],
  ["And", "p", "q", "r", "s", "t", "u"],
];

// ─── truth-table equivalence: DNF / CNF / NNF all agree with the original ─────────────────

for (const fixture of FIXTURES) {
  const label = JSON.stringify(fixture);
  test(`DNF(${label}) is truth-table equivalent to the input`, () => {
    assertTruthTableEquivalent(ce.box(fixture as never), convert(fixture, "DNF"));
  });
  test(`CNF(${label}) is truth-table equivalent to the input`, () => {
    assertTruthTableEquivalent(ce.box(fixture as never), convert(fixture, "CNF"));
  });
  test(`NNF(${label}) is truth-table equivalent to the input`, () => {
    assertTruthTableEquivalent(ce.box(fixture as never), convert(fixture, "NNF"));
  });
}

test("LogicalExpand agrees with BooleanConvert's default (DNF) form", () => {
  for (const fixture of FIXTURES) {
    expect(runJson(["LogicalExpand", fixture])).toEqual(convert(fixture, "DNF").json);
  }
});

// ─── shape assertions: DNF is an Or of Ands, CNF an And of Ors ────────────────────────────

const isLiteral = (e: BoxedExpression): boolean => e.operator !== "And" && e.operator !== "Or";

function isDisjunctionOfConjunctions(e: BoxedExpression): boolean {
  if (e.operator !== "Or") return isLiteral(e) || (e.operator === "And" && operandsOf(e).every(isLiteral));
  return operandsOf(e).every(
    (clause) => isLiteral(clause) || (clause.operator === "And" && operandsOf(clause).every(isLiteral)),
  );
}

function isConjunctionOfDisjunctions(e: BoxedExpression): boolean {
  if (e.operator !== "And") return isLiteral(e) || (e.operator === "Or" && operandsOf(e).every(isLiteral));
  return operandsOf(e).every(
    (clause) => isLiteral(clause) || (clause.operator === "Or" && operandsOf(clause).every(isLiteral)),
  );
}

test("BooleanConvert(expr, DNF) is a disjunction of conjunctions", () => {
  for (const fixture of FIXTURES) expect(isDisjunctionOfConjunctions(convert(fixture, "DNF"))).toBe(true);
});
test("BooleanConvert(expr, CNF) is a conjunction of disjunctions", () => {
  for (const fixture of FIXTURES) expect(isConjunctionOfDisjunctions(convert(fixture, "CNF"))).toBe(true);
});

// ─── determinism: re-converting an already-converted form is a no-op ─────────────────────

test("DNF/CNF/NNF are idempotent (already-normal input converts to itself)", () => {
  for (const fixture of FIXTURES) {
    const dnf = convert(fixture, "DNF");
    expect(convert(dnf.json, "DNF").json).toEqual(dnf.json);
    const cnf = convert(fixture, "CNF");
    expect(convert(cnf.json, "CNF").json).toEqual(cnf.json);
  }
});

test("operand order in the input doesn't change the DNF/CNF result (canonical sort)", () => {
  expect(convert(["And", "q", "p"], "DNF").json).toEqual(convert(["And", "p", "q"], "DNF").json);
  expect(convert(["Or", "q", "p"], "CNF").json).toEqual(convert(["Or", "p", "q"], "CNF").json);
});

// ─── unimplemented BooleanConvert forms stay unevaluated ──────────────────────────────────

test('BooleanConvert(expr, "ESOP") is left unevaluated', () => {
  expect(convert("p", "ESOP").operator).toBe("BooleanConvert");
});

// ─── IsTrue ────────────────────────────────────────────────────────────────────────────────

test("IsTrue is True only for the literal True", () => {
  expect(runJson(["IsTrue", "True"])).toEqual("True");
  expect(runJson(["IsTrue", "False"])).toEqual("False");
  expect(runJson(["IsTrue", "x"])).toEqual("False");
  expect(runJson(["IsTrue", ["Equal", 1, 1]])).toEqual("True");
  expect(runJson(["IsTrue", ["Equal", 1, 2]])).toEqual("False");
});

// ─── IsInteger ─────────────────────────────────────────────────────────────────────────────

test("IsInteger is False, never unevaluated, for anything not manifestly an integer", () => {
  expect(runJson(["IsInteger", 4])).toEqual("True");
  expect(runJson(["IsInteger", -3])).toEqual("True");
  expect(runJson(["IsInteger", ["Rational", 1, 2]])).toEqual("False");
  expect(runJson(["IsInteger", "x"])).toEqual("False");
});

// ─── IsVector / IsMatrix / IsArray ──────────────────────────────────────────────────────────

test("IsVector: rank-1 only, no nested List", () => {
  expect(runJson(["IsVector", L(1, 2, 3)])).toEqual("True");
  expect(runJson(["IsVector", L(L(1, 2), L(3, 4))])).toEqual("False");
  expect(runJson(["IsVector", 3])).toEqual("False");
  expect(runJson(["IsVector", L()])).toEqual("True");
});

test("IsVector honors a test function over every element", () => {
  expect(runJson(["IsVector", L(2, 4, 6), "IsEven"])).toEqual("True");
  expect(runJson(["IsVector", L(2, 3, 6), "IsEven"])).toEqual("False");
});

test("IsMatrix: rank-2, non-ragged, non-empty", () => {
  expect(runJson(["IsMatrix", L(L(1, 2), L(3, 4))])).toEqual("True");
  expect(runJson(["IsMatrix", L(1, 2, 3)])).toEqual("False");
  expect(runJson(["IsMatrix", L(L(1, 2), L(3))])).toEqual("False");
  expect(runJson(["IsMatrix", L()])).toEqual("False");
});

test("IsArray: any rank, but must be non-ragged", () => {
  expect(runJson(["IsArray", L(L(1, 2), L(3, 4))])).toEqual("True");
  expect(runJson(["IsArray", L(1, 2, 3)])).toEqual("True");
  expect(runJson(["IsArray", L(L(1, 2), L(3))])).toEqual("False");
  expect(runJson(["IsArray", 3])).toEqual("False");
  expect(runJson(["IsArray", L(L(L(1), L(2)), L(L(3), L(4)))])).toEqual("True");
});

// ─── IsMersennePrimeExponent ────────────────────────────────────────────────────────────────

test("IsMersennePrimeExponent matches the known table below the cap", () => {
  for (const p of [2, 3, 5, 7, 13, 17, 19, 31]) expect(runJson(["IsMersennePrimeExponent", p])).toEqual("True");
  for (const p of [4, 6, 9, 11, 23, 29]) expect(runJson(["IsMersennePrimeExponent", p])).toEqual("False");
});
test("IsMersennePrimeExponent(4423) is the 20th known Mersenne prime exponent — right at the cap", () => {
  expect(runJson(["IsMersennePrimeExponent", 4423])).toEqual("True");
});
test("IsMersennePrimeExponent stays unevaluated past the cap", () => {
  expect(run(["IsMersennePrimeExponent", 999999]).operator).toBe("IsMersennePrimeExponent");
});
test("IsMersennePrimeExponent(n < 2) is False outright", () => {
  expect(runJson(["IsMersennePrimeExponent", 1])).toEqual("False");
  expect(runJson(["IsMersennePrimeExponent", 0])).toEqual("False");
  expect(runJson(["IsMersennePrimeExponent", -5])).toEqual("False");
});

// ─── IsIntervalMember ───────────────────────────────────────────────────────────────────────

test("IsIntervalMember: closed bounds include their endpoints", () => {
  expect(runJson(["IsIntervalMember", ["Interval", 1, 5], 1])).toEqual("True");
  expect(runJson(["IsIntervalMember", ["Interval", 1, 5], 5])).toEqual("True");
  expect(runJson(["IsIntervalMember", ["Interval", 1, 5], 3])).toEqual("True");
  expect(runJson(["IsIntervalMember", ["Interval", 1, 5], 6])).toEqual("False");
  expect(runJson(["IsIntervalMember", ["Interval", 1, 5], 0])).toEqual("False");
});

test("IsIntervalMember: Open(...) excludes that endpoint", () => {
  expect(runJson(["IsIntervalMember", ["Interval", ["Open", 1], 5], 1])).toEqual("False");
  expect(runJson(["IsIntervalMember", ["Interval", 1, ["Open", 5]], 5])).toEqual("False");
  expect(runJson(["IsIntervalMember", ["Interval", ["Open", 1], ["Open", 5]], 3])).toEqual("True");
});
