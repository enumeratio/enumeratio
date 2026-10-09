import type { Json } from "@enumeratio/ce-patches";

// The expansion in u at u = 0 of the Jacobi functions that have a pole there, ns = 1/sn, cs = cn/sn
// and ds = dn/sn: u⁻¹ times a power series whose coefficients are polynomials in m.
//
// sn, cn, dn are the power series of sn′ = cn·dn, cn′ = −sn·dn, dn′ = −m·sn·cn from sn(0) = 0,
// cn(0) = dn(0) = 1 (DLMF 22.13.4–6), which gives each coefficient by recurrence. With
// sn = u·g, g(0) = 1, the quotient P/sn is u⁻¹ · (P/g), and P/g is one more series division.

type Q = readonly [bigint, bigint];
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const q = (n: bigint | number, d: bigint | number = 1): Q => {
  const [a, b] = BigInt(d) < 0n ? [-BigInt(n), -BigInt(d)] : [BigInt(n), BigInt(d)];
  const g = gcd(a, b) || 1n;
  return [a / g, b / g];
};
const qAdd = (a: Q, b: Q): Q => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const qMul = (a: Q, b: Q): Q => q(a[0] * b[0], a[1] * b[1]);

/** A polynomial in m, lowest power first. */
type Poly = readonly Q[];
const ZERO: Poly = [];
const ONE: Poly = [q(1)];

const polyAdd = (a: Poly, b: Poly): Poly =>
  Array.from({ length: Math.max(a.length, b.length) }, (_, i) => qAdd(a[i] ?? q(0), b[i] ?? q(0)));
const polyScale = (a: Poly, c: Q): Poly => a.map((x) => qMul(x, c));
const polyMul = (a: Poly, b: Poly): Poly => {
  const out: Q[] = Array.from({ length: a.length + b.length }, () => q(0));
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] = qAdd(out[i + j]!, qMul(x, y)))));
  return out;
};
const shift = (a: Poly): Poly => (a.length === 0 ? a : [q(0), ...a]);

const sum = (n: number, term: (i: number) => Poly): Poly => {
  let total: Poly = ZERO;
  for (let i = 0; i <= n; i++) total = polyAdd(total, term(i));
  return total;
};

/** Taylor coefficients 0 … `count`−1 of sn, cn, dn in u, each a polynomial in m. */
function taylor(count: number): { s: Poly[]; c: Poly[]; d: Poly[] } {
  const s: Poly[] = [ZERO];
  const c: Poly[] = [ONE];
  const d: Poly[] = [ONE];
  for (let k = 0; k + 1 < count; k++) {
    const over = q(1, k + 1);
    s.push(
      polyScale(
        sum(k, (i) => polyMul(c[i]!, d[k - i]!)),
        over,
      ),
    );
    c.push(
      polyScale(
        sum(k, (i) => polyMul(s[i]!, d[k - i]!)),
        q(-1, k + 1),
      ),
    );
    d.push(polyScale(shift(sum(k, (i) => polyMul(s[i]!, c[k - i]!))), q(-1, k + 1)));
  }
  return { s, c, d };
}

const rational = ([n, d]: Q): Json => (d === 1n ? Number(n) : ["Rational", Number(n), Number(d)]);

function polyJson(p: Poly, m: Json): Json {
  const terms: Json[] = [];
  p.forEach((coefficient, i) => {
    if (coefficient[0] === 0n) return;
    const power: Json | undefined = i === 0 ? undefined : i === 1 ? m : ["Power", m, i];
    const isOne = coefficient[0] === 1n && coefficient[1] === 1n;
    if (power === undefined) terms.push(rational(coefficient));
    else terms.push(isOne ? power : ["Multiply", rational(coefficient), power]);
  });
  return terms.length === 0 ? 0 : terms.length === 1 ? terms[0]! : ["Add", ...terms];
}

export const JACOBI_POLE_HEADS: readonly string[] = ["JacobiNS", "JacobiCS", "JacobiDS"];
export const MAX_LAURENT_ORDER = 12;

/**
 * The terms `coefficient·uᵉ` of the expansion of `head(u, m)` at u = 0 through uⁿ, as
 * [exponent, coefficient expression] pairs in increasing exponent, `m` being the expression for
 * the parameter. Undefined for another head or an order past the cap.
 */
export function jacobiLaurent(head: string, n: number, m: Json): [number, Json][] | undefined {
  if (!JACOBI_POLE_HEADS.includes(head) || !Number.isInteger(n) || n < 0 || n > MAX_LAURENT_ORDER) return undefined;
  const { s, c, d } = taylor(n + 3);
  const numerator = head === "JacobiNS" ? undefined : head === "JacobiCS" ? c : d;
  const g = (i: number): Poly => s[i + 1]!;
  const ratio: Poly[] = [];
  for (let k = 0; k <= n + 1; k++) {
    let value: Poly = numerator === undefined ? (k === 0 ? ONE : ZERO) : numerator[k]!;
    for (let i = 1; i <= k; i++) value = polyAdd(value, polyScale(polyMul(g(i), ratio[k - i]!), q(-1)));
    ratio.push(value);
  }
  return ratio.flatMap((p, k): [number, Json][] => {
    const coefficient = polyJson(p, m);
    return coefficient === 0 ? [] : [[k - 1, coefficient]];
  });
}
