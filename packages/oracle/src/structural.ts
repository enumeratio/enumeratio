// Comparing two MathJSON answers by VALUE, not by spelling.
//
// `compare` (compare.ts) works on printed text, which is all the Python-family systems
// give us. Wolfram can print `FullForm`, which `fromWolfram` parses back to MathJSON — so
// its answer and our pinned `expected` can both be reduced to the same shape: numbers where
// a number exists, lists recursively, and a canonical text for whatever is left symbolic.
// `["Rational", 157, 50]` and `3.14` then agree, `{{2, 3}, {3, 2}}` and
// `["List", ["Tuple", 2, 3], ["Tuple", 3, 2]]` agree, and `["PolyLog", 2.5, 2]` against
// `Complex[2.79, -1.36]` is a disagreement to classify rather than a shrug.
//
// Reducing a leaf needs an evaluator, which is the caller's compute-engine; this module
// stays engine-free so it can be tested on plain trees.

import type { MathJSON } from "./emit.ts";
import type { Verdict } from "./compare.ts";

/** What a leaf reduces to: a real, a complex, a truth value, or a canonical symbolic text. */
export type Leaf = number | boolean | { readonly re: number; readonly im: number } | string;
export type Tree = Leaf | readonly Tree[];

/** Heads whose operands are compared element-wise. `Set` is reduced order-free. */
const SEQUENCE_HEADS = new Set(["List", "Tuple", "Set"]);

/** Numbers by value, everything else by its text — a stable order for a Set. */
const byValue = (a: Tree, b: Tree): number =>
  typeof a === "number" && typeof b === "number" ? a - b : JSON.stringify(a).localeCompare(JSON.stringify(b));

/** The canonical text for something that did not reduce to a value. */
export const symbolic = (expr: MathJSON): string => (typeof expr === "string" ? expr : JSON.stringify(expr));

/** Named constants a numeric value may mention, as `fromWolfram` spells them. */
const CONSTANTS = new Set(["Pi", "ExponentialE", "ImaginaryUnit", "GoldenRatio", "EulerGamma", "CatalanConstant"]);

/** Heads that only build a number from numbers. */
const ARITHMETIC = new Set([
  "Rational",
  "Complex",
  "Add",
  "Subtract",
  "Negate",
  "Multiply",
  "Divide",
  "Power",
  "Sqrt",
  "Root",
  "N",
]);

/**
 * Whether `expr` is a numeric value: numbers and named constants under arithmetic.
 * `MatrixRank[{1, 2, 3}]` is not, however the arguments look — it is a call the other
 * system declined.
 */
export const isNumericValue = (expr: MathJSON): boolean => {
  if (typeof expr === "number") return true;
  if (typeof expr === "string") return CONSTANTS.has(expr);
  if (!Array.isArray(expr) || typeof expr[0] !== "string" || !ARITHMETIC.has(expr[0])) {
    return false;
  }
  return expr.length > 1 && expr.slice(1).every(isNumericValue);
};

/**
 * Gate an evaluator to numeric values, leaving anything else as its symbolic text — for
 * another system's answer, which our engine must not evaluate on that system's behalf.
 */
export const valuesOnly =
  (evaluate: (expr: MathJSON) => Leaf) =>
  (expr: MathJSON): Leaf =>
    isNumericValue(expr) ? evaluate(expr) : symbolic(expr);

/**
 * Reduce `expr` to a comparable tree. `evaluate` turns a non-sequence node into a leaf —
 * a number when it has one, else its symbolic text (`symbolic` is a fine fallback).
 */
export function reduce(expr: MathJSON, evaluate: (expr: MathJSON) => Leaf): Tree {
  if (Array.isArray(expr) && typeof expr[0] === "string" && SEQUENCE_HEADS.has(expr[0])) {
    const items = expr.slice(1).map((item) => reduce(item, evaluate));
    return expr[0] === "Set" ? [...items].sort(byValue) : items;
  }
  if (typeof expr === "boolean") return expr;
  // Truth values are the symbols on both sides (fromWolfram reads `True` as "True"); an
  // evaluator that only reads values (`symbolic`, `valuesOnly`) would leave them as text.
  if (expr === "True") return true;
  if (expr === "False") return false;
  return evaluate(expr);
}

const close = (a: number, b: number, tolerance: number): boolean =>
  Number.isNaN(a) && Number.isNaN(b) ? true : Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

const isComplex = (leaf: Leaf): leaf is { re: number; im: number } => typeof leaf === "object" && leaf !== null;

/** Compare two reduced trees: element-wise, numerically within `tolerance`, textually
 * last. Never `inconclusive`: a parsed answer is always either the same or different. */
export function compareTrees(ours: Tree, theirs: Tree, tolerance = 1e-9): Verdict {
  if (Array.isArray(ours) || Array.isArray(theirs)) {
    if (!Array.isArray(ours) || !Array.isArray(theirs) || ours.length !== theirs.length) {
      return "disagree";
    }
    let verdict: Verdict = "agree";
    for (let i = 0; i < ours.length; i++) {
      const v = compareTrees(ours[i] as Tree, theirs[i] as Tree, tolerance);
      if (v === "disagree") return "disagree";
      if (v === "inconclusive") verdict = "inconclusive";
    }
    return verdict;
  }
  const a = ours as Leaf;
  const b = theirs as Leaf;
  if (typeof a === "number" && typeof b === "number") {
    return close(a, b, tolerance) ? "agree" : "disagree";
  }
  if (typeof a === "boolean" || typeof b === "boolean") return a === b ? "agree" : "disagree";
  if (isComplex(a) || isComplex(b)) {
    const ca = isComplex(a) ? a : typeof a === "number" ? { re: a, im: 0 } : undefined;
    const cb = isComplex(b) ? b : typeof b === "number" ? { re: b, im: 0 } : undefined;
    if (ca === undefined || cb === undefined) return "disagree";
    return close(ca.re, cb.re, tolerance) && close(ca.im, cb.im, tolerance) ? "agree" : "disagree";
  }
  // A value on one side and a symbol on the other IS a finding — one system evaluated
  // where the other declined — so it is a disagreement to classify, not a shrug.
  return a === b ? "agree" : "disagree";
}
