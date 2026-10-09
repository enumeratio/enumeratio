import type { Json } from "@enumeratio/ce-patches";
import { jacobiPartialBody } from "./jacobi-derivatives.ts";

// Derivatives of every order for heads whose first derivative closes on a small set of
// functions: compute-engine's `Series` asks `Derivative(f, n)` at the expansion point, so a
// head with only a first-order rule leaves every higher coefficient symbolic. Each family below
// differentiates an exact polynomial in its basis functions, so the order-n body stays small
// (no expression swell from repeated `D`).

/** One `Derivative` partial: parameter names in argument order, and the body over them. */
export interface OrderPartial {
  readonly params: readonly string[];
  readonly body: Json;
}

/** A polynomial in `m` and integer powers of the basis functions, keyed by exponent vector. */
type Poly = Map<string, { exps: number[]; mDeg: number; coef: number }>;

const keyOf = (exps: readonly number[], mDeg: number) => `${exps.join(",")};${mDeg}`;

function addTerm(poly: Poly, exps: number[], mDeg: number, coef: number): void {
  if (coef === 0) return;
  const key = keyOf(exps, mDeg);
  const hit = poly.get(key);
  if (hit === undefined) poly.set(key, { exps, mDeg, coef });
  else if ((hit.coef += coef) === 0) poly.delete(key);
}

/** Order-`n` derivative of `start` under `step`, which adds one derivative's worth of terms. */
function iterate(
  start: Poly,
  n: number,
  step: (term: { exps: number[]; mDeg: number; coef: number }, out: Poly) => void,
): Poly {
  let poly = start;
  for (let i = 0; i < n; i++) {
    const next: Poly = new Map();
    for (const term of poly.values()) step(term, next);
    poly = next;
  }
  return poly;
}

function toJson(poly: Poly, basis: readonly Json[], mName: string | undefined): Json {
  const terms: Json[] = [];
  for (const { exps, mDeg, coef } of poly.values()) {
    const factors: Json[] = [];
    if (coef !== 1) factors.push(coef);
    if (mDeg !== 0 && mName !== undefined) factors.push(mDeg === 1 ? mName : ["Power", mName, mDeg]);
    exps.forEach((e, i) => {
      if (e !== 0) factors.push(e === 1 ? basis[i]! : ["Power", basis[i]!, e]);
    });
    terms.push(factors.length === 0 ? 1 : factors.length === 1 ? factors[0]! : ["Multiply", ...factors]);
  }
  return terms.length === 0 ? 0 : terms.length === 1 ? terms[0]! : ["Add", ...terms];
}

// --- Jacobi: ∂ᵃ_u∂ᵇ_m of the twelve pq heads, JacobiAmplitude and JacobiZN (jacobi-derivatives.ts) ---

const JACOBI_HEADS = [
  "JacobiSN",
  "JacobiCN",
  "JacobiDN",
  "JacobiNS",
  "JacobiNC",
  "JacobiND",
  "JacobiSC",
  "JacobiSD",
  "JacobiCS",
  "JacobiCD",
  "JacobiDS",
  "JacobiDC",
  "JacobiAmplitude",
  "JacobiZN",
] as const;

function jacobiPartial(head: string, orders: readonly number[]): OrderPartial | undefined {
  const body = jacobiPartialBody(head, orders);
  return body === undefined ? undefined : { params: ["u", "m"], body };
}

// --- ErfInv: y′ = (√π/2)·e^(y²) -------------------------------------------------------------

const isOrder = (n: number | undefined): n is number => n !== undefined && Number.isInteger(n) && n >= 1;

/**
 * ∂ⁿ/∂xⁿ of y = ErfInv(…, x) is (√π/2)ⁿ·P(y, E) with E = e^(y²), and E′ = 2y·(√π/2)·E², so a
 * monomial y^a·E^b differentiates to (√π/2)(a·y^(a−1)·E^(b+1) + 2b·y^(a+1)·E^(b+1)).
 */
function erfInvInTarget(n: number, params: readonly string[], y: Json): OrderPartial {
  const start: Poly = new Map();
  addTerm(start, [0, 1], 0, 1); // y′ = (√π/2)·E, with the (√π/2) factor held out
  const poly = iterate(start, n - 1, ({ exps: [a, b], mDeg, coef }, out) => {
    addTerm(out, [a - 1, b + 1], mDeg, a * coef);
    addTerm(out, [a + 1, b + 1], mDeg, 2 * b * coef);
  });
  const polynomial = toJson(poly, [y, ["Exp", ["Power", y, 2]]], undefined);
  return { params, body: ["Multiply", ["Power", ["Multiply", ["Rational", 1, 2], ["Sqrt", "Pi"]], n], polynomial] };
}

/**
 * ∂ⁿ/∂z0ⁿ of the two-argument ErfInv(z0, s) = ErfInv(s + Erf(z0)): y′ = F with F = e^(y²−z0²) (the
 * erf′ factors cancel), and F′ = F·(2y·F − 2z0), so y^a·F^b·z0^c differentiates to
 * a·y^(a−1)·F^(b+1)·z0^c + 2b·y^(a+1)·F^(b+1)·z0^c − 2b·y^a·F^b·z0^(c+1) + c·y^a·F^b·z0^(c−1).
 */
function erfInvInOrigin(n: number): OrderPartial {
  const start: Poly = new Map();
  addTerm(start, [0, 1, 0], 0, 1);
  const poly = iterate(start, n - 1, ({ exps: [a, b, c], mDeg, coef }, out) => {
    addTerm(out, [a - 1, b + 1, c], mDeg, a * coef);
    addTerm(out, [a + 1, b + 1, c], mDeg, 2 * b * coef);
    addTerm(out, [a, b, c + 1], mDeg, -2 * b * coef);
    addTerm(out, [a, b, c - 1], mDeg, c * coef);
  });
  const y: Json = ["ErfInv", "z0", "s"];
  const f: Json = ["Exp", ["Subtract", ["Power", y, 2], ["Power", "z0", 2]]];
  return { params: ["z0", "s"], body: toJson(poly, [y, f, "z0"], undefined) };
}

function erfInvPartial(orders: readonly number[]): OrderPartial | undefined {
  if (orders.length === 1) return isOrder(orders[0]) ? erfInvInTarget(orders[0], ["x"], ["ErfInv", "x"]) : undefined;
  const [origin, target] = orders;
  if (orders.length !== 2) return undefined;
  if (target === 0 && isOrder(origin)) return erfInvInOrigin(origin);
  if (origin === 0 && isOrder(target)) return erfInvInTarget(target, ["z0", "s"], ["ErfInv", "z0", "s"]);
  return undefined;
}

// --- Hypergeometric0F1: d/dx ₀F₁(a; x) = ₀F₁(a+1; x)/a ------------------------------------

/** ∂ⁿ/∂xⁿ ₀F₁(a; x) = ₀F₁(a+n; x) / (a)ₙ. */
function hypergeometric0F1Partial(orders: readonly number[]): OrderPartial | undefined {
  const [aOrder, n] = orders;
  if (orders.length !== 2 || aOrder !== 0 || n === undefined || !Number.isInteger(n) || n < 1) return undefined;
  const rising: Json[] = Array.from({ length: n }, (_, k) => (k === 0 ? "a" : ["Add", "a", k]));
  return {
    params: ["a", "x"],
    body: [
      "Divide",
      ["Hypergeometric0F1", ["Add", "a", n], "x"],
      rising.length === 1 ? rising[0]! : ["Multiply", ...rising],
    ],
  };
}

// --- EllipticE: E(m) = (π/2)·₂F₁(−½, ½; 1; m) -----------------------------------------------

/** E⁽ⁿ⁾(m) = (π/2)·(−½)ₙ(½)ₙ/n! · ₂F₁(n−½, n+½; n+1; m). */
function ellipticEPartial(orders: readonly number[]): OrderPartial | undefined {
  const [n] = orders;
  if (orders.length !== 1 || n === undefined || !Number.isInteger(n) || n < 1) return undefined;
  // (−½)ₙ(½)ₙ/n! = Π(2i−1)(2i+1) / (4ⁿ·n!)
  let num = 1;
  let den = 1;
  for (let i = 0; i < n; i++) {
    num *= (2 * i - 1) * (2 * i + 1);
    den *= 4 * (i + 1);
  }
  return {
    params: ["m"],
    body: [
      "Multiply",
      ["Rational", num, den],
      ["Divide", "Pi", 2],
      ["Hypergeometric2F1", ["Rational", 2 * n - 1, 2], ["Rational", 2 * n + 1, 2], n + 1, "m"],
    ],
  };
}

type Resolver = (orders: readonly number[]) => OrderPartial | undefined;

/** Heads whose partials of any order come from a rule rather than a stored table row. */
export const ORDER_RESOLVERS: Readonly<Record<string, Resolver>> = {
  ...Object.fromEntries(JACOBI_HEADS.map((head) => [head, (o: readonly number[]) => jacobiPartial(head, o)])),
  ErfInv: erfInvPartial,
  Hypergeometric0F1: hypergeometric0F1Partial,
  EllipticE: ellipticEPartial,
};
