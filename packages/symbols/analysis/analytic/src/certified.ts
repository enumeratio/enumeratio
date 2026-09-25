import type { BoxedExpression } from "@cortex-js/compute-engine";
import { BigDecimal } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { type Ball, certify, exact, ln, lower, mul, rational } from "./ball.ts";
import { barnesGBall } from "./barnes-g-big.ts";
import { atDigits } from "./bigzeta.ts";
import { hurwitzZetaBall } from "./hurwitz-ball.ts";
import { lerchPhiBall } from "./lerch-big.ts";
import { STIELTJES_MAX_ORDER } from "./special-functions.ts";
import { stieltjesGammaBall } from "./stieltjes-big.ts";

// Certified values: the heads whose arbitrary-precision kernels bound their own error, and so
// return an enclosure -- a ball proven to hold the true value -- rather than a point value.
// `N(x, d)` (correctly-rounded.ts) asks here first: when both ends of the enclosure round to
// the same d digits, those digits are proven, not just agreed on.
//
// A certificate starts from the arguments, so they must be known exactly: an integer, a
// rational, or a decimal literal, which compute-engine reads as the decimal it is written as.
// `Sqrt(2)` or `Pi` as an argument would arrive already rounded, by an evaluation that
// bounds nothing, so a head called on one is left to Ziv's agreement loop.

/** A head's kernel on the balls of its arguments, answering about `digits` digits. */
interface Certified {
  readonly arities: readonly number[];
  readonly kernel: (args: readonly Ball[], digits: number) => Ball | undefined;
}

/** ζ(s, a), a defaulting to 1: `Zeta(s)` is ζ(s, 1), and `Zeta(s, a)` is Hurwitz's for a > 0. */
const zeta: Certified = {
  arities: [1, 2],
  kernel: ([s, a], digits) => hurwitzZetaBall(s!, a ?? exact(1), digits),
};

const CERTIFIED: Readonly<Record<string, Certified>> = {
  BarnesG: { arities: [1], kernel: ([x], digits) => barnesGBall(x!, digits) },
  HurwitzZeta: { arities: [2], kernel: zeta.kernel },
  // ln G(x) for x > 0 only: on the negative axis the head continues with an imaginary part.
  LogBarnesG: {
    arities: [1],
    kernel: ([x], digits) => {
      if (!lower(x!).isPositive()) return undefined;
      const g = barnesGBall(x!, digits);
      return g && ln(g);
    },
  },
  LerchPhi: { arities: [3], kernel: ([z, s, a], digits) => lerchPhiBall(z!, s!, a!, digits) },
  PolyLog: {
    arities: [2],
    // Liₛ(z) = z·Φ(z, s, 1).
    kernel: ([s, z], digits) => {
      const phi = lerchPhiBall(z!, s!, exact(1), digits);
      return phi && mul(z!, phi);
    },
  },
  StieltjesGamma: {
    arities: [1, 2],
    // γₙ(a), a defaulting to 1, for an integer order the head evaluates.
    kernel: ([n, a], digits) => {
      const order = n!.rad.isZero() && n!.mid.isInteger() ? n!.mid.toNumber() : NaN;
      if (!(order >= 0 && order <= STIELTJES_MAX_ORDER)) return undefined;
      return stieltjesGammaBall(order, a ?? exact(1), digits);
    },
  },
  Zeta: zeta,
};

/** The heads `enclosure` can certify, for their reference entries and tests. */
export const CERTIFIED_HEADS: readonly string[] = Object.keys(CERTIFIED);

/** `head`'s certified kernel for `arity` arguments, or undefined when it has none: on balls
 * for them at the working precision, a ball holding its value, or undefined where the kernel
 * declines. */
export function kernelOf(
  head: string,
  arity: number,
): ((args: readonly Ball[]) => Ball | undefined) | undefined {
  const certified = CERTIFIED[head];
  if (certified === undefined || !certified.arities.includes(arity)) return undefined;
  return (args) => certify(() => certified.kernel(args, BigDecimal.precision));
}

/** A ball holding `x`'s value, about `digits` digits wide, or undefined when `x` is not a
 * certified head on exact arguments, or its kernel declines them. */
export function enclosure(x: BoxedExpression, digits: number): Ball | undefined {
  const ops = operandsOf(x);
  const kernel = kernelOf(x.operator, ops.length);
  if (kernel === undefined) return undefined;
  return atDigits(digits, () => {
    const args = ops.map(argumentBall);
    return args.every((arg) => arg !== undefined) ? kernel(args) : undefined;
  });
}

/** A plain decimal, as MathJSON writes a number's digits. */
const DECIMAL = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;

/** An exact argument's ball at the working precision -- radius 0 for an integer or a decimal,
 * the division's rounding for a rational -- or undefined for anything else. */
export function argumentBall(e: BoxedExpression): Ball | undefined {
  const json = e.json as unknown;
  const digits =
    typeof json === "number"
      ? String(json)
      : typeof json === "object" && json !== null && "num" in json
        ? String(json.num)
        : undefined;
  if (digits !== undefined) return DECIMAL.test(digits) ? exact(new BigDecimal(digits)) : undefined;
  if (Array.isArray(json) && json[0] === "Rational" && json.length === 3) {
    const [p, q] = [integerOf(json[1]), integerOf(json[2])];
    return p !== undefined && q !== undefined && q !== 0n ? rational(p, q) : undefined;
  }
  return undefined;
}

/** A MathJSON integer -- a number, or a `{ num }` too long for one. */
function integerOf(json: unknown): bigint | undefined {
  const text =
    typeof json === "number"
      ? String(json)
      : typeof json === "object" && json !== null && "num" in json
        ? String(json.num)
        : undefined;
  return text !== undefined && /^[-+]?\d+$/.test(text) ? BigInt(text) : undefined;
}
