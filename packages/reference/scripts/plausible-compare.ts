// How Plausible compares a sample's answer with another system's printed one.

import type { MathJSON } from "@enumeratio/oracle";

/** The most significant figures `roundsTo` checks: it rounds in doubles. */
const MAX_ROUNDING_DIGITS = 15;

/** The identity check's own "could not decide" (`None`) is no finding, but a plain lane that
 * prints `None` is. */
export const undecidedIdentity = (symbolic: boolean, theirs: string): boolean => symbolic && theirs.trim() === "None";

const isBigNumber = (x: unknown): x is { num: string } =>
  typeof x === "object" && x !== null && typeof (x as { num?: unknown }).num === "string";

/** A value as its parts: a real, or a Python complex literal `(a+bj)`, or ours' `Complex`. */
export function parts(value: unknown, bignum = false): number[] | undefined {
  const real = (x: unknown): number | undefined =>
    typeof x === "number" ? x : bignum && isBigNumber(x) ? Number(x.num) : undefined;
  if (real(value) !== undefined) return [real(value) as number];
  if (Array.isArray(value) && value[0] === "Complex" && value.length === 3) {
    const [re, im] = [real(value[1]), real(value[2])];
    return re !== undefined && im !== undefined ? [re, im] : undefined;
  }
  if (typeof value !== "string") return undefined;
  const complex = /^\(?\s*([-+]?[\d.]+(?:e[-+]?\d+)?)\s*([-+]\s*[\d.]+(?:e[-+]?\d+)?)j\)?$/i.exec(value.trim());
  if (complex !== null) return [Number(complex[1]), Number((complex[2] as string).replace(/\s/g, ""))];
  const plain = Number(value);
  return value.trim() !== "" && Number.isFinite(plain) ? [plain] : undefined;
}

/** Whether two numbers, real or complex, are within 1e-9 of each other relative to their size. */
export function agreesInNorm(ours: MathJSON, theirs: string): boolean {
  const [a, b] = [parts(ours), parts(theirs)];
  if (a === undefined || b === undefined) return false;
  const [ar, ai = 0] = a;
  const [br, bi = 0] = b;
  return Math.hypot(ar - br, ai - bi) <= 1e-9 * Math.max(Math.hypot(ar, ai), Math.hypot(br, bi));
}

/** Whether two values differ by a Gaussian unit (1, -1, i or -i). */
export function associates(ours: MathJSON, theirs: string): boolean {
  const [a, b] = [parts(ours), parts(theirs)];
  if (a === undefined || b === undefined) return false;
  const [ar, ai = 0] = a;
  const [br, bi = 0] = b;
  const close = (x: number, y: number) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
  return [
    [br, bi],
    [-br, -bi],
    [-bi, br],
    [bi, -br],
  ].some(([r, i]) => close(r as number, ar) && close(i as number, ai));
}

/** Whether `theirs` (full precision) rounds to `ours` at the precision `N` was asked for: `d`
 * significant figures, or for `{precision, accuracy}` that many decimals. */
export function roundsTo(spec: MathJSON, ours: MathJSON, theirs: string): boolean {
  const digits = typeof spec === "number" ? spec : Array.isArray(spec) && spec[0] === "List" ? spec[1] : undefined;
  // Rounds in doubles: a bignum answer asked for more digits than a double holds is compared elsewhere.
  if (typeof digits === "number" && digits > MAX_ROUNDING_DIGITS) return false;
  // Ours is read with its bignum digits, theirs as the double it prints.
  const mine = parts(ours, true);
  const other = parts(theirs);
  if (mine === undefined || other === undefined || mine.length !== other.length) return false;
  const accuracy = Array.isArray(spec) && spec[0] === "List" ? spec[2] : undefined;
  return other.every((x, i) => {
    let scale: number;
    if (typeof accuracy === "number") scale = 10 ** accuracy;
    else if (typeof digits === "number") scale = x === 0 ? 1 : 10 ** (digits - 1 - Math.floor(Math.log10(Math.abs(x))));
    else return false;
    // Within half a unit of the last place asked for (an exact tie may round either way): a wrong final digit is a finding.
    return Math.abs(x - (mine[i] as number)) <= (0.5 / scale) * (1 + 1e-9);
  });
}

/** The Rust lane declining in its own words: a double that isn't finite, a crate's argument
 * error, a parameter that is a machine word or unsigned, a zero or a digit the crate has no
 * answer for. Where ours answers, that is a domain difference, not a disagreement. */
const CRATE_DECLINES =
  /non-finite result|statrs:|`Err` value|no value: |machine word|non-negative integer|no factorization|digits below the base|unit part/;
export const crateDeclines = (theirs: string): boolean => CRATE_DECLINES.test(theirs);

/** Whether `ours` is an exact zero that `theirs` (a double) lands within rounding of: a double
 * can't hit the zero of a trig value at a multiple of π, or of `ln Γ(1)`, exactly. */
export function roundsToZero(ours: MathJSON, theirs: string): boolean {
  const other = parts(theirs);
  return ours === 0 && other?.length === 1 && Math.abs(other[0] as number) <= 1e-12;
}

/** Whether a printed answer holds a double past 1e15 in size: a crate's value beside a pole
 * it can't reach exactly (statrs's `gamma(-1)` is -2.6e16). */
export const hasHugeDouble = (theirs: string): boolean =>
  [...theirs.matchAll(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)].some((m) => Math.abs(Number(m[0])) >= 1e15);

const NON_ANSWERS = ["ComplexInfinity", "PositiveInfinity", "NegativeInfinity", "NaN", "Indeterminate"];
/** Whether `ours` holds a non-answer (a pole, an undefined form or an error) anywhere in it. */
export function hasNonAnswer(ours: MathJSON): boolean {
  if (typeof ours === "string") return NON_ANSWERS.includes(ours);
  return Array.isArray(ours) && (ours[0] === "Error" || ours.some((part) => hasNonAnswer(part as MathJSON)));
}

/** Whether `ours` is a call left unevaluated on plain numbers (`Log(-1, 2)`, `ErfInv(1.01)`). */
export const isStuckCall = (ours: MathJSON): boolean =>
  Array.isArray(ours) &&
  typeof ours[0] === "string" &&
  !["Complex", "Rational", "List", "Error"].includes(ours[0]) &&
  ours.length > 1 &&
  ours.slice(1).every((op) => typeof op === "number" || isBigNumber(op));

/** Whether `ours` holds a bignum past what a double can hold (1e300 and up). */
export const exceedsDouble = (ours: MathJSON): boolean =>
  /"num":"[^"]*e\+(3\d\d|[4-9]\d\d|\d{4,})"/.test(JSON.stringify(ours));
