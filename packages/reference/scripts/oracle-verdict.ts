// How one oracle answer is judged against our pinned value — shared by the scan
// (oracle-scan.ts) and the sampler (oracle-plausible.ts), so both mean the same thing
// by "agree".

import { ComputeEngine } from "@cortex-js/compute-engine";
import {
  CARRIER_NAMES,
  compare,
  compareCombination,
  compareCombinations,
  comparePythonStructured,
  compareTrees,
  type Leaf,
  type MathJSON,
  reduce,
  solutionSet,
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
  // A carrier constructor call prints as its contents — the Python-family systems' own
  // encoding is the bare structure, no head wrapper (structural.ts's `reduce` does the same
  // unwrap for the Wolfram path; see https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5).
  if (Array.isArray(expr) && typeof expr[0] === "string" && CARRIER_NAMES.has(expr[0]) && expr.length === 2) {
    return show(expr[1] as MathJSON);
  }
  // A list prints as the systems print one, element by element.
  if (Array.isArray(expr) && expr[0] === "List") return `[${expr.slice(1).map(show).join(", ")}]`;
  // A bignum keeps its digits: as a double, 5.57e+373 would print as Infinity.
  if (
    typeof expr === "object" &&
    expr !== null &&
    !Array.isArray(expr) &&
    typeof (expr as { num?: unknown }).num === "string"
  )
    return (expr as { num: string }).num;
  const value = leaf(expr);
  return typeof value === "number" ? String(value) : typeof value === "string" ? value : JSON.stringify(value);
};

/** Wolfram's answer, parsed and reduced by `evaluate`; `undefined` when it cannot be read. */
const theirTree = (
  fullForm: string,
  evaluate: (expr: MathJSON) => Leaf,
  prepare: (expr: MathJSON) => MathJSON = (expr) => expr,
): Tree | undefined => {
  try {
    return reduce(prepare(fromWolfram(fullForm) as MathJSON), evaluate);
  } catch {
    return undefined;
  }
};

/** A system's answer: its printed value, and for Wolfram its numeric form too, and the
 * digits it displays for an arbitrary-precision value. */
export interface Answer {
  readonly value?: string;
  readonly numeric?: string;
  readonly shown?: string;
}

/** An example that asks for digits, `N(x, d)`: its answer promises every digit it shows. */
export const asksForDigits = (expr: MathJSON): boolean => Array.isArray(expr) && expr[0] === "N" && expr.length === 3;

/** A decimal's significant digits alone -- no sign, point, exponent, or leading and trailing
 * zeros -- so `"0.1250"` and `"1.25e-1"` read the same. */
const significant = (text: string): string =>
  text
    .replace(/[eE].*$/, "")
    .replace(/[^0-9]/g, "")
    .replace(/^0+/, "")
    .replace(/0+$/, "");

/** Every non-integer number in `expr`, in order, as its significant digits: the digits an
 * `N(x, d)` answer promises. */
function ourDigits(expr: MathJSON): string[] {
  if (Array.isArray(expr)) return expr.flatMap((node) => ourDigits(node as MathJSON));
  const text =
    typeof expr === "number"
      ? String(expr)
      : typeof expr === "object" && expr !== null && typeof (expr as { num?: unknown }).num === "string"
        ? (expr as { num: string }).num
        : undefined;
  return text === undefined || !/[.eE]/.test(text) ? [] : [significant(text)];
}

/** Our side of a Wolfram comparison: Wolfram has no NaN, it spells "no value" `Indeterminate`
 * (emit.ts maps both of ours there), so the two read as one. */
const wolframLeaf = (expr: MathJSON): Leaf => {
  const value = leaf(expr);
  return value === "NaN" ? "Indeterminate" : value;
};

/**
 * Do the digits Wolfram displays match ours, digit for digit? For an `N(x, d)` example, where
 * the last digit is the point: the tolerant comparison can't see it, and Wolfram holds more
 * digits than it shows. `undefined` when the two can't be lined up number for number.
 */
export function sameDigits(expected: MathJSON, shown: string): boolean | undefined {
  // A lone integer (`N(E, 1)` is 3) has no decimal point, but its digits are still promised.
  const ours = typeof expected === "number" ? [significant(String(expected))] : ourDigits(expected);
  const theirs = (shown.match(/\d+\.\d*|\.\d+/g) ?? []).map(significant);
  if (ours.length === 0 || ours.length !== theirs.length) return undefined;
  return ours.every((digits, i) => digits === theirs[i]);
}

/** The widest error bar, relative above magnitude 1, a measurement is read at: past it (a
 * Monte Carlo ±0.018) it is too rough to stand for a value, and is held to the usual
 * tolerance instead. */
export const MAX_MEASURED_TOLERANCE = 1e-6;

/** A `Measurement(value, error)` (a numeric integral) as its value and the tolerance its bar
 * earns, or `undefined` for anything else. */
export function measured(expected: MathJSON): { value: MathJSON; tolerance?: number } | undefined {
  if (!Array.isArray(expected) || expected[0] !== "Measurement" || expected.length !== 3) return undefined;
  const value = expected[1] as MathJSON;
  const [v, error] = [leaf(value), leaf(expected[2] as MathJSON)];
  const size = typeof v === "number" ? Math.abs(v) : typeof v === "object" ? Math.hypot(v.re, v.im) : Number.NaN;
  if (typeof error !== "number" || !(error >= 0) || Number.isNaN(size)) return { value };
  const relative = error / Math.max(1, size);
  return relative <= MAX_MEASURED_TOLERANCE ? { value, tolerance: relative } : { value };
}

export function verdictOf(
  system: System,
  expected: MathJSON,
  result: Answer,
  tolerance?: number,
  /** An `N(x, d)` example: Wolfram's displayed digits must match ours, the last included. */
  asksForDigits = false,
  /** The example's expression: a `Solve` answers rules in Wolfram and values here, compared as a set. */
  call?: MathJSON,
): Verdict {
  // A measurement agrees with a value its error bar holds.
  const measurement = measured(expected);
  if (measurement !== undefined) {
    expected = measurement.value;
    // 1e-9 is `compare`'s and `compareTrees`' own default.
    if (measurement.tolerance !== undefined) tolerance = Math.max(tolerance ?? 1e-9, measurement.tolerance);
  }
  const theirs = result.value ?? "";
  let verdict: Verdict;
  if (system === "wolfram") {
    // Wolfram's answer is never evaluated by our engine on its behalf, or a call it
    // declined (`MatrixRank[{1, 2, 3}]`) comes back as our own answer and agrees. So its
    // exact form is compared as text — an unevaluated form we pinned too — and its
    // numbers are Wolfram's own `N`, of which only numeric values are read as numbers.
    const prepare =
      Array.isArray(call) && call[0] === "Solve" ? (expr: MathJSON) => solutionSet(expr, call) : undefined;
    const ours = reduce(prepare === undefined ? expected : prepare(expected), wolframLeaf);
    const trees = [
      theirTree(theirs, symbolic, prepare),
      result.numeric === undefined ? undefined : theirTree(result.numeric, valuesOnly(leaf), prepare),
    ].filter((tree) => tree !== undefined);
    const verdicts = trees.map((tree) => compareTrees(ours, tree, tolerance));
    verdict = verdicts.length === 0 ? "inconclusive" : verdicts.includes("agree") ? "agree" : (verdicts[0] as Verdict);
    // The digits Wolfram displays are the answer: it keeps more than it shows, so the value
    // alone is too strict (N[E, 1] holds 2.718 and shows 3.) as well as too loose.
    if (asksForDigits && result.shown !== undefined) {
      const same = sameDigits(expected, result.shown);
      if (same !== undefined) verdict = same ? "agree" : "disagree";
    }
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
