// How one oracle answer is judged against our pinned value — shared by the scan
// (oracle-scan.ts) and the sampler (oracle-quickcheck.ts), so both mean the same thing
// by "agree".

import { ComputeEngine } from "@cortex-js/compute-engine";
import {
  compare,
  compareCombination,
  compareCombinations,
  comparePythonStructured,
  compareTrees,
  type Leaf,
  type MathJSON,
  reduce,
  symbolic,
  type System,
  type Tree,
  type Verdict,
  valuesOnly,
} from "@enumeratio/oracle/src";
import { fromWolfram } from "@enumeratio/wolfram/src";

const ce = new ComputeEngine();

/**
 * A leaf of the comparison: the number an expression has, else its symbolic text.
 *
 * The pinned `expected` is MathJSON, and the first version of this compared it as raw text
 * against a system's printed output — so `["Rational",-1,2]` "disagreed" with `-1/2`, and
 * `["Multiply",["Rational",1,6],["Power","Pi",2]]` with `Pi^2/6`. Those inflated the count
 * with pure notation and buried the real divergences.
 */
export const leaf = (expr: MathJSON): Leaf => {
  try {
    const boxed = ce.box(expr as Parameters<ComputeEngine["box"]>[0]).N();
    // `.symbol` lives on the narrowed SymbolInterface, with no typed route from the union.
    const name = (boxed as { symbol?: unknown }).symbol;
    if (name === "True") return true;
    if (name === "False") return false;
    const { re, im } = boxed;
    if (typeof re === "number" && Number.isFinite(re)) {
      return typeof im === "number" && im !== 0 && Number.isFinite(im) ? { re, im } : re;
    }
  } catch {
    // fall through to the textual form
  }
  return symbolic(expr);
};

/** Our side of a TEXT comparison (the Python-family systems): the number, else the JSON. */
export const show = (expr: MathJSON): string => {
  // A list prints as the systems print one, element by element.
  if (Array.isArray(expr) && expr[0] === "List") return `[${expr.slice(1).map(show).join(", ")}]`;
  const value = leaf(expr);
  return typeof value === "number"
    ? String(value)
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
};

/** Wolfram's answer, parsed and reduced by `evaluate`; `undefined` when it cannot be read. */
const theirTree = (fullForm: string, evaluate: (expr: MathJSON) => Leaf): Tree | undefined => {
  try {
    return reduce(fromWolfram(fullForm) as MathJSON, evaluate);
  } catch {
    return undefined;
  }
};

/** A system's answer: its printed value, and for Wolfram its numeric form too. */
export interface Answer {
  readonly value?: string;
  readonly numeric?: string;
}

export function verdictOf(
  system: System,
  expected: MathJSON,
  result: Answer,
  tolerance?: number,
): Verdict {
  const theirs = result.value ?? "";
  let verdict: Verdict;
  if (system === "wolfram") {
    // Wolfram's answer is never evaluated by our engine on its behalf, or a call it
    // declined (`MatrixRank[{1, 2, 3}]`) comes back as our own answer and agrees. So its
    // exact form is compared as text — an unevaluated form we pinned too — and its
    // numbers are Wolfram's own `N`, of which only numeric values are read as numbers.
    const ours = reduce(expected, leaf);
    const trees = [
      theirTree(theirs, symbolic),
      result.numeric === undefined ? undefined : theirTree(result.numeric, valuesOnly(leaf)),
    ].filter((tree) => tree !== undefined);
    const verdicts = trees.map((tree) => compareTrees(ours, tree, tolerance));
    verdict =
      verdicts.length === 0
        ? "inconclusive"
        : verdicts.includes("agree")
          ? "agree"
          : (verdicts[0] as Verdict);
  } else if (theirs.startsWith("combination:")) {
    verdict = compareCombination(expected, theirs);
  } else if (theirs.startsWith("combinations:")) {
    verdict = compareCombinations(expected, theirs);
  } else {
    verdict = compare(show(expected), theirs, tolerance);
    // A text comparison that disagrees or can't decide (a complex against a real, say)
    // gets a second, structural look.
    if (verdict !== "agree") {
      const structured = comparePythonStructured(reduce(expected, leaf), theirs, tolerance);
      if (structured === "agree") verdict = structured;
    }
  }
  return verdict;
}
