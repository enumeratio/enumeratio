// O_K as a lattice for `<notatio-lattice-plot>`: the point (i, j) is i + jω, painted by whether it
// is prime, irreducible but not prime, a unit, zero or composite. It has the shape of
// @enumeratio/frontend's `LatticeLayer` without importing it — a library does not import the
// presentation layer.
//
// Classifying a screenful of points is the hot path, so it runs on doubles: the norm's factors by
// trial division, each rational prime's ideals and classes computed once (in bigints, through
// ./quadratic.ts) and cached. A point the doubles cannot answer exactly falls back to the bigint
// kernel.

import {
  classGroup,
  classIndex,
  classify,
  fundamentalUnit,
  idealFactorization,
  idealForm,
  irreducibleFactorizations,
  divideExact,
  mul,
  ONE,
  factorElement,
  normalize,
  type PrimeIdeal,
  primeIdealsAbove,
  type QuadraticElement,
  type QuadraticKind,
  type QuadraticRing,
  quadraticRing,
  rootsOfUnity,
  splitsPrincipally,
  norm as exactNorm,
  isUnit,
} from "./quadratic.ts";

type Vec2 = readonly [number, number];

/** Category codes, as the layer's `categories` list them. */
export const CELL = { composite: 0, prime: 1, irreducible: 2, unit: 3, zero: 4, unknown: 5 } as const;

const KIND_CODE: Record<QuadraticKind, number> = CELL;

/**
 * How the non-real axis is scaled: `uniform` measures it in units of the ring's own generator,
 * so the tiles are squares (or regular hexagons, d ≡ 1 mod 4) in every ring; `geometric` places
 * x + y√d at (x, y√|d|) — the complex plane for d < 0, so the lattice overlays a complex plot of
 * the same view.
 */
export type QuadraticScale = "uniform" | "geometric";

export interface QuadraticLatticeOptions {
  readonly scale?: QuadraticScale;
}

/** Past this |N|, products of doubles can lose digits; the norm stays under 2⁵⁰. */
const NORM_LIMIT = 2 ** 50;
/** Trial division covers a norm fully below SMALL_LIMIT² — every norm under 2³². */
const SMALL_LIMIT = 65_536;

let smallPrimes: Int32Array | undefined;
function primesBelow(n: number): Int32Array {
  const sieve = new Uint8Array(n);
  const out: number[] = [];
  for (let p = 2; p < n; p++) {
    if (sieve[p]) continue;
    out.push(p);
    for (let q = p * p; q < n; q += p) sieve[q] = 1;
  }
  return Int32Array.from(out);
}

/** n's factorization as [p, e] pairs when trial division finishes it, else undefined. */
function factorSmall(n: number): [number, number][] | undefined {
  smallPrimes ??= primesBelow(SMALL_LIMIT);
  const out: [number, number][] = [];
  let rest = n;
  for (const p of smallPrimes) {
    if (p * p > rest) break;
    if (rest % p !== 0) continue;
    let e = 0;
    while (rest % p === 0) {
      rest /= p;
      e++;
    }
    out.push([p, e]);
  }
  if (rest > 1) {
    if (rest >= SMALL_LIMIT * SMALL_LIMIT) return undefined;
    out.push([rest, 1]);
  }
  return out;
}

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const superscript = (n: number): string =>
  n === 1
    ? ""
    : String(n)
        .split("")
        .map((c) => SUPERSCRIPT[+c])
        .join("");
const minus = (n: bigint | number): string => (n < 0 ? `−${-n}` : `${n}`);

/** √d as text: i for d = −1. */
const sqrtText = (d: bigint): string => (d === -1n ? "i" : `√${minus(d)}`);

/** a + b·root, signs folded in. */
function surdSum(a: bigint, b: bigint, root: string): string {
  if (b === 0n) return minus(a);
  const term = `${b === 1n || b === -1n ? "" : String(b < 0n ? -b : b)}${root}`;
  if (a === 0n) return b < 0n ? `−${term}` : term;
  return `${minus(a)} ${b < 0n ? "−" : "+"} ${term}`;
}

/** x + yω written over √d: x + y√d, or (X + Y√d)/2 when ω = (−1 + √d)/2 and X, Y are odd. */
export function elementText(R: QuadraticRing, [x, y]: QuadraticElement): string {
  const root = sqrtText(R.d);
  if (R.s === 0n) return surdSum(x, y, root);
  const X = 2n * x + R.s * y;
  return y % 2n === 0n ? surdSum(X / 2n, y / 2n, root) : `(${surdSum(X, y, root)})/2`;
}

/** The ring's name as text: ℤ[i], ℤ[√−5], ℤ[ω] with ω = (−1 + √−3)/2. */
export function ringText(R: QuadraticRing): string {
  return R.s === 0n ? `ℤ[${sqrtText(R.d)}]` : `ℤ[ω], ω = (−1 + ${sqrtText(R.d)})/2`;
}

/** A prime ideal as text: (p) when inert, else (p, a + √d), which is (p, ω − c). */
export function idealText(R: QuadraticRing, P: PrimeIdeal): string {
  if (P.kind === "inert") return `(${P.p})`;
  const p = P.p;
  const symmetric = (a: bigint): bigint => {
    const m = ((a % p) + p) % p;
    return m > p / 2n ? m - p : m;
  };
  if (R.s !== 0n && p === 2n) return `(2, ${elementText(R, [-P.c!, 1n])})`;
  // For odd p, (p, ω − c) = (p, 2ω − 2c) and 2ω − 2c = (s − 2c) + √d.
  const a = R.s !== 0n ? symmetric(R.s - 2n * P.c!) : symmetric(-P.c!);
  return `(${p}, ${surdSum(a, 1n, sqrtText(R.d))})`;
}

interface PrimeInfo {
  /** 0 inert, 1 split, 2 ramified. */
  readonly kind: 0 | 1 | 2;
  /** The roots c of the split or ramified ideals, as doubles, and their classes. */
  readonly c: readonly number[];
  readonly classes: readonly number[];
}

interface Category {
  readonly code: number;
  readonly label: string;
  readonly paint: "gradient" | "discrete" | "foreground" | "muted" | "none";
  readonly style?: "fill" | "outline" | "dashed";
}

interface Coloring {
  readonly id: string;
  readonly label: string;
  readonly categories: readonly Category[];
  code(i: number, j: number): number | undefined;
  value?(i: number, j: number): number;
  readonly valueLabel?: string;
}

export interface QuadraticLattice {
  readonly ring: QuadraticRing;
  readonly title: string;
  readonly basis: readonly [Vec2, Vec2];
  readonly maxIndex: number;
  readonly colorings: readonly Coloring[];
  known(i: number, j: number): boolean;
  label(i: number, j: number): string | undefined;
  readonly grid: readonly [Vec2, Vec2];
  gridLabel(axis: 0 | 1, k: number): string;
  readonly highlightModes: readonly { id: string; label: string }[];
  related(mode: string, selected: Vec2, i: number, j: number): boolean;
  describe(i: number, j: number): { title: string; rows: (readonly [string, string])[] };
  /** Facts about the ring as a whole, for a heading. */
  summary(): (readonly [string, string])[];
}

/** The lattice of O_K for ℚ(√n), or undefined when n is a square. */
export function quadraticLattice(
  n: number | bigint,
  options: QuadraticLatticeOptions = {},
): QuadraticLattice | undefined {
  const R = quadraticRing(BigInt(n));
  if (R === undefined) return undefined;
  const ring = R;
  const [s, r] = [Number(R.s), Number(R.r)];
  const D = Number(R.discriminant);
  const group = classGroup(R);
  const hexagonal = s !== 0;

  const basis: readonly [Vec2, Vec2] =
    options.scale === "geometric"
      ? [
          [1, 0],
          [s / 2, Math.sqrt(Math.abs(D)) / 2],
        ]
      : hexagonal
        ? [
            [1, 0],
            [-0.5, Math.sqrt(3) / 2],
          ]
        : [
            [1, 0],
            [0, 1],
          ];
  // |N(i + jω)| ≤ (|i| + |j|)²·(1 + |s| + |r|) stays under NORM_LIMIT.
  const maxIndex = Math.floor(Math.sqrt(NORM_LIMIT / (1 + Math.abs(s) + Math.abs(r))) / 2);

  const primes = new Map<number, PrimeInfo>();
  const primeInfo = (p: number): PrimeInfo => {
    let info = primes.get(p);
    if (info === undefined) {
      const ideals = primeIdealsAbove(R, BigInt(p));
      const kind = ideals[0]!.kind === "inert" ? 0 : ideals[0]!.kind === "split" ? 1 : 2;
      info = {
        kind,
        c: kind === 0 ? [] : ideals.map((P) => Number(P.c!)),
        classes: kind === 0 || group === undefined ? [] : ideals.map((P) => classIndex(group, idealForm(R, P))),
      };
      primes.set(p, info);
    }
    return info;
  };

  /** (a·b) mod p without losing digits past 2⁵³. */
  const mulMod = (a: number, b: number, p: number): number =>
    a * b < Number.MAX_SAFE_INTEGER ? (a * b) % p : Number((BigInt(a) * BigInt(b)) % BigInt(p));
  const modP = (a: number, p: number): number => ((a % p) + p) % p;

  const normOf = (i: number, j: number): number => i * i + s * i * j - r * j * j;

  function classifyFast(i: number, j: number): number {
    const n = normOf(i, j);
    if (n === 0) return CELL.zero;
    const m = Math.abs(n);
    if (m === 1) return CELL.unit;
    const factors = m < NORM_LIMIT ? factorSmall(m) : undefined;
    if (factors === undefined) {
      const kind = classify(ring, [BigInt(i), BigInt(j)]);
      return kind === undefined ? CELL.unknown : KIND_CODE[kind];
    }
    let omega = 0;
    let inert = false;
    const classes: number[] = [];
    for (const [p, e] of factors) {
      const info = primeInfo(p);
      if (info.kind === 0) {
        inert = true;
        omega += e / 2;
      } else if (info.kind === 2) {
        omega += e;
        for (let k = 0; k < e; k++) classes.push(info.classes[0] ?? 0);
      } else {
        let [x, y, k] = [i, j, 0];
        while (x % p === 0 && y % p === 0) {
          x /= p;
          y /= p;
          k++;
        }
        const left = e - 2 * k;
        omega += e;
        for (let t = 0; t < info.c.length; t++) {
          const inside = left > 0 && modP(modP(x, p) + mulMod(modP(y, p), info.c[t]!, p), p) === 0;
          const exponent = k + (inside ? left : 0);
          for (let q = 0; q < exponent; q++) classes.push(info.classes[t] ?? 0);
        }
      }
    }
    if (omega === 1) return CELL.prime;
    if (inert) return CELL.composite;
    if (group === undefined) return CELL.unknown;
    if (group.order === 1) return CELL.composite;
    return splitsPrincipally(group, classes) ? CELL.composite : CELL.irreducible;
  }

  const OFFSET = 2 ** 25;
  const key = (i: number, j: number): number => (i + OFFSET) * 2 ** 26 + (j + OFFSET);
  const cache = new Map<number, number>();
  const CACHE_LIMIT = 4_000_000;

  const element = (p: Vec2): QuadraticElement => [BigInt(p[0]), BigInt(p[1])];

  /** b/a in O_K as doubles, exactly while the products stay safe; undefined otherwise. */
  const divides = (a: Vec2, b: Vec2): boolean => {
    const n = normOf(a[0], a[1]);
    if (n === 0) return b[0] === 0 && b[1] === 0;
    // b·ā, with ā = (a₀ + s·a₁) − a₁ω.
    const [c0, c1] = [a[0] + s * a[1], -a[1]];
    const x = b[0] * c0 + r * b[1] * c1;
    const y = b[0] * c1 + b[1] * c0 + s * b[1] * c1;
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return false;
    return x % n === 0 && y % n === 0;
  };
  const associates = (a: Vec2, b: Vec2): boolean => {
    const [na, nb] = [Math.abs(normOf(a[0], a[1])), Math.abs(normOf(b[0], b[1]))];
    return na === nb && na !== 0 && divides(a, b);
  };

  const units =
    R.d < 0n
      ? `${rootsOfUnity(R).length} (the roots of unity)`
      : (() => {
          const eps = fundamentalUnit(R)!;
          return `±εᵏ, ε = ${elementText(R, eps)} (norm ${minus(exactNorm(R, eps))})`;
        })();

  const kindLabel: Record<number, string> = {
    [CELL.composite]: "composite",
    [CELL.prime]: "prime",
    [CELL.irreducible]: "irreducible, not prime",
    [CELL.unit]: "unit",
    [CELL.zero]: "zero",
    [CELL.unknown]: "not decided",
  };

  const classified = (i: number, j: number): number => {
    const k = key(i, j);
    let code = cache.get(k);
    if (code === undefined) {
      if (cache.size > CACHE_LIMIT) cache.clear();
      code = classifyFast(i, j);
      cache.set(k, code);
    }
    return code;
  };
  const normValue = (i: number, j: number): number => Math.sqrt(Math.abs(normOf(i, j)));
  const SPLITTING = { split: 10, inert: 11, ramified: 12 } as const;

  return {
    ring: R,
    title: `ℚ(${sqrtText(R.d)})`,
    basis,
    maxIndex,
    colorings: [
      {
        id: "kind",
        label: "primes by norm",
        categories: [
          { code: CELL.prime, label: "prime", paint: "gradient" },
          { code: CELL.irreducible, label: "irreducible, not prime", paint: "discrete" },
          { code: CELL.unit, label: "unit", paint: "discrete" },
          { code: CELL.zero, label: "zero", paint: "discrete", style: "outline" },
          { code: CELL.composite, label: "composite", paint: "none" },
          { code: CELL.unknown, label: "not decided", paint: "muted", style: "dashed" },
        ],
        code: classified,
        value: normValue,
        valueLabel: "√|N|",
      },
      {
        id: "splitting",
        label: "primes by how p splits",
        categories: [
          { code: SPLITTING.split, label: "p splits", paint: "discrete" },
          { code: SPLITTING.inert, label: "p is inert", paint: "discrete" },
          { code: SPLITTING.ramified, label: "p ramifies", paint: "discrete" },
          { code: CELL.irreducible, label: "irreducible, not prime", paint: "discrete" },
          { code: CELL.unit, label: "unit", paint: "discrete" },
          { code: CELL.zero, label: "zero", paint: "discrete", style: "outline" },
          { code: CELL.composite, label: "composite", paint: "none" },
          { code: CELL.unknown, label: "not decided", paint: "muted", style: "dashed" },
        ],
        code(i, j) {
          const code = classified(i, j);
          if (code !== CELL.prime) return code;
          const m = Math.abs(normOf(i, j));
          const p = Math.round(Math.sqrt(m));
          // A prime's norm is ±p (split or ramified) or p² (inert).
          if (p * p === m && primeInfo(p).kind === 0) return SPLITTING.inert;
          return primeInfo(m).kind === 2 ? SPLITTING.ramified : SPLITTING.split;
        },
      },
    ],
    label: (i, j) => elementText(R, [BigInt(i), BigInt(j)]),
    known: (i, j) => cache.has(key(i, j)),
    // 1 and ω: a square grid for ℤ[√d], a rhombic one when ω = (−1 + √d)/2 tips up and to the left.
    grid: [
      [1, 0],
      [0, 1],
    ],
    gridLabel: (axis, k) =>
      axis === 0 ? minus(k) : `${k === 1 ? "" : k === -1 ? "−" : minus(k)}${hexagonal ? "ω" : sqrtText(R.d)}`,
    highlightModes: [
      { id: "factors", label: "irreducible factors" },
      { id: "multiples", label: "multiples" },
      { id: "associates", label: "associates" },
    ],
    related(mode, selected, i, j) {
      if (mode === "multiples") return divides(selected, [i, j]);
      if (mode === "associates") return associates(selected, [i, j]);
      if (mode === "factors") {
        const code = classified(i, j);
        return (code === CELL.prime || code === CELL.irreducible) && divides([i, j], selected);
      }
      return false;
    },
    describe(i, j) {
      const a = element([i, j]);
      const n = exactNorm(R, a);
      const code = classified(i, j);
      const rows: [string, string][] = [
        ["norm", minus(n)],
        ["kind", kindLabel[code]!],
      ];
      if (n !== 0n && !isUnit(R, a)) {
        const ufd = group?.order === 1;
        const primesOf = ufd ? factorElement(R, a) : undefined;
        if (primesOf !== undefined) {
          rows.push([
            "factors",
            primesOf
              .map(([p, e]) => (isUnit(R, p) ? elementText(R, p) : `(${elementText(R, p)})${superscript(e)}`))
              .join(" · "),
          ]);
        } else {
          // Every way to group (a)'s prime ideals into irreducibles, with the unit left over.
          const ways = irreducibleFactorizations(R, a) ?? [];
          for (const parts of ways) {
            const product = parts.reduce((acc, p) => mul(R, acc, p), ONE);
            const unit = divideExact(R, a, product);
            const shown = parts.map((p) => (parts.length > 1 ? `(${elementText(R, p)})` : elementText(R, p)));
            if (unit !== undefined && !(unit[0] === 1n && unit[1] === 0n)) shown.unshift(elementText(R, unit));
            rows.push([ways.length > 1 ? "factorization" : "irreducibles", shown.join(" · ")]);
          }
        }
        const ideals = idealFactorization(R, a);
        if (ideals !== undefined && !ufd) {
          rows.push(["ideals", ideals.map(([P, e]) => `${idealText(R, P)}${superscript(e)}`).join(" ")]);
        }
        const [w] = normalize(R, a);
        rows.push(["normal form", elementText(R, w)]);
      }
      rows.push(["epsil", `QuadraticInteger(${R.d}, ${i}, ${j})`]);
      return { title: elementText(R, a), rows };
    },
    summary() {
      return [
        ["ring", ringText(R)],
        ["discriminant", minus(R.discriminant)],
        ["class number", group === undefined ? "too large to enumerate" : String(group.order)],
        ["units", units],
      ];
    },
  };
}

/**
 * The squarefree d after (or before) n with |d| ≤ limit, skipping 0 and 1 — the next field in a
 * sweep through ℚ(√d).
 */
export function stepField(n: number, direction: 1 | -1, limit = 10_000): number {
  for (let d = n + direction; Math.abs(d) <= limit; d += direction) {
    if (d === 0 || d === 1) continue;
    const R = quadraticRing(BigInt(d));
    if (R !== undefined && R.d === BigInt(d)) return d;
  }
  return n;
}
