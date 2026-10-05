import { ComputeEngine } from "@cortex-js/compute-engine";
import { fromWolfram } from "@enumeratio/wolfram";
import { describe, expect, test } from "vite-plus/test";
import { compare, parsePython } from "../src/compare.ts";
import type { MathJSON } from "../src/emit.ts";
import {
  type Approximate,
  compareTrees,
  isNumericValue,
  type Leaf,
  reduce,
  scaled,
  symbolic,
  valuesOnly,
} from "../src/structural.ts";

// A stand-in for the caller's engine: it "evaluates" everything, the way compute-engine
// evaluates a call Wolfram declined.
const evaluateAll = (expr: MathJSON): Leaf =>
  Array.isArray(expr) && expr[0] === "Rational" ? (expr[1] as number) / (expr[2] as number) : 1;

test("numbers, constants and arithmetic on them are numeric values", () => {
  expect(isNumericValue(3)).toBe(true);
  expect(isNumericValue("Pi")).toBe(true);
  expect(isNumericValue(["Rational", 1, 2])).toBe(true);
  expect(isNumericValue(["Complex", 1.5, -2])).toBe(true);
  expect(isNumericValue(["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]])).toBe(true);
  expect(isNumericValue(["N", ["Sqrt", 2]])).toBe(true);
});

test("a declined call, a free symbol or a list is not", () => {
  expect(isNumericValue(["MatrixRank", ["List", 1, 2, 3]])).toBe(false);
  expect(isNumericValue(["PowerMod", 2, -1, 4])).toBe(false);
  expect(isNumericValue(["Add", 1, "x"])).toBe(false);
  expect(isNumericValue(["List", 1, 2])).toBe(false);
  expect(isNumericValue("'text'")).toBe(false);
});

test("an unevaluated call disagrees with the value we computed", () => {
  const theirs = ["MatrixRank", ["List", 1, 2, 3]] as MathJSON;
  // Unguarded, our evaluator turns their unevaluated call into our answer.
  expect(compareTrees(1, reduce(theirs, evaluateAll))).toBe("agree");
  expect(reduce(theirs, valuesOnly(evaluateAll))).toEqual(symbolic(theirs));
  expect(compareTrees(1, reduce(theirs, valuesOnly(evaluateAll)))).toBe("disagree");
});

test("numeric values still reduce, inside lists too", () => {
  const theirs = ["List", ["Rational", 1, 2], ["PowerMod", 2, -1, 4], 3] as MathJSON;
  expect(reduce(theirs, valuesOnly(evaluateAll))).toEqual([0.5, symbolic(["PowerMod", 2, -1, 4]), 1]);
});

// KaryTree(5) (the default k=2 binary tree on 5 vertices: root 1, children 2 3, 2's children
// 4 5) -- ours spells its edges as an explicit UndirectedEdge list; Wolfram's own answer
// packs them into a cached `{Null, SparseArray[...]}` adjacency matrix instead. Structurally
// nothing alike for the SAME graph, so a plain `compareTrees` on the raw reduce would always
// disagree; `reduce`'s `Graph` case has to read both down to the same vertices+edges shape.
// `theirs` is run through `fromWolfram` on Wolfram's OWN literal answer text (not hand-typed
// MathJSON) -- its `Null` reads back as our `Nothing`, not the string `"Null"`, which a
// hand-typed tree would get wrong without ever failing to typecheck.
test("a Graph answer compares by vertices + edges, not by Wolfram's cached SparseArray shape", () => {
  // A real evaluator, not `evaluateAll`'s "everything reduces to 1" stand-in — vertex/edge
  // labels have to keep their own identity for a structural graph comparison to mean
  // anything.
  const evaluateNumbers: (expr: MathJSON) => Leaf = (expr) => (typeof expr === "number" ? expr : symbolic(expr));
  const ours = [
    "Graph",
    ["List", 1, 2, 3, 4, 5],
    ["List", ["UndirectedEdge", 1, 2], ["UndirectedEdge", 1, 3], ["UndirectedEdge", 2, 4], ["UndirectedEdge", 2, 5]],
  ] as MathJSON;
  // Wolfram's actual `KaryTree[5]` answer text, as scanned (examples.values.wolfram.tsv):
  // edges as a compressed-row-storage adjacency matrix (row i's nonzero columns are
  // `colIndices[rowPtr[i-1] .. rowPtr[i]-1]`): row 1 -> {2, 3}, row 2 -> {1, 4, 5}, row 3 ->
  // {1}, row 4 -> {2}, row 5 -> {2} (the matrix is symmetric — each edge appears from both
  // endpoints).
  const theirs = fromWolfram(
    "Graph[{1, 2, 3, 4, 5}, {Null, SparseArray[Automatic, {5, 5}, 0, {1, {{0, 2, 5, 6, 7, 8}, {{2}, {3}, {1}, {4}, {5}, {1}, {2}, {2}}}, Pattern}]}]",
  ) as MathJSON;
  expect(compareTrees(reduce(ours, evaluateNumbers), reduce(theirs, evaluateNumbers))).toBe("agree");
  // A genuinely different graph (a missing edge) still disagrees.
  const fewerEdges = [
    "Graph",
    ["List", 1, 2, 3, 4, 5],
    ["List", ["UndirectedEdge", 1, 2], ["UndirectedEdge", 1, 3], ["UndirectedEdge", 2, 4]],
  ] as MathJSON;
  expect(compareTrees(reduce(fewerEdges, evaluateNumbers), reduce(theirs, evaluateNumbers))).toBe("disagree");
});

// GridGraph(2, 3), Wolfram's FullForm as the scan reads it: numbered with the first dimension
// fastest, where ours numbers the last fastest. Read through `symbolic` (the exact tree, which
// reads a leaf as its text) the labelled graphs still compare: same numbering agrees, ours differs.
test("a SparseArray Graph in FullForm reads through a text evaluator, so a renumbered grid is a readable disagree", () => {
  const theirs = fromWolfram(
    'Graph[List[1, 2, 3, 4, 5, 6], List[Null, SparseArray[Automatic, List[6, 6], 0, List[1, List[List[0, 2, 4, 7, 10, 12, 14], List[List[2], List[3], List[1], List[4], List[1], List[4], List[5], List[2], List[3], List[6], List[3], List[6], List[4], List[5]]], Pattern]]], List[Rule[GraphLayout, List["GridEmbedding", Rule["Dimension", List[2, 3]]]]]]',
  ) as MathJSON;
  const grid = (...edges: [number, number][]): MathJSON => [
    "Graph",
    ["List", 1, 2, 3, 4, 5, 6],
    ["List", ...edges.map(([a, b]) => ["UndirectedEdge", a, b])],
  ];
  const sameNumbering = grid([1, 2], [1, 3], [2, 4], [3, 4], [3, 5], [4, 6], [5, 6]);
  const lastFastest = grid([1, 4], [1, 2], [2, 5], [2, 3], [3, 6], [4, 5], [5, 6]);
  expect(compareTrees(reduce(sameNumbering, symbolic), reduce(theirs, symbolic))).toBe("agree");
  expect(compareTrees(reduce(lastFastest, symbolic), reduce(theirs, symbolic))).toBe("disagree");
});

// Subgraph(CompleteGraph(4), [1, 2, 3]): Wolfram's answer also carries a layout option list.
test("a Graph answer's trailing options don't change the graph", () => {
  const evaluateNumbers: (expr: MathJSON) => Leaf = (expr) => (typeof expr === "number" ? expr : symbolic(expr));
  const ours = [
    "Graph",
    ["List", 1, 2, 3],
    ["List", ["UndirectedEdge", 1, 2], ["UndirectedEdge", 1, 3], ["UndirectedEdge", 2, 3]],
  ] as MathJSON;
  const theirs = fromWolfram(
    'Graph[{1, 2, 3}, {Null, SparseArray[Automatic, {3, 3}, 0, {1, {{0, 2, 4, 6}, {{2}, {3}, {1}, {3}, {1}, {2}}}, Pattern}]}, {GraphLayout -> "StarEmbedding"}]',
  ) as MathJSON;
  expect(compareTrees(reduce(ours, evaluateNumbers), reduce(theirs, evaluateNumbers))).toBe("agree");
});

// A directed graph's cached matrix sits in the other slot: `{SparseArray, Null}`.
test("a directed Graph answer reads its edges from the directed SparseArray slot", () => {
  const evaluateNumbers: (expr: MathJSON) => Leaf = (expr) => (typeof expr === "number" ? expr : symbolic(expr));
  const ours = [
    "Graph",
    ["List", 1, 2, 3],
    ["List", ["DirectedEdge", 1, 2], ["DirectedEdge", 2, 3], ["DirectedEdge", 3, 1]],
  ] as MathJSON;
  const theirs = fromWolfram(
    "Graph[{1, 2, 3}, {SparseArray[Automatic, {3, 3}, 0, {1, {{0, 1, 2, 3}, {{2}, {3}, {1}}}, Pattern}], Null}]",
  ) as MathJSON;
  expect(compareTrees(reduce(ours, evaluateNumbers), reduce(theirs, evaluateNumbers))).toBe("agree");
  // Reversed edge directions are a different graph.
  const reversed = [
    "Graph",
    ["List", 1, 2, 3],
    ["List", ["DirectedEdge", 2, 1], ["DirectedEdge", 3, 2], ["DirectedEdge", 1, 3]],
  ] as MathJSON;
  expect(compareTrees(reduce(reversed, evaluateNumbers), reduce(theirs, evaluateNumbers))).toBe("disagree");
});

// CycleDecomposition/from-a-permutation: `Permutation([2, 3, 1, 4])` decomposes into cycles
// (1 2 3), a 3-cycle, and 4, a FIXED point -- ours keeps the fixed point as its own singleton
// cycle (`[[1,2,3],[4]]`); Wolfram's `Cycles[{{1,2,3}}]` (its own answer, unwrapped by name
// since `Cycles` is never one of our heads) omits it. Same permutation, not a shape mismatch.
test("CycleDecomposition and Wolfram's own Cycles compare equal once a fixed point is dropped", () => {
  const evaluateNumbers: (expr: MathJSON) => Leaf = (expr) => (typeof expr === "number" ? expr : symbolic(expr));
  const ours = ["CycleDecomposition", ["List", ["List", 1, 2, 3], ["List", 4]]] as MathJSON;
  const theirs = fromWolfram("Cycles[{{1, 2, 3}}]") as MathJSON;
  expect(compareTrees(reduce(ours, evaluateNumbers), reduce(theirs, evaluateNumbers))).toBe("agree");
  // A genuinely different cycle structure still disagrees.
  const differentCycles = ["CycleDecomposition", ["List", ["List", 1, 3], ["List", 2]]] as MathJSON;
  expect(compareTrees(reduce(differentCycles, evaluateNumbers), reduce(theirs, evaluateNumbers))).toBe("disagree");
});

test("a carrier constructor reduces to its contents, same as List vs. Tuple leniency", () => {
  const ours = ["Permutation", ["List", 2, 1, 3]] as MathJSON;
  const theirs = ["List", 2, 1, 3] as MathJSON; // an external system's own, unwrapped, encoding
  expect(reduce(ours, symbolic)).toEqual(reduce(theirs, symbolic));
  expect(compareTrees(reduce(ours, symbolic), reduce(theirs, symbolic))).toBe("agree");
  // Nested carriers unwrap all the way down.
  const nested = ["SetPartition", ["Permutation", ["List", 1, 2]]] as MathJSON;
  expect(reduce(nested, symbolic)).toEqual(reduce(["List", 1, 2] as MathJSON, symbolic));
});

test("a composite carrier (carrierElements) reduces both slots, not just the last", () => {
  // StandardTableauPair(Tuple(StandardTableau(P), StandardTableau(Q))): every slot of the
  // packed Tuple is itself a carrier call, unlike a `carrierParams` pack (Tournament(n,
  // edges)) where only the trailing element matters — both P and Q have to survive.
  const p: MathJSON = ["List", ["List", 1, 3], ["List", 2]];
  const q: MathJSON = ["List", ["List", 1, 2], ["List", 3]];
  const pair: MathJSON = ["StandardTableauPair", ["Tuple", ["StandardTableau", p], ["StandardTableau", q]]];
  expect(reduce(pair, symbolic)).toEqual(reduce(["List", p, q] as MathJSON, symbolic));
});

test("truth values reduce to booleans whichever evaluator reads the rest", () => {
  expect(reduce("True", symbolic)).toBe(true);
  expect(reduce(["List", "True", "False"], valuesOnly(symbolic))).toEqual([true, false]);
  expect(compareTrees(reduce("True", symbolic), reduce("True", symbolic))).toBe("agree");
});

test("Rule and KeyValuePair compare by their two operands, not their head", () => {
  // `fromWolfram` reads a scanned `Rule[x, 2]` back as `KeyValuePair` (the ambiguous reverse
  // of `HEADS`, kept for the `Over` option's own round trip in from-wolfram.test.ts), while
  // Maximize/FindInstance bindings and Association entries are built as `Rule` directly — so
  // this pair has to compare equal, the same List vs. Tuple leniency `SEQUENCE_HEADS` gives.
  const ours = ["Rule", "x", 2] as MathJSON;
  const theirs = ["KeyValuePair", "x", 2] as MathJSON;
  expect(reduce(ours, symbolic)).toEqual(reduce(theirs, symbolic));
  expect(compareTrees(reduce(ours, symbolic), reduce(theirs, symbolic))).toBe("agree");
  // Nested inside a List, as Maximize's `{value, {x -> argmax}}` answer shape does.
  const wrapped = ["List", 3, ["List", ours]] as MathJSON;
  const wrappedTheirs = ["List", 3, ["List", theirs]] as MathJSON;
  expect(compareTrees(reduce(wrapped, symbolic), reduce(wrappedTheirs, symbolic))).toBe("agree");
  // A genuine value difference on either side still disagrees.
  const different = ["KeyValuePair", "x", 3] as MathJSON;
  expect(compareTrees(reduce(ours, symbolic), reduce(different, symbolic))).toBe("disagree");
});

// A real evaluator for the rule tests: a value is a number where it has one, as the scan's
// own `leaf` reads it, else its symbolic text.
const ce = new ComputeEngine();
const evaluateReal = (expr: MathJSON): Leaf => {
  const { re } = ce.box(expr as Parameters<ComputeEngine["box"]>[0]).N();
  return typeof re === "number" && Number.isFinite(re) ? re : symbolic(expr);
};
const verdictOf = (ours: MathJSON, theirsFullForm: string, tolerance?: number) =>
  compareTrees(reduce(ours, evaluateReal), reduce(fromWolfram(theirsFullForm) as MathJSON, evaluateReal), tolerance);

describe("rules and associations compare structurally wherever they sit", () => {
  // Minimize(x^4 - 4 x^2, x): Wolfram answers `{-4, {x -> -Sqrt[2]}}`, which is
  // `List[-4, List[Rule[x, Times[-1, Power[2, Rational[1, 2]]]]]]` in FullForm.
  const minimize = ["List", -4, ["List", ["Rule", "x", ["Negate", ["Sqrt", 2]]]]] as MathJSON;
  const wolframMinimize = "List[-4, List[Rule[x, Times[-1, Power[2, Rational[1, 2]]]]]]";

  test("a Rule inside a List agrees on value, whatever the spelling of the number", () => {
    expect(verdictOf(minimize, wolframMinimize)).toBe("agree");
  });

  test("a Rule's value still disagrees when it differs, or when the key does", () => {
    expect(verdictOf(minimize, "List[-4, List[Rule[x, Power[2, Rational[1, 2]]]]]")).toBe("disagree");
    expect(verdictOf(minimize, "List[-4, List[Rule[y, Times[-1, Power[2, Rational[1, 2]]]]]]")).toBe("disagree");
    expect(verdictOf(minimize, "List[-5, List[Rule[x, Times[-1, Power[2, Rational[1, 2]]]]]]")).toBe("disagree");
  });

  test("a Rule's value honours the tolerance", () => {
    const ours = ["List", ["Rule", "x", 0.25268025516236814]] as MathJSON;
    expect(verdictOf(ours, "List[Rule[x, 0.2526802551]]", 1e-12)).toBe("disagree");
    expect(verdictOf(ours, "List[Rule[x, 0.2526802551]]", 1e-8)).toBe("agree");
  });

  test("rules nest: several solutions, several bindings each", () => {
    const ours = [
      "List",
      ["List", ["Rule", "a", 1], ["Rule", "b", 7]],
      ["List", ["Rule", "a", 14], ["Rule", "b", 16]],
    ] as MathJSON;
    const theirs = "List[List[Rule[a, 1], Rule[b, 7]], List[Rule[a, 14], Rule[b, 16]]]";
    expect(verdictOf(ours, theirs)).toBe("agree");
    expect(verdictOf(ours, "List[List[Rule[a, 1], Rule[b, 7]]]")).toBe("disagree");
  });

  test("a rule whose key is a list (Thread over Tuples) compares by that list", () => {
    const ours = ["List", ["Rule", ["List", 1, 0], 2], ["Rule", ["List", 0, 1], 3]] as MathJSON;
    expect(verdictOf(ours, "List[Rule[List[1, 0], 2], Rule[List[0, 1], 3]]")).toBe("agree");
    expect(verdictOf(ours, "List[Rule[List[1, 0], 2], Rule[List[0, 1], 4]]")).toBe("disagree");
  });

  test("an Association is its entries, in order, and is not a list of rules", () => {
    const ours = ["Association", ["Rule", "a", 1], ["Rule", "b", 2]] as MathJSON;
    expect(verdictOf(ours, "Association[Rule[a, 1], Rule[b, 2]]")).toBe("agree");
    expect(verdictOf(ours, "Association[Rule[a, 1], Rule[b, 3]]")).toBe("disagree");
    expect(verdictOf(ours, "Association[Rule[b, 2], Rule[a, 1]]")).toBe("disagree");
    expect(verdictOf(ours, "List[Rule[a, 1], Rule[b, 2]]")).toBe("disagree");
  });

  test("a delayed rule is not a rule", () => {
    const ours = ["RuleDelayed", "x", 2] as MathJSON;
    expect(verdictOf(ours, "RuleDelayed[x, 2]")).toBe("agree");
    expect(verdictOf(ours, "Rule[x, 2]")).toBe("disagree");
    expect(verdictOf(["Rule", "x", 2], "RuleDelayed[x, 2]")).toBe("disagree");
  });
});

describe("comparison past the double range and of exact rationals", () => {
  test("decimals too large for a double still compare by their digits", () => {
    expect(compare("5.57316894480137913364e+373", "5.57316894480137913364320296291e+373")).toBe("agree");
    expect(compare("5.57316894480137913364e+373", "5.57316894480137913364e+372")).toBe("disagree");
  });
  test("a SymPy list of rationals parses", () => {
    expect(parsePython("[1/6, -1/30, 1/42]")).toEqual([1 / 6, -1 / 30, 1 / 42]);
  });
});

test("a real tagged with its precision or accuracy is compared within it", () => {
  const tagged = (text: string) => reduce(fromWolfram(text, { tags: true }) as MathJSON, symbolic);
  // Precision: relative error. Accuracy: absolute error, so a zero is zero within 10^-a.
  expect(compareTrees(0.124, tagged("0.125`2."))).toBe("agree");
  expect(compareTrees(0.2, tagged("0.125`2."))).toBe("disagree");
  expect(compareTrees(-0, tagged("0``69.3"))).toBe("agree");
  // The tag widens the tolerance, never narrows it: with a tight one, accuracy 69.3 is what bounds the zero.
  expect(compareTrees(1e-75, tagged("0``69.3"), 1e-90)).toBe("agree");
  expect(compareTrees(1e-60, tagged("0``69.3"), 1e-90)).toBe("disagree");
  // Past double range, the scale and the leading figures decide.
  const big = tagged("9.9006562292958982507`15.95*^301029");
  expect(compareTrees(scaled("9.9006562292958982507e+301029") as Approximate, big)).toBe("agree");
  expect(compareTrees(scaled("9.91e+301029") as Approximate, big)).toBe("disagree");
  expect(compareTrees(9.9e300, big)).toBe("disagree");
  expect(compareTrees("x", tagged("0.125`2."))).toBe("disagree");
});

test("scaled reads a decimal's mantissa and exponent", () => {
  expect(scaled("-2.0e-340")).toEqual({ mantissa: -2, exponent: -340 });
  expect(scaled("0.00123")).toEqual({ mantissa: 1.23, exponent: -3 });
  expect(scaled("12500")).toEqual({ mantissa: 1.25, exponent: 4 });
  expect(scaled("0.0")).toEqual({ mantissa: 0, exponent: 0 });
  expect(scaled("abc")).toBeUndefined();
});
