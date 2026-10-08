import { bigRationalAt, type Engine, type Expr, isNumber } from "@enumeratio/engine";

// FunctionExpand of ExpIntegralE(n, z), as Wolfram's FunctionExpand gives it:
//   • integer n ≤ 0: e^(−z) times a Laurent polynomial in z;
//   • integer n ≥ 2: e^(−z) times a polynomial, plus a multiple of z^(n−1)·E₁(z);
//   • half-integer n: e^(−z) times a Laurent polynomial, plus a multiple of z^(n−1)·√π·erfc(√z);
//   • any other n, symbolic included: z^(n−1)·Γ(1−n, z).
// All of them are the recurrence  n·E_(n+1)(z) = e^(−z) − z·E_n(z)  run from a base order,
// E₀ = e^(−z)/z, E₁ (kept), or E_(1/2) = √π·erfc(√z)/√z, keeping E_n = e^(−z)·P_n(z) + c_n·z^(n−1)·base:
//   up:    P_(n+1) = (1 − z·P_n)/n,   c_(n+1) = −c_n/n
//   down:  P_n = (1 − n·P_(n+1))/z,   c_n = −n·c_(n+1).

/** Longest run of recurrence steps; a larger |n| is left alone. */
const MAX_STEPS = 40;

type Rational = readonly [bigint, bigint];
/** P(z) = Σ c·z^e, by exponent. */
type Laurent = Map<number, Rational>;

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const rational = (num: bigint, den: bigint): Rational => {
  const g = gcd(num, den) || 1n;
  return den < 0n ? [-num / g, -den / g] : [num / g, den / g];
};
const times = (a: Rational, b: Rational): Rational => rational(a[0] * b[0], a[1] * b[1]);
const over = (a: Rational, b: Rational): Rational => rational(a[0] * b[1], a[1] * b[0]);

/** The Laurent polynomial and base coefficient of E_n at n = base + steps, steps in either direction. */
function recur(base: Rational, start: { P: Laurent; c: Rational }, steps: number): { P: Laurent; c: Rational } {
  let { P, c } = start;
  let order = base;
  if (steps > 0) {
    for (let i = 0; i < steps; i++) {
      const next: Laurent = new Map([[0, over([1n, 1n], order)]]);
      for (const [e, coefficient] of P) next.set(e + 1, over([-coefficient[0], coefficient[1]], order));
      [P, c, order] = [next, over([-c[0], c[1]], order), rational(order[0] + order[1], order[1])];
    }
  } else {
    for (let i = 0; i < -steps; i++) {
      order = rational(order[0] - order[1], order[1]);
      const next: Laurent = new Map([[-1, [1n, 1n]]]);
      for (const [e, coefficient] of P) next.set(e - 1, times([-order[0], order[1]], coefficient));
      [P, c] = [next, times([-order[0], order[1]], c)];
    }
  }
  return { P, c };
}

const number = (ce: Engine, [num, den]: Rational): Expr =>
  den === 1n ? ce.number(num) : ce.function("Rational", [ce.number(num), ce.number(den)]);

/** E_n(z) in the forms above, or `undefined` for an argument left alone (a float order, a runaway order). */
export function expandExpIntegralE(ce: Engine, n: Expr, z: Expr): Expr | undefined {
  const q = bigRationalAt(n);
  const gamma = (): Expr =>
    ce.function("Multiply", [
      ce.function("Power", [z, ce.function("Subtract", [n, ce.One])]),
      ce.function("Gamma", [ce.function("Subtract", [ce.One, n]), z]),
    ]);
  if (q === undefined) return isNumber(n) ? undefined : gamma();
  if (q[1] > 2n) return gamma();

  const integer = q[1] === 1n;
  if (integer && q[0] === 1n) return undefined; // E₁ is the base
  const base: Rational = integer ? (q[0] >= 1n ? [1n, 1n] : [0n, 1n]) : [1n, 2n];
  const start = { P: new Map() as Laurent, c: [1n, 1n] as Rational };
  if (integer && q[0] < 1n) {
    start.P.set(-1, [1n, 1n]);
    start.c = [0n, 1n];
  }
  const steps = Number((q[0] * base[1] - base[0] * q[1]) / (q[1] * base[1]));
  if (Math.abs(steps) > MAX_STEPS) return undefined;
  const { P, c } = recur(base, start, steps);

  const terms: Expr[] = [];
  const expNegZ = ce.function("Exp", [ce.function("Negate", [z])]);
  const polynomial = [...P]
    .filter(([, [num]]) => num !== 0n)
    .toSorted(([a], [b]) => b - a)
    .map(([e, coefficient]) =>
      e === 0
        ? number(ce, coefficient)
        : ce.function("Multiply", [number(ce, coefficient), ce.function("Power", [z, ce.number(e)])]),
    );
  if (polynomial.length > 0) terms.push(ce.function("Multiply", [expNegZ, ce.function("Add", polynomial)]));
  if (c[0] !== 0n) {
    const power = ce.function("Power", [z, ce.function("Subtract", [n, ce.One])]);
    const tail = integer
      ? ce.function("ExpIntegralE", [ce.One, z])
      : ce.function("Multiply", [ce.function("Sqrt", [ce.Pi]), ce.function("Erfc", [ce.function("Sqrt", [z])])]);
    terms.push(ce.function("Multiply", [number(ce, c), power, tail]));
  }
  return ce.function("Add", terms);
}
