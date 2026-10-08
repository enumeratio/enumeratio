import type { Json } from "@enumeratio/ce-patches";

// Partial derivatives of the Jacobi functions in u and in the parameter m, of any order.
//
// Every head is a polynomial in the nine quantities below, and each of them differentiates to a
// polynomial in the same nine (DLMF 22.13), so ∂ᵃ∂ᵇ of a head stays a polynomial (with m and 1−m
// allowed negative exponents) and its body is small. ε is the Jacobi epsilon E(am(u, m), m),
// written as JacobiZN(u, m) + u·E(m)/K(m).
//
//   ∂ᵤ:  sn′ = cn·dn,  cn′ = −sn·dn,  dn′ = −m·sn·cn,  ε′ = dn²                 (22.13.4–6)
//   ∂ₘ:  with P = ∂ₘam(u, m) = [m·sn·cn + dn·((1−m)u − ε)] / (2m(1−m)),
//        sn_m = cn·P,  cn_m = −sn·P,
//        dn_m = [sn·cn·(ε − (1−m)u) − sn²·dn] / (2(1−m)),
//        ε_m = [sn·cn·dn − cn²·ε] / (2(1−m)) − u·sn²/2,
//        K_m = (E − (1−m)K) / (2m(1−m)),  E_m = (E − K) / (2m)                     (22.13.1–3, 19.4)
// DLMF states the k-derivatives; these are the same identities divided by 2k.

const VARIABLES = ["s", "c", "d", "eps", "u", "K", "E", "m", "w"] as const;
type Variable = (typeof VARIABLES)[number];
const SIZE = VARIABLES.length;
const at = (v: Variable): number => VARIABLES.indexOf(v);

interface Term {
  readonly exps: readonly number[];
  readonly num: number;
  readonly den: number;
}
type Poly = Map<string, Term>;

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

const mono = (powers: Partial<Record<Variable, number>>): number[] => {
  const exps = new Array<number>(SIZE).fill(0);
  for (const [v, e] of Object.entries(powers)) exps[at(v as Variable)] = e;
  return exps;
};

function addTerm(poly: Poly, exps: readonly number[], num: number, den: number): void {
  if (num === 0) return;
  const key = exps.join(",");
  const hit = poly.get(key);
  if (hit === undefined) {
    const g = gcd(num, den);
    poly.set(key, { exps, num: num / g, den: den / g });
    return;
  }
  const n = hit.num * den + num * hit.den;
  const d = hit.den * den;
  if (n === 0) poly.delete(key);
  else {
    const g = gcd(n, d);
    poly.set(key, { exps, num: n / g, den: d / g });
  }
}

/** [coefficient numerator, denominator, monomial] triples. */
type Rule = readonly (readonly [number, number, Partial<Record<Variable, number>>])[];

const P: Rule = [
  [1, 2, { s: 1, c: 1, w: -1 }],
  [1, 2, { d: 1, u: 1, m: -1 }],
  [-1, 2, { d: 1, eps: 1, m: -1, w: -1 }],
];

const DU: Partial<Record<Variable, Rule>> = {
  s: [[1, 1, { c: 1, d: 1 }]],
  c: [[-1, 1, { s: 1, d: 1 }]],
  d: [[-1, 1, { m: 1, s: 1, c: 1 }]],
  eps: [[1, 1, { d: 2 }]],
  u: [[1, 1, {}]],
};

const DM: Partial<Record<Variable, Rule>> = {
  s: P.map(([n, d, p]) => [n, d, { ...p, c: (p.c ?? 0) + 1 }] as const),
  c: P.map(([n, d, p]) => [-n, d, { ...p, s: (p.s ?? 0) + 1 }] as const),
  d: [
    [1, 2, { s: 1, c: 1, eps: 1, w: -1 }],
    [-1, 2, { s: 1, c: 1, u: 1 }],
    [-1, 2, { s: 2, d: 1, w: -1 }],
  ],
  eps: [
    [1, 2, { s: 1, c: 1, d: 1, w: -1 }],
    [-1, 2, { c: 2, eps: 1, w: -1 }],
    [-1, 2, { u: 1, s: 2 }],
  ],
  K: [
    [1, 2, { E: 1, m: -1, w: -1 }],
    [-1, 2, { K: 1, m: -1 }],
  ],
  E: [
    [1, 2, { E: 1, m: -1 }],
    [-1, 2, { K: 1, m: -1 }],
  ],
  m: [[1, 1, {}]],
  w: [[-1, 1, {}]],
};

function derive(poly: Poly, rules: Partial<Record<Variable, Rule>>): Poly {
  const out: Poly = new Map();
  for (const { exps, num, den } of poly.values()) {
    exps.forEach((e, i) => {
      const rule = e === 0 ? undefined : rules[VARIABLES[i]!];
      if (rule === undefined) return;
      for (const [n, d, powers] of rule) {
        const next = exps.map((x, j) => x + (j === i ? -1 : 0) + (mono(powers)[j] ?? 0));
        addTerm(out, next, num * n * e, den * d);
      }
    });
  }
  return out;
}

const polyOf = (...terms: Rule): Poly => {
  const poly: Poly = new Map();
  for (const [n, d, powers] of terms) addTerm(poly, mono(powers), n, d);
  return poly;
};

/** The head as a polynomial, or (for the amplitude) its first derivative in u and m. */
const MONOMIALS: Readonly<Record<string, Partial<Record<Variable, number>>>> = {
  JacobiSN: { s: 1 },
  JacobiCN: { c: 1 },
  JacobiDN: { d: 1 },
  JacobiNS: { s: -1 },
  JacobiNC: { c: -1 },
  JacobiND: { d: -1 },
  JacobiSC: { s: 1, c: -1 },
  JacobiSD: { s: 1, d: -1 },
  JacobiCS: { c: 1, s: -1 },
  JacobiCD: { c: 1, d: -1 },
  JacobiDS: { d: 1, s: -1 },
  JacobiDC: { d: 1, c: -1 },
};

/** Largest ∂ₘ order built: the body grows with each, and no series asks for more. */
const MAX_M_ORDER = 5;

/** The head's `(a, b)` partial (∂ᵃ in u, ∂ᵇ in m) as a polynomial, undefined past what this builds. */
function partialPoly(head: string, a: number, b: number): Poly | undefined {
  if (b > MAX_M_ORDER) return undefined;
  const apply = (poly: Poly, du: number, dm: number): Poly => {
    for (let i = 0; i < dm; i++) poly = derive(poly, DM);
    for (let i = 0; i < du; i++) poly = derive(poly, DU);
    return poly;
  };
  if (head === "JacobiAmplitude") {
    // am′ = dn in u, and ∂ₘam = P.
    return b === 0 ? apply(polyOf([1, 1, { d: 1 }]), a - 1, 0) : apply(polyOf(...P), a, b - 1);
  }
  const start =
    head === "JacobiZN"
      ? polyOf([1, 1, { eps: 1 }], [-1, 1, { u: 1, E: 1, K: -1 }])
      : MONOMIALS[head] === undefined
        ? undefined
        : polyOf([1, 1, MONOMIALS[head]]);
  return start === undefined ? undefined : apply(start, a, b);
}

const FUNCTION_OF: Readonly<Record<Variable, Json>> = {
  s: ["JacobiSN", "u", "m"],
  c: ["JacobiCN", "u", "m"],
  d: ["JacobiDN", "u", "m"],
  // ε = Z(u, m) + u·E(m)/K(m) (DLMF 22.16.31): unlike E(am(u, m), m) it continues to every m.
  eps: ["Add", ["JacobiZN", "u", "m"], ["Divide", ["Multiply", "u", ["EllipticE", "m"]], ["EllipticK", "m"]]],
  u: "u",
  K: ["EllipticK", "m"],
  E: ["EllipticE", "m"],
  m: "m",
  w: ["Subtract", 1, "m"],
};

const power = (v: Variable, e: number): Json => (e === 1 ? FUNCTION_OF[v] : ["Power", FUNCTION_OF[v], e]);

function toJson(poly: Poly): Json {
  const terms: Json[] = [];
  for (const { exps, num, den } of poly.values()) {
    const top: Json[] = [];
    const bottom: Json[] = [];
    if (Math.abs(num) !== 1) top.push(Math.abs(num));
    if (den !== 1) bottom.push(den);
    exps.forEach((e, i) => {
      if (e > 0) top.push(power(VARIABLES[i]!, e));
      else if (e < 0) bottom.push(power(VARIABLES[i]!, -e));
    });
    const product = (factors: Json[]): Json =>
      factors.length === 0 ? 1 : factors.length === 1 ? factors[0]! : ["Multiply", ...factors];
    const ratio = bottom.length === 0 ? product(top) : ["Divide", product(top), product(bottom)];
    terms.push(num < 0 ? ["Negate", ratio] : ratio);
  }
  return terms.length === 0 ? 0 : terms.length === 1 ? terms[0]! : ["Add", ...terms];
}

/**
 * ∂ᵃ_u ∂ᵇ_m of a Jacobi head (the twelve `pq`, `JacobiAmplitude`, `JacobiZN`) as the body of a
 * function of `(u, m)`, or undefined for any other head or an order past the cap.
 */
export function jacobiPartialBody(head: string, orders: readonly number[]): Json | undefined {
  const [a, b] = orders;
  if (orders.length !== 2 || a === undefined || b === undefined) return undefined;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a + b < 1) return undefined;
  const poly = partialPoly(head, a, b);
  return poly === undefined ? undefined : toJson(poly);
}
