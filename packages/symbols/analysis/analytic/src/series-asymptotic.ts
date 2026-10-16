import { bigRationalAt, type Engine, type Expr, operandsOf, symbolNameOf } from "@enumeratio/engine";

// Asymptotic expansions at x → +∞ of Airy, Bessel, Ei, EllipticK and the ₁F₁ and ₂F₁ with symbolic
// parameters (DLMF §9.7, §10.17, §10.40, §6.12, §19.12, §13.7, §15.8), as `Series(f, x, ∞, n)` returns them.
//
// An expansion is a sum of components, each a factor (an exponential or a trig function of x)
// times a power series in 1/x with its own O-term. Wolfram cuts every component by the same rule:
// with `p` the exponent of the leading term of the whole function (x^(−1/4) for Airy, x^(−1/2)
// for Bessel and EllipticK, x^(−1) for Ei), a component keeps the terms whose exponent of 1/x is
// below p + n. A component that starts exactly at p + n keeps its first term (that is what order 0
// shows), and one that starts past it is dropped. The O-term is x^−(p + n), or one step past that
// first term. The symbolic ₁F₁ and ₂F₁ branches are cut by relative order instead: terms 0 … n.
//
// A ₂F₁ with positive integer parameters keeps the terms up to x^−n (absolute exponent), none starting past it.
// Anything else (another argument, another numeric ₁F₁/₂F₁, a negative order) is declined, not guessed.

type Rat = readonly [bigint, bigint];

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const rat = (n: bigint, d = 1n): Rat => {
  const g = gcd(n, d) || 1n;
  return d < 0n ? [-n / g, -d / g] : [n / g, d / g];
};
const plus = (a: Rat, b: Rat): Rat => rat(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const times = (a: Rat, b: Rat): Rat => rat(a[0] * b[0], a[1] * b[1]);
const compare = (a: Rat, b: Rat): number => {
  const d = a[0] * b[1] - b[0] * a[1];
  return d < 0n ? -1 : d > 0n ? 1 : 0;
};

/** Most terms of a single component this builds; a larger order is held. */
const MAX_ORDER = 200;

/** One piece of an expansion: `factor · Σ_k coefficient(k) · x^−(first + k·step)`. */
interface Component {
  factor?: Expr;
  first: Rat;
  step: Rat;
  /** The coefficient of term `k`; `undefined` for an exact zero. */
  coefficient: (k: number) => Expr | undefined;
}

/** An expansion's components, the exponent `p` of its leading term, and the step its O-term moves by. */
interface Expansion {
  components: Component[];
  lead: Rat;
  resolution: Rat;
  /** Terms added outside the series (they do not depend on the order). */
  extra?: Expr[];
  /** A component that starts at the bound is dropped, not shown by its first term. */
  strict?: boolean;
}

export function asymptoticSeries(ce: Engine, f: Expr, x: Expr, order: number): Expr | undefined {
  if (!Number.isInteger(order) || order < 0 || order > MAX_ORDER) return undefined;
  const expansion = expansionOf(ce, f, x);
  if (expansion === undefined) return undefined;

  const bound = plus(expansion.lead, rat(BigInt(order)));
  const xPower = (e: Rat): Expr => ce.function("Power", [x, rational(ce, [-e[0], e[1]])]);
  const pieces: Expr[] = [];
  for (const { factor, first, step, coefficient } of expansion.components) {
    const startsAtBound = compare(first, bound) === 0;
    if (compare(first, bound) > 0 || (expansion.strict && startsAtBound)) continue;
    const terms: Expr[] = [];
    for (let k = 0, e = first; k === 0 || compare(e, bound) < 0; k++, e = plus(e, step)) {
      const c = coefficient(k);
      if (c !== undefined) terms.push(ce.function("Multiply", [c, xPower(e)]));
    }
    if (terms.length === 0) continue;
    terms.push(ce.function("BigO", [xPower(startsAtBound ? plus(first, expansion.resolution) : bound)]));
    const sum = ce.function("Add", terms);
    pieces.push(factor === undefined ? sum : ce.function("Multiply", [factor, sum]));
  }
  if (pieces.length === 0) return undefined;
  return ce.function("Add", [...pieces, ...(expansion.extra ?? [])]);
}

const rational = (ce: Engine, [n, d]: Rat): Expr =>
  d === 1n ? ce.number(n) : ce.function("Rational", [ce.number(n), ce.number(d)]);

function expansionOf(ce: Engine, f: Expr, x: Expr): Expansion | undefined {
  const args = operandsOf(f);
  const ofX = (e: Expr | undefined): boolean => e !== undefined && e.isSame(x);
  switch (f.operator) {
    case "AiryAi":
    case "AiryBi":
      return args.length === 1 && ofX(args[0]) ? airy(ce, x, f.operator === "AiryAi") : undefined;
    case "BesselJ":
    case "BesselY":
    case "BesselI":
    case "BesselK": {
      const nu = args[0];
      if (args.length !== 2 || nu === undefined || !ofX(args[1]) || nu.has(symbolNameOf(x) ?? "")) return undefined;
      return bessel(ce, x, f.operator, nu);
    }
    case "ExpIntegralEi":
      return args.length === 1 && ofX(args[0]) ? expIntegralEi(ce, x) : undefined;
    case "EllipticK":
      return args.length === 1 && ofX(args[0]) ? ellipticK(ce, x) : undefined;
    case "Hypergeometric1F1":
    case "Hypergeometric2F1": {
      const parameters = args.slice(0, -1);
      if (args.length !== (f.operator === "Hypergeometric1F1" ? 3 : 4) || !ofX(args.at(-1))) return undefined;
      const integers = f.operator === "Hypergeometric2F1" ? positiveIntegers(parameters) : undefined;
      if (integers !== undefined) return hypergeometric2F1Integers(ce, x, integers as [number, number, number]);
      // Wolfram cuts a symbolic expansion by relative order; with other numeric parameters it cuts by absolute
      // exponent (and has the e^x branch leading), which is not reproduced here.
      if (!parameters.every((p) => symbolNameOf(p) !== undefined && p.isConstant !== true && !p.isSame(x)))
        return undefined;
      return f.operator === "Hypergeometric1F1"
        ? hypergeometric1F1(ce, x, parameters as [Expr, Expr])
        : hypergeometric2F1(ce, x, parameters as [Expr, Expr, Expr]);
    }
    default:
      return undefined;
  }
}

const pi = (ce: Engine): Expr => ce.Pi;
const sqrt = (ce: Engine, e: Expr): Expr => ce.function("Sqrt", [e]);
const exp = (ce: Engine, e: Expr): Expr => ce.function("Exp", [e]);
const mul = (ce: Engine, ...es: Expr[]): Expr => ce.function("Multiply", es);
const sign = (k: number): number => (k % 2 === 0 ? 1 : -1);
const half: Rat = rat(1n, 2n);
const invSqrtPi = (ce: Engine): Expr =>
  ce.function("Power", [ce.Pi, ce.function("Rational", [ce.number(-1), ce.number(2)])]);

/** Ai ~ e^−ζ/(2√π x^¼) Σ (−1)^k u_k/ζ^k and Bi ~ e^ζ/(√π x^¼) Σ u_k/ζ^k, ζ = (2/3)x^(3/2) (DLMF 9.7.5, 9.7.7). */
function airy(ce: Engine, x: Expr, isAi: boolean): Expansion {
  // u_k = (2k+1)(2k+3)…(6k−1) / (216^k k!), here times (3/2)^k from 1/ζ^k.
  const coefficients: Rat[] = [rat(1n)];
  const scaled = (k: number): Rat => {
    for (let j = coefficients.length; j <= k; j++) {
      let top = 1n;
      for (let m = 2n * BigInt(j) + 1n; m <= 6n * BigInt(j) - 1n; m += 2n) top *= m;
      let fact = 1n;
      for (let m = 2n; m <= BigInt(j); m++) fact *= m;
      coefficients.push(times(rat(top, 216n ** BigInt(j) * fact), rat(3n ** BigInt(j), 2n ** BigInt(j))));
    }
    return coefficients[k]!;
  };
  const zeta = mul(ce, rational(ce, rat(2n, 3n)), ce.function("Power", [x, rational(ce, rat(3n, 2n))]));
  const prefactor = isAi ? rat(1n, 2n) : rat(1n);
  return {
    lead: rat(1n, 4n),
    resolution: rat(1n, 4n),
    components: [
      {
        factor: exp(ce, isAi ? ce.function("Negate", [zeta]) : zeta),
        first: rat(1n, 4n),
        step: rat(3n, 2n),
        coefficient: (k) => {
          const [n, d] = times(scaled(k), prefactor);
          return mul(ce, rational(ce, rat(BigInt(isAi ? sign(k) : 1) * n, d)), invSqrtPi(ce));
        },
      },
    ],
  };
}

/** The Hankel coefficients a_k(ν) = Π_{j≤k} (4ν² − (2j−1)²) / (8^k k!) (DLMF 10.17.1), exact for a rational ν. */
function hankel(ce: Engine, nu: Expr): (k: number) => Expr | undefined {
  const cache = new Map<number, Expr | undefined>();
  const exact = bigRationalAt(nu);
  let running: Rat = rat(1n);
  const ratios: Rat[] = [rat(1n)];
  const at = (k: number): Expr | undefined => {
    if (cache.has(k)) return cache.get(k);
    let value: Expr | undefined;
    if (exact !== undefined) {
      for (let j = ratios.length; j <= k; j++) {
        const odd = BigInt(2 * j - 1);
        const four = rat(4n * exact[0] * exact[0] - odd * odd * exact[1] * exact[1], exact[1] * exact[1]);
        running = times(running, times(four, rat(1n, 8n * BigInt(j))));
        ratios.push(running);
      }
      const [n, d] = ratios[k]!;
      value = n === 0n ? undefined : rational(ce, [n, d]);
    } else if (k === 0) {
      value = ce.One;
    } else {
      const factors: Expr[] = [];
      let denominator = 1n;
      for (let j = 1; j <= k; j++) {
        const odd = BigInt(2 * j - 1);
        factors.push(
          ce.function("Subtract", [
            mul(ce, ce.number(4), ce.function("Power", [nu, ce.number(2)])),
            ce.number(odd * odd),
          ]),
        );
        denominator *= 8n * BigInt(j);
      }
      value = ce.function("Divide", [ce.function("Multiply", factors), ce.number(denominator)]);
    }
    cache.set(k, value);
    return value;
  };
  return at;
}

const phase = (ce: Engine, quarterTurns: number): Expr => {
  const m = ((quarterTurns % 4) + 4) % 4;
  return [ce.One, ce.I, ce.NegativeOne, ce.function("Negate", [ce.I])][m]!;
};

function bessel(ce: Engine, x: Expr, head: string, nu: Expr): Expansion {
  const a = hankel(ce, nu);
  const scale = (k: number, ...factors: Expr[]): Expr | undefined => {
    const c = a(k);
    return c === undefined ? undefined : mul(ce, ...factors, c);
  };
  const base = { lead: half, resolution: half, first: half };
  const theta = ce.function("Divide", [
    mul(ce, ce.function("Add", [ce.One, mul(ce, ce.number(2), nu)]), pi(ce)),
    ce.number(4),
  ]);
  const phaseOf = (sgn: 1 | -1): Expr =>
    exp(ce, mul(ce, sgn === 1 ? ce.I : ce.function("Negate", [ce.I]), ce.function("Subtract", [x, theta])));
  const twoOverPi = sqrt(ce, ce.function("Divide", [ce.number(2), pi(ce)]));
  const piOverTwo = sqrt(ce, ce.function("Divide", [pi(ce), ce.number(2)]));
  const invSqrtTwoPi = ce.function("Power", [
    mul(ce, ce.number(2), pi(ce)),
    ce.function("Rational", [ce.number(-1), ce.number(2)]),
  ]);

  switch (head) {
    case "BesselK":
      // K_ν(x) ~ √(π/2x) e^−x Σ a_k/x^k
      return {
        lead: half,
        resolution: half,
        components: [
          {
            factor: exp(ce, ce.function("Negate", [x])),
            first: half,
            step: rat(1n),
            coefficient: (k) => scale(k, piOverTwo),
          },
        ],
      };
    case "BesselI": {
      // I_ν(x) ~ e^x/√(2πx) Σ (−1)^k a_k/x^k + i e^(−x+iπν)/√(2πx) Σ a_k/x^k (DLMF 10.40.5, upper sign)
      const stokes = exp(ce, ce.function("Add", [ce.function("Negate", [x]), mul(ce, ce.I, pi(ce), nu)]));
      return {
        ...base,
        components: [
          {
            factor: exp(ce, x),
            first: half,
            step: rat(1n),
            coefficient: (k) => scale(k, ce.number(sign(k)), invSqrtTwoPi),
          },
          { factor: stokes, first: half, step: rat(1n), coefficient: (k) => scale(k, ce.I, invSqrtTwoPi) },
        ],
      };
    }
    case "BesselJ": {
      // J_ν(x) ~ √(2/πx) (cos(θ−x) Σ (−1)^k a_2k/x^2k + sin(θ−x) Σ (−1)^k a_(2k+1)/x^(2k+1)), θ = (2ν+1)π/4
      const argument = ce.function("Subtract", [theta, x]);
      return {
        ...base,
        components: [
          {
            factor: ce.function("Cos", [argument]),
            first: half,
            step: rat(2n),
            coefficient: (k) => scale(2 * k, ce.number(sign(k)), twoOverPi),
          },
          {
            factor: ce.function("Sin", [argument]),
            first: rat(3n, 2n),
            step: rat(2n),
            coefficient: (k) => scale(2 * k + 1, ce.number(sign(k)), twoOverPi),
          },
        ],
      };
    }
    default:
      // Y_ν(x) ~ √(2/πx) (e^(iω) Σ i^(j−1) a_j/(2x^j) + e^(−iω) Σ i^(3j+1) a_j/(2x^j)), ω = x − θ
      return {
        ...base,
        components: [
          {
            factor: phaseOf(1),
            first: half,
            step: rat(1n),
            coefficient: (k) => scale(k, phase(ce, k + 3), rational(ce, half), twoOverPi),
          },
          {
            factor: phaseOf(-1),
            first: half,
            step: rat(1n),
            coefficient: (k) => scale(k, phase(ce, 3 * k + 1), rational(ce, half), twoOverPi),
          },
        ],
      };
  }
}

/** Ei(x) ~ e^x Σ k!/x^(k+1), plus Wolfram's logarithm term, which is 0 for real x (DLMF 6.12.1). */
function expIntegralEi(ce: Engine, x: Expr): Expansion {
  const log = (e: Expr): Expr => ce.function("Ln", [e]);
  const negate = (e: Expr): Expr => ce.function("Negate", [e]);
  return {
    lead: rat(1n),
    resolution: rat(1n),
    components: [
      {
        factor: exp(ce, x),
        first: rat(1n),
        step: rat(1n),
        coefficient: (k) => ce.number(Array.from({ length: k }, (_, i) => BigInt(i + 1)).reduce((a, b) => a * b, 1n)),
      },
    ],
    extra: [
      ce.function("Divide", [
        ce.function("Add", [
          log(negate(ce.function("Divide", [ce.One, x]))),
          negate(log(negate(x))),
          mul(ce, ce.number(2), log(x)),
        ]),
        ce.number(2),
      ]),
    ],
  };
}

/**
 * K(m) = (K(1/m) − i K(1 − 1/m)) / √m for m > 1, on the side Im K < 0 (the continuation from below the
 * cut, as Wolfram and mpmath take it), with K(1−u) = Σ c_k u^k (½ ln(16/u) − Σ_(j≤k) 1/(j(2j−1)))
 * and c_k = ((½)_k/k!)² (DLMF 19.12.1).
 */
function ellipticK(ce: Engine, x: Expr): Expansion {
  const squares: Rat[] = [rat(1n)];
  const harmonic: Rat[] = [rat(0n)];
  const at = (k: number): void => {
    for (let j = squares.length; j <= k; j++) {
      const ratio = rat(BigInt(2 * j - 1), BigInt(2 * j));
      squares.push(times(squares[j - 1]!, times(ratio, ratio)));
      harmonic.push(plus(harmonic[j - 1]!, rat(1n, BigInt(j) * BigInt(2 * j - 1))));
    }
  };
  return {
    lead: half,
    resolution: half,
    components: [
      {
        first: half,
        step: rat(1n),
        coefficient: (k) => {
          at(k);
          const logs = ce.function("Add", [
            pi(ce),
            mul(ce, ce.number(-2), ce.I, ce.function("Ln", [ce.number(4)])),
            mul(ce, ce.number(-1), ce.I, ce.function("Ln", [x])),
            mul(ce, ce.number(2), ce.I, rational(ce, harmonic[k]!)),
          ]);
          return mul(ce, rational(ce, times(squares[k]!, half)), logs);
        },
      },
    ],
  };
}

const add = (ce: Engine, ...es: Expr[]): Expr => ce.function("Add", es);
const negate = (ce: Engine, e: Expr): Expr => ce.function("Negate", [e]);
const power = (ce: Engine, base: Expr, exponent: Expr): Expr => ce.function("Power", [base, exponent]);
const gamma = (ce: Engine, e: Expr): Expr => ce.function("Gamma", [e]);
const divide = (ce: Engine, a: Expr, b: Expr): Expr => ce.function("Divide", [a, b]);

/** The rising factorial (p)_s. */
const pochhammer = (ce: Engine, p: Expr, s: number): Expr =>
  s === 0 ? ce.One : mul(ce, ...Array.from({ length: s }, (_, j) => add(ce, p, ce.number(j))));
const factorial = (s: number): bigint => Array.from({ length: s }, (_, i) => BigInt(i + 1)).reduce((a, b) => a * b, 1n);

/**
 * ₁F₁(a; b; x) ~ Γ(b)/Γ(a) e^x x^(a−b) Σ (b−a)_s (1−a)_s/(s! x^s) + Γ(b)/Γ(b−a) (−x)^(−a) Σ (a)_s (a−b+1)_s/(s! (−x)^s),
 * s ≤ n for symbolic parameters (DLMF 13.7.2).
 */
function hypergeometric1F1(ce: Engine, x: Expr, [a, b]: [Expr, Expr]): Expansion {
  const growing = mul(ce, exp(ce, x), power(ce, x, add(ce, a, negate(ce, b))));
  const algebraic = power(ce, negate(ce, x), negate(ce, a));
  const bMinusA = add(ce, b, negate(ce, a));
  const oneMinusA = add(ce, ce.One, negate(ce, a));
  const aMinusBPlus1 = add(ce, a, negate(ce, b), ce.One);
  return {
    lead: rat(1n),
    resolution: rat(1n),
    components: [
      {
        factor: growing,
        first: rat(0n),
        step: rat(1n),
        coefficient: (k) =>
          divide(
            ce,
            mul(ce, gamma(ce, b), pochhammer(ce, bMinusA, k), pochhammer(ce, oneMinusA, k)),
            mul(ce, gamma(ce, a), ce.number(factorial(k))),
          ),
      },
      {
        factor: algebraic,
        first: rat(0n),
        step: rat(1n),
        coefficient: (k) =>
          divide(
            ce,
            mul(ce, ce.number(sign(k)), gamma(ce, b), pochhammer(ce, a, k), pochhammer(ce, aMinusBPlus1, k)),
            mul(ce, gamma(ce, bMinusA), ce.number(factorial(k))),
          ),
      },
    ],
  };
}

/**
 * ₂F₁(a, b; c; x) ~ Γ(c)Γ(b−a)/(Γ(b)Γ(c−a)) (−x)^(−a) Σ (a)_s (a−c+1)_s/(s! (a−b+1)_s x^s) + the same with a, b swapped,
 * s ≤ n for symbolic parameters (DLMF 15.8.2).
 */
function hypergeometric2F1(ce: Engine, x: Expr, [a, b, c]: [Expr, Expr, Expr]): Expansion {
  const branch = (p: Expr, q: Expr): Component => {
    const qMinusP = add(ce, q, negate(ce, p));
    const pMinusC1 = add(ce, p, negate(ce, c), ce.One);
    const pMinusQ1 = add(ce, p, negate(ce, q), ce.One);
    return {
      factor: power(ce, negate(ce, x), negate(ce, p)),
      first: rat(0n),
      step: rat(1n),
      coefficient: (k) =>
        divide(
          ce,
          mul(ce, gamma(ce, c), gamma(ce, qMinusP), pochhammer(ce, p, k), pochhammer(ce, pMinusC1, k)),
          mul(
            ce,
            gamma(ce, q),
            gamma(ce, add(ce, c, negate(ce, p))),
            ce.number(factorial(k)),
            pochhammer(ce, pMinusQ1, k),
          ),
        ),
    };
  };
  return { lead: rat(1n), resolution: rat(1n), components: [branch(a, b), branch(b, a)] };
}

/** The values of `parameters` when all are positive integers (small enough to take factorials of), else `undefined`. */
const positiveIntegers = (parameters: Expr[]): number[] | undefined => {
  const values = parameters.map((p) => (p.im === 0 && Number.isInteger(p.re) && p.re > 0 && p.re <= 100 ? p.re : NaN));
  return values.some(Number.isNaN) ? undefined : values;
};

/**
 * ₂F₁(a, a+m; c; x) for positive integers (DLMF 15.8.8), where Γ is a factorial and ψ a harmonic number:
 * m power terms, then a series with ln(−x). For c−a−m−k ≤ 0 the factor ψ(c−a−m−k)/Γ(c−a−m−k) is taken as its
 * limit, (−1)^(N+1) N! at −N, and the logarithm drops out. Terms are cut at x^−n (absolute exponent).
 */
function hypergeometric2F1Integers(ce: Engine, x: Expr, [p, q, c]: [number, number, number]): Expansion {
  const [a, b] = p <= q ? [p, q] : [q, p];
  const m = b - a;
  const pochhammerInt = (start: number, k: number): bigint =>
    Array.from({ length: k }, (_, j) => BigInt(start + j)).reduce((u, v) => u * v, 1n);
  const harmonic = (j: number): Rat =>
    Array.from({ length: j }, (_, i) => rat(1n, BigInt(i + 1))).reduce(plus, rat(0n));
  const parity = (k: number): bigint => (k % 2 === 0 ? 1n : -1n);
  const [fact, scale] = [(n: number) => factorial(n), parity(a) * factorial(c - 1)];
  const logarithm = ce.function("Ln", [negate(ce, x)]);
  return {
    lead: rat(1n),
    resolution: rat(1n),
    strict: true,
    components: [
      {
        // Σ_(k<m) (a)_k (m−k−1)!/(k! Γ(c−a−k)) / Γ(a+m), a pole of Γ(c−a−k) zeroing the term
        first: rat(BigInt(a)),
        step: rat(1n),
        coefficient: (k) => {
          const rest = c - a - k;
          if (k >= m || rest < 1) return undefined;
          return rational(
            ce,
            rat(scale * pochhammerInt(a, k) * fact(m - k - 1), fact(a + m - 1) * fact(k) * fact(rest - 1)),
          );
        },
      },
      {
        first: rat(BigInt(a + m)),
        step: rat(1n),
        coefficient: (k) => {
          const rest = c - a - m - k;
          const weight = rat(parity(k) * scale * pochhammerInt(a + m, k), fact(a - 1) * fact(k) * fact(k + m));
          if (rest < 1) return rational(ce, times(weight, rat(parity(-rest) * fact(-rest))));
          const scaled = times(weight, rat(1n, fact(rest - 1)));
          const shift = plus(
            plus(harmonic(m + k), harmonic(k)),
            times(rat(-1n), plus(harmonic(a + m + k - 1), harmonic(rest - 1))),
          );
          return add(ce, mul(ce, rational(ce, scaled), logarithm), rational(ce, times(scaled, shift)));
        },
      },
    ],
  };
}
