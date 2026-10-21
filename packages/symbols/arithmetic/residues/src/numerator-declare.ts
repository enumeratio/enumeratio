import {
  bigIntegerAt,
  bigRationalAt,
  extendHead,
  operandsOf,
  optionsOf,
  symbolNameOf,
  widenSignature,
  wrapOperator,
  type Engine,
  type Expr,
  type Json,
} from "@enumeratio/engine";
import { gcd as integerGcd, mod } from "./arith.ts";
import {
  addFractions,
  constant,
  exponentsOf,
  type Fraction,
  integersModulo,
  isZero,
  leading,
  monomialKey,
  multiplyFractions,
  type Poly,
  type Rational,
  rationals,
} from "./modular-fractions.ts";
import { isPrime } from "./primes.ts";

// `Numerator(expr, Over -> QuotientRing(Integers, p))`, Wolfram's `Numerator[expr, Modulus -> p]`
// (and `Denominator`): the expression is a rational function in its unknowns, put over a common
// denominator in lowest terms over ℚ with integer coefficients, then read over the field ℤ/p and
// reduced again. A denominator that is then a monomial is a unit times powers of the unknowns,
// so its numeric part moves into the numerator (x/(2y) is 4x/y mod 7). Declines (the call stays
// as written) where Wolfram has no answer or this has no reading: a modulus that is not prime, a
// denominator that vanishes mod p.

/** Raised where the expression is outside what is read; the call stays as it was. */
class Decline extends Error {}

const MAX_POWER = 64;
/** Heads that carry no quotient (a Tuple, a relation, a truth value): Wolfram hands these back as they are. */
const NOT_ARITHMETIC: ReadonlySet<string> = new Set([
  "Tuple",
  "KeyValuePair",
  "Set",
  "Equal",
  "NotEqual",
  "Less",
  "LessEqual",
  "Greater",
  "GreaterEqual",
  "And",
  "Or",
  "Not",
  "Xor",
  "Implies",
  "Interval",
  "Range",
]);

/** The unknowns an expression is a rational function in, keyed by their MathJSON. */
function collectAtoms(e: Expr, atoms: Map<string, Expr>): void {
  if (bigRationalAt(e) !== undefined) return;
  switch (e.operator) {
    case "Add":
    case "Multiply":
    case "Negate":
    case "Subtract":
    case "Divide":
      for (const op of operandsOf(e)) collectAtoms(op, atoms);
      return;
    case "Power": {
      const [base, exponent] = operandsOf(e);
      const k = bigIntegerAt(exponent);
      if (k === undefined) break;
      if (k > BigInt(MAX_POWER) || k < -BigInt(MAX_POWER)) throw new Decline();
      collectAtoms(base!, atoms);
      return;
    }
  }
  if (NOT_ARITHMETIC.has(e.operator)) throw new Decline();
  // A symbol that is not a constant, or an application (x^y, sin x): an unknown. Any other
  // number (a float, Pi) has no place in a quotient over ℤ/p.
  if (e.operator === undefined && (symbolNameOf(e) === undefined || e.isConstant === true)) throw new Decline();
  atoms.set(JSON.stringify(e.json), e);
}

/**
 * `e` as a quotient of polynomials over ℚ, in lowest terms; `reading.polynomialDenominator` is set
 * when some part of it is divided by a polynomial of more than one term.
 */
function readFraction(
  e: Expr,
  index: ReadonlyMap<string, number>,
  n: number,
  reading: { polynomialDenominator: boolean },
): Fraction<Rational> {
  const F = rationals;
  const whole = (c: Rational): Fraction<Rational> => ({
    numerator: constant(F, c, n),
    denominator: constant(F, F.one, n),
  });
  const one = whole(F.one);
  const times = (a: Fraction<Rational>, b: Fraction<Rational>) => multiplyFractions(F, a, b, n);
  const negate = (a: Fraction<Rational>) => times(a, whole([-1n, 1n]));
  const invert = (a: Fraction<Rational>): Fraction<Rational> => {
    if (isZero(a.numerator)) throw new Decline();
    if (a.numerator.size > 1) reading.polynomialDenominator = true;
    return { numerator: a.denominator, denominator: a.numerator };
  };
  const power = (a: Fraction<Rational>, k: bigint): Fraction<Rational> => {
    let out = one;
    for (let i = 0n; i < (k < 0n ? -k : k); i++) out = times(out, a);
    return k < 0n ? invert(out) : out;
  };

  const read = (x: Expr): Fraction<Rational> => {
    const value = bigRationalAt(x);
    if (value !== undefined) return whole(value);
    const ops = operandsOf(x);
    switch (x.operator) {
      case "Add":
        return ops.map(read).reduce((a, b) => addFractions(F, a, b, n));
      case "Multiply":
        return ops.map(read).reduce(times);
      case "Negate":
        return negate(read(ops[0]!));
      case "Subtract":
        return addFractions(F, read(ops[0]!), negate(read(ops[1]!)), n);
      case "Divide":
        return times(read(ops[0]!), invert(read(ops[1]!)));
      case "Power": {
        const k = bigIntegerAt(ops[1]);
        if (k !== undefined) return power(read(ops[0]!), k);
      }
    }
    const exponents = Array.from({ length: n }, () => 0);
    exponents[index.get(JSON.stringify(x.json))!] = 1;
    return { numerator: new Map([[monomialKey(exponents), F.one]]), denominator: constant(F, F.one, n) };
  };
  return read(e);
}

const lcm = (a: bigint, b: bigint): bigint => (a / integerGcd(a, b)) * b;

/**
 * The fraction as Together writes it over ℚ: integer coefficients, the contents of numerator and
 * denominator coprime, the denominator's leading coefficient (lexicographically, the unknowns in
 * name order) positive unless `keepSign`. That is Wolfram's sign for a single unknown; with several
 * it can differ by a unit.
 */
function integerForm(fraction: Fraction<Rational>, keepSign: boolean): Fraction<bigint> {
  const factorOf = (a: Poly<Rational>): bigint => [...a.values()].reduce((f, [, d]) => lcm(f, d), 1n);
  const [top, bottom] = [fraction.numerator, fraction.denominator];
  // Both sides cleared at once: N/D = (N * L) / (D * L) for the common multiple L of every denominator.
  const L = lcm(factorOf(top), factorOf(bottom));
  const integers = (a: Poly<Rational>): Poly<bigint> => new Map([...a].map(([m, [n, d]]) => [m, n * (L / d)]));
  const [N, D] = [integers(top), integers(bottom)];
  const content = [...N.values(), ...D.values()].reduce((g, c) => integerGcd(g, c < 0n ? -c : c), 0n);
  const sign = !keepSign && leading(D)[1] < 0n ? -1n : 1n;
  const divide = (a: Poly<bigint>): Poly<bigint> => new Map([...a].map(([m, c]) => [m, (sign * c) / content]));
  return { numerator: divide(N), denominator: divide(D) };
}

const reduceModulo = (a: Poly<bigint>, p: bigint): Poly<bigint> => {
  const out: Poly<bigint> = new Map();
  for (const [m, c] of a) if (mod(c, p) !== 0n) out.set(m, mod(c, p));
  return out;
};

/**
 * Together's `numerator/denominator` read over ℤ/p. Wolfram reduces the two parts' coefficients
 * and leaves it there, except that a constant denominator is multiplied in, and so is a monomial
 * one when no polynomial of several terms divides anywhere in the expression (`laurent`):
 * x/(2y) is 4x/y mod 7, and a numerator of several terms keeps the negative powers inline with
 * denominator 1.
 */
function build(
  ce: Engine,
  { numerator, denominator }: Fraction<bigint>,
  atoms: readonly Expr[],
  p: bigint,
  laurent: boolean,
): { numerator: Expr; denominator: Expr } {
  const term = (coefficient: bigint, exponents: readonly number[]): Expr => {
    const factors: Expr[] = [];
    if (coefficient !== 1n || exponents.every((e) => e === 0)) factors.push(ce.number(coefficient));
    exponents.forEach((e, i) => {
      if (e !== 0) factors.push(e === 1 ? atoms[i]! : ce.function("Power", [atoms[i]!, ce.number(e)]));
    });
    return factors.length === 1 ? factors[0]! : ce.function("Multiply", factors);
  };
  const sum = (terms: readonly Expr[]): Expr => (terms.length === 1 ? terms[0]! : ce.function("Add", terms));
  const one = ce.number(1);
  const zero = { numerator: ce.number(0), denominator: one };
  const F = integersModulo(p);

  const top = reduceModulo(numerator, p);
  if (isZero(top)) return zero;
  const bottom = reduceModulo(denominator, p);
  if (isZero(bottom)) throw new Decline();

  // Wolfram cancels a factor that only appears mod p in these cases and no others: a quotient of two
  // monomials ((x^2 + 5)/(x^2 + 5x) is 1 mod 5), or of parts that reduce to the same polynomial.
  // x(x + 1)/(x(x + 3)) mod 5 stays as it is.
  const sameParts = top.size === bottom.size && [...top].every(([m, c]) => bottom.get(m) === c);
  if (sameParts) return { numerator: one, denominator: one };
  const monomial = laurent && denominator.size === 1;
  const constantDenominator = bottom.size === 1 && exponentsOf([...bottom.keys()][0]!).every((e) => e === 0);
  const monomials = top.size === 1 && bottom.size === 1;
  if (!monomial && !constantDenominator && !monomials) {
    const read = (poly: Poly<bigint>) => sum([...poly].map(([m, c]) => term(c, exponentsOf(m))));
    return { numerator: read(top), denominator: read(bottom) };
  }
  const [[mD, cD]] = [...bottom] as [[string, bigint]];
  const eD = exponentsOf(mD);
  const unit = F.inverse(cD);
  const terms = [...top].map(([m, c]) => ({
    coefficient: mod(c * unit, p),
    exponents: exponentsOf(m).map((e, i) => e - eD[i]!),
  }));
  // One term splits into numerator and denominator; a sum keeps its negative powers inline.
  if (terms.length === 1) {
    const { coefficient, exponents } = terms[0]!;
    const down = exponents.map((e) => (e < 0 ? -e : 0));
    return {
      numerator: term(
        coefficient,
        exponents.map((e) => (e > 0 ? e : 0)),
      ),
      denominator: down.every((e) => e === 0) ? one : term(1n, down),
    };
  }
  return { numerator: sum(terms.map(({ coefficient, exponents }) => term(coefficient, exponents))), denominator: one };
}

/** `1/(a + b + …)` or `(a + b + …)^-1`: Together leaves such a reciprocal as written. */
const isReciprocalOfSum = (e: Expr): boolean => {
  const [a, b] = operandsOf(e);
  if (e.operator === "Divide") return a?.is(1) === true && b?.operator === "Add";
  return e.operator === "Power" && bigIntegerAt(b) === -1n && a?.operator === "Add";
};

/** The numerator and denominator of `expr` over ℤ/p, as expressions. */
function overField(ce: Engine, expr: Expr, p: bigint): { numerator: Expr; denominator: Expr } {
  const atoms = new Map<string, Expr>();
  collectAtoms(expr, atoms);
  const names = [...atoms.keys()].toSorted();
  const index = new Map(names.map((name, i) => [name, i]));
  const n = Math.max(names.length, 1);
  const reading = { polynomialDenominator: false };
  const together = integerForm(readFraction(expr, index, n, reading), isReciprocalOfSum(expr));
  return build(
    ce,
    together,
    names.map((name) => atoms.get(name)!),
    p,
    !reading.polynomialDenominator,
  );
}

/** The ring `Over` names, as the prime `p` of `QuotientRing(Integers, p)`, or the ordinary
 * rational answer (`"ordinary"`), or `undefined` for any other ring. */
function ringOf(over: Json | undefined): bigint | "ordinary" | undefined {
  if (over === undefined || over === "Integers" || over === "Rationals") return "ordinary";
  if (!Array.isArray(over) || over[0] !== "QuotientRing" || over[1] !== "Integers") return undefined;
  const p = typeof over[2] === "number" && Number.isSafeInteger(over[2]) ? BigInt(over[2]) : undefined;
  return p !== undefined && isPrime(p) ? p : undefined;
}

export function declareNumerator(ce: Engine): void {
  for (const head of ["Numerator", "Denominator"] as const) {
    // The option rides as a trailing rule, a Tuple the head would otherwise thread over (hence the
    // `tuples` exemption, kept beside the native `surplus-operands`). Canonicalization already keeps it.
    widenSignature(ce, head, "(number, any*) -> number");
    extendHead(ce, head, { broadcastExemptions: ["surplus-operands", "tuples"] });
    wrapOperator(
      ce,
      [head],
      () => true,
      () => (ops) => {
        const split = optionsOf([head, ...ops.map((op) => op.json)] as never);
        if (split.ops.length !== 1 || Object.keys(split.options).some((name) => name !== "Over")) return undefined;
        const ring = ringOf(split.options.Over);
        if (ring === undefined) return undefined;
        // Listable, as Wolfram's is: the ring applies to each element.
        if (ops[0]!.operator === "List") {
          const items = operandsOf(ops[0]).map((item) => ce.function(head, [item, ...ops.slice(1)]).evaluate());
          return ce.function("List", items);
        }
        if (ring === "ordinary") return ce.function(head, [ops[0]!]).evaluate();
        try {
          const parts = overField(ce, ops[0]!, ring);
          return head === "Numerator" ? parts.numerator : parts.denominator;
        } catch (error) {
          if (error instanceof Decline) return undefined;
          throw error;
        }
      },
      { arity: { min: 2 } },
    );
  }
}
