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
 * answer for. On its own that says nothing about ours: `outsideCrateDomain` says why. */
const CRATE_DECLINES =
  /non-finite result|statrs:|`Err` value|no value: |machine word|non-negative integer|no factorization|digits below the base|unit part/;
export const crateDeclines = (theirs: string): boolean => CRATE_DECLINES.test(theirs);

// ── what a literal expression is worth, to judge a sample's arguments ──

/** A literal expression's value as a double, `undefined` when it isn't plain arithmetic on numbers
 * (or leaves the reals, or divides by zero). */
export function numeric(expr: MathJSON): number | undefined {
  if (typeof expr === "number") return expr;
  if (isBigNumber(expr)) return Number(expr.num);
  if (expr === "Pi") return Math.PI;
  if (expr === "ExponentialE") return Math.E;
  if (!Array.isArray(expr) || typeof expr[0] !== "string") return undefined;
  const [head, ...ops] = expr as readonly MathJSON[];
  const values = ops.map(numeric);
  if (values.some((v) => v === undefined)) return undefined;
  const v = values as number[];
  const finite = (x: number): number | undefined => (Number.isFinite(x) ? x : undefined);
  switch (head) {
    case "Rational":
    case "Divide":
      return v.length === 2 && v[1] !== 0 ? finite((v[0] as number) / (v[1] as number)) : undefined;
    case "Negate":
      return v.length === 1 ? -(v[0] as number) : undefined;
    case "Add":
      return finite(v.reduce((a, b) => a + b, 0));
    case "Subtract":
      return v.length === 2 ? (v[0] as number) - (v[1] as number) : undefined;
    case "Multiply":
      return finite(v.reduce((a, b) => a * b, 1));
    case "Power":
      return v.length === 2 ? finite((v[0] as number) ** (v[1] as number)) : undefined;
    case "Sqrt":
      return v.length === 1 && (v[0] as number) >= 0 ? Math.sqrt(v[0] as number) : undefined;
    default:
      return undefined;
  }
}

/** `expr` as a rational multiple of π (`[p, q]`), when it is one with a small denominator. */
function piMultiple(expr: MathJSON): [number, number] | undefined {
  const v = numeric(expr);
  if (v === undefined) return undefined;
  if (v === 0) return [0, 1];
  const q = v / Math.PI;
  for (let d = 1; d <= 24; d++) {
    const p = Math.round(q * d);
    if (Math.abs(q * d - p) <= 1e-9 * Math.max(1, Math.abs(q * d))) return [p, d];
  }
  return undefined;
}

/** Whether `head(arg)` has an exact zero there: a trig value at a multiple of π, or ln Γ at 1 or 2. */
function exactZeroAt(head: string, arg: MathJSON): boolean {
  if (head === "LogGamma" || head === "GammaLn") return [1, 2].includes(numeric(arg) as number);
  const m = piMultiple(arg);
  if (m === undefined) return false;
  if (head === "Sin" || head === "Tan") return m[1] === 1;
  if (head === "Cos" || head === "Cot") return m[1] === 2 && Math.abs(m[0]) % 2 === 1;
  return false;
}

/** The call a sample is, inside an `N`. */
const innerCall = (sample: MathJSON): readonly MathJSON[] | undefined => {
  const call = Array.isArray(sample) && sample[0] === "N" ? sample[1] : sample;
  return Array.isArray(call) && typeof call[0] === "string" ? (call as readonly MathJSON[]) : undefined;
};

/** Whether `ours` is the exact zero a double only approaches: the sample is one call with an exact
 * zero there (a trig value at a multiple of π, ln Γ(1)), and theirs is rounding noise around it. */
export function roundsToZero(sample: MathJSON, ours: MathJSON, theirs: string): boolean {
  const call = innerCall(sample);
  const other = parts(theirs);
  return (
    numeric(ours) === 0 &&
    call !== undefined &&
    call.length === 2 &&
    exactZeroAt(call[0] as string, call[1] as MathJSON) &&
    other?.length === 1 &&
    Math.abs(other[0] as number) <= 1e-12
  );
}

const NON_ANSWERS = ["ComplexInfinity", "PositiveInfinity", "NegativeInfinity", "NaN", "Indeterminate"];
const isNonAnswer = (ours: MathJSON): boolean =>
  (typeof ours === "string" && NON_ANSWERS.includes(ours)) || (Array.isArray(ours) && ours[0] === "Error");
/** Whether `ours` holds a non-answer (a pole, an undefined form or an error) anywhere in it. */
export function hasNonAnswer(ours: MathJSON): boolean {
  return isNonAnswer(ours) || (Array.isArray(ours) && ours.some((part) => hasNonAnswer(part as MathJSON)));
}

/** Whether a call of `head` on `arg` sits at a pole, and a crate's finite `answer` there is a blow-up: the
 * pole's distance 1/(|answer| n!) from a double's rounding, with the pole's sign. At Γ(-n) the answer is
 * anywhere from 1e7 to 1e16 as n grows, so the floor is on the distance, not the size. */
function blowsUpAt(head: string, arg: MathJSON, answer: number): boolean {
  if (head === "Gamma") {
    const v = numeric(arg);
    if (v === undefined || !Number.isInteger(v) || v > 0) return false;
    const n = -v;
    let factorial = 1;
    for (let k = 2; k <= n && factorial < Infinity; k++) factorial *= k;
    return Math.sign(answer) === (n % 2 === 0 ? 1 : -1) && Math.abs(answer) * factorial >= 1e10;
  }
  if (Math.abs(answer) < 1e15) return false;
  const m = piMultiple(arg);
  if (m === undefined) return false;
  if (head === "Tan" || head === "Sec") return m[1] === 2 && Math.abs(m[0]) % 2 === 1;
  if (head === "Cot" || head === "Csc") return m[1] === 1;
  return false;
}

/** Whether a crate's huge finite double stands where ours says a pole, and only there: a sample of
 * one pole-having head, element by element, where each non-answer of ours is at a pole of the head
 * and the crate answers a blow-up there (`blowsUpAt`), and every other element agrees (or is an exact zero beside rounding noise). */
export function overshootsPole(sample: MathJSON, ours: MathJSON, theirs: string): boolean {
  const call = innerCall(sample);
  if (call === undefined || call.length !== 2 || !["Gamma", "Sec", "Csc", "Tan", "Cot"].includes(call[0] as string))
    return false;
  let printed: unknown;
  try {
    printed = JSON.parse(theirs);
  } catch {
    return false;
  }
  const head = call[0] as string;
  let atPole = false;
  const walk = (arg: MathJSON, mine: MathJSON, other: unknown): boolean => {
    if (Array.isArray(arg) && arg[0] === "List") {
      if (!Array.isArray(mine) || mine[0] !== "List" || !Array.isArray(other) || mine.length !== arg.length)
        return false;
      if (other.length !== arg.length - 1) return false;
      return arg.slice(1).every((a, i) => walk(a as MathJSON, mine[i + 1] as MathJSON, other[i]));
    }
    if (typeof other !== "number") return false;
    if (isNonAnswer(mine)) {
      atPole = true;
      return blowsUpAt(head, arg, other);
    }
    const x = numeric(mine);
    const y = other;
    if (x === undefined) return false;
    if (x === 0) return exactZeroAt(head, arg) && Math.abs(y) <= 1e-12;
    return Math.abs(x - y) <= 1e-9 * Math.max(Math.abs(x), Math.abs(y));
  };
  return walk(call[1] as MathJSON, ours, printed) && atPole;
}

/** Whether the sample has a call of `head` with a negative literal argument. */
export function hasNegativeArgument(sample: MathJSON, head: string): boolean {
  if (!Array.isArray(sample) || typeof sample[0] !== "string") return false;
  const [name, ...ops] = sample as readonly MathJSON[];
  if (name === head && ops.some((op) => (numeric(op) ?? 0) < 0)) return true;
  return ops.some((op) => hasNegativeArgument(op, head));
}

const WORD = 2 ** 64;
/** Whether the sample has a call whose literal arguments leave what the Rust crate takes: its real
 * logarithm, root and inverse trigonometric domains, statrs's argument ranges (`gamma`, `beta`, …),
 * a machine-word or unsigned integer, a zero it can't factor, a digit past its base, a division by
 * zero. A sample the crate declines for any other reason, or on arguments it can't read, stays a finding. */
export function outsideCrateDomain(sample: MathJSON): boolean {
  if (!Array.isArray(sample) || typeof sample[0] !== "string") return false;
  const [head, ...ops] = sample as readonly MathJSON[];
  if (ops.some((op) => outsideCrateDomain(op))) return true;
  // A list threads: any of its readable elements outside the domain is enough.
  const elements = (op: MathJSON | undefined): number[] =>
    Array.isArray(op) && op[0] === "List"
      ? op.slice(1).flatMap((item) => elements(item as MathJSON))
      : op === undefined || numeric(op) === undefined
        ? []
        : [numeric(op) as number];
  const bad = (i: number, outside: (x: number) => boolean): boolean => elements(ops[i]).some(outside);
  switch (head) {
    case "Divide":
      return bad(1, (x) => x === 0);
    case "Sqrt":
      return bad(0, (x) => x < 0);
    case "Ln":
    case "Log2":
    case "Log10":
    case "Lb":
      return bad(0, (x) => x <= 0);
    case "Log":
      return bad(0, (x) => x <= 0) || bad(1, (x) => x <= 0 || x === 1);
    case "Arcsin":
    case "Arccos":
      return bad(0, (x) => Math.abs(x) > 1);
    case "Arcosh":
      return bad(0, (x) => x < 1);
    case "Arctanh":
      return bad(0, (x) => Math.abs(x) >= 1);
    case "Arcoth":
      return bad(0, (x) => Math.abs(x) <= 1);
    case "Arsech":
      return bad(0, (x) => x <= 0 || x > 1);
    case "InverseErfc":
      return bad(0, (x) => x < 0 || x > 2);
    case "LogGamma":
    case "GammaLn":
      return bad(0, (x) => x <= 0);
    case "Gamma":
      return ops.length === 1
        ? bad(0, (x) => Number.isInteger(x) && x <= 0)
        : ops.length === 2 && (bad(0, (x) => x <= 0) || bad(1, (x) => x < 0));
    case "GammaRegularized":
      return bad(0, (x) => x <= 0) || bad(1, (x) => x < 0);
    case "Beta":
      return bad(0, (x) => x <= 0) || bad(1, (x) => x <= 0);
    case "BetaRegularized":
      return bad(0, (x) => x < 0 || x > 1) || bad(1, (x) => x <= 0) || bad(2, (x) => x <= 0);
    case "InverseBetaRegularized":
      return bad(0, (x) => x < 0 || x > 1) || bad(1, (x) => x <= 0) || bad(2, (x) => x <= 0);
    case "ExpIntegralE":
      return bad(1, (x) => x < 0);
    case "IsPrime":
    case "IsComposite":
    case "IsPrimePower":
      return bad(0, (x) => x < 0 || x >= WORD);
    case "IsSquareFree":
    case "PrimeNu":
    case "PrimeOmega":
    case "FactorInteger":
      return bad(0, (x) => x <= 0 || x > 1e18);
    case "FromDigits": {
      const base = numeric(ops[1] as MathJSON);
      return base !== undefined && elements(ops[0]).some((d) => d < 0 || d >= base);
    }
    case "AdicDigits":
    case "AdicExpansion": {
      const value = Array.isArray(ops[0]) && ops[0][0] === "AdicNumeral" ? numeric(ops[0][2] as MathJSON) : undefined;
      return value === 0;
    }
    default:
      return false;
  }
}

/** Whether `ours` is a call left unevaluated on plain numbers (`Log(-1, 2)`, `ErfInv(1.01)`). */
export const isStuckCall = (ours: MathJSON): boolean =>
  Array.isArray(ours) &&
  typeof ours[0] === "string" &&
  !["Complex", "Rational", "List", "Error"].includes(ours[0]) &&
  ours.length > 1 &&
  ours.slice(1).every((op) => typeof op === "number" || isBigNumber(op));
