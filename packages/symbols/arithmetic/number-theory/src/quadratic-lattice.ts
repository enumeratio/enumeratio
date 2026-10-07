// O_K as a layer for `Show`'s `LatticeTiles`: the point (i, j) is i + jω, and it answers what a
// Show's rules ask of it — whether it is prime, irreducible but not prime, a unit, zero or
// composite, how the prime below it splits, its norm, and how it relates to a selected point. It
// has the shape of a Show layer without importing it — a library does not import the
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
  meetsConductor,
  quadraticOrder,
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

/**
 * Where the elements are drawn: on their lattice, or, for a real field, at their logarithmic
 * embedding (log|σ₁(α)|, log|σ₂(α)|). There the units lie on the antidiagonal, evenly spaced by
 * the regulator, and the elements of norm ±n on the line x + y = log n.
 */
export type QuadraticEmbedding = "lattice" | "logarithmic";

export interface QuadraticLatticeOptions {
  readonly scale?: QuadraticScale;
  readonly embedding?: QuadraticEmbedding;
  /** An order's discriminant f²·D_K instead of the field's: `QuadraticOrder(D)`'s lattice. */
  readonly discriminant?: number | bigint;
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

/**
 * The surd an order's elements are written over: √(D/4) when s is even (ω = s/2 + √(D/4): √d
 * for ℤ[√d], √8 for ℤ[√8]), √D when s is odd (ω = (s + √D)/2).
 */
const rootOf = (R: QuadraticRing): string =>
  R.s % 2n === 0n ? sqrtText(R.discriminant / 4n) : sqrtText(R.discriminant);

/** x + yω written over its surd: x + y√8 in ℤ[√8], or (X + Y√D)/2 when s is odd and X, Y are. */
export function elementText(R: QuadraticRing, [x, y]: QuadraticElement): string {
  const root = rootOf(R);
  if (R.s % 2n === 0n) return surdSum(x + (R.s / 2n) * y, y, root);
  const X = 2n * x + R.s * y;
  return y % 2n === 0n ? surdSum(X / 2n, y / 2n, root) : `(${surdSum(X, y, root)})/2`;
}

/** The order's name as text: ℤ[i], ℤ[√−5], ℤ[√8], or ℤ[ω] with ω = (−1 + √−3)/2. */
export function ringText(R: QuadraticRing): string {
  return R.s % 2n === 0n ? `ℤ[${rootOf(R)}]` : `ℤ[ω], ω = (${minus(R.s)} + ${rootOf(R)})/2`;
}

/** A prime ideal as text: (p) when inert, else (p, a + √d), which is (p, ω − c). */
export function idealText(R: QuadraticRing, P: PrimeIdeal): string {
  if (P.kind === "inert") return `(${P.p})`;
  const p = P.p;
  const symmetric = (a: bigint): bigint => {
    const m = ((a % p) + p) % p;
    return m > p / 2n ? m - p : m;
  };
  // ω − c = (s/2 − c) + √(D/4) when s is even.
  if (R.s % 2n === 0n) return `(${p}, ${surdSum(symmetric(R.s / 2n - P.c!), 1n, rootOf(R))})`;
  if (p === 2n) return `(2, ${elementText(R, [-P.c!, 1n])})`;
  // For odd p, (p, ω − c) = (p, 2ω − 2c) and 2ω − 2c = (s − 2c) + √D.
  return `(${p}, ${surdSum(symmetric(R.s - 2n * P.c!), 1n, rootOf(R))})`;
}

interface PrimeInfo {
  /** 0 inert, 1 split, 2 ramified. */
  readonly kind: 0 | 1 | 2;
  /** The roots c of the split or ramified ideals, as doubles, and their classes. */
  readonly c: readonly number[];
  readonly classes: readonly number[];
}

export interface QuadraticLattice {
  readonly ring: QuadraticRing;
  readonly title: string;
  readonly basis: readonly [Vec2, Vec2];
  readonly maxIndex: number;
  known(i: number, j: number): boolean;
  readonly grid: readonly [Vec2, Vec2];
  gridLabel(axis: 0 | 1, k: number): string;
  /** Classify point (i, j) now, for a figure that draws only what is known. */
  prepare(i: number, j: number): void;
  /** What a figure's queries may test of a point, and what each means. */
  readonly properties: readonly { readonly name: string; readonly description: string }[];
  /** Whether point (i, j) has a property; undefined while it isn't known. */
  has(i: number, j: number, property: string): boolean | undefined;
  /** Values a gradient may read of a point. */
  readonly values: readonly { readonly name: string; readonly description: string }[];
  value(i: number, j: number, name: string): number | undefined;
  /** Relations a point may stand in to a selected one. */
  readonly relations: readonly { readonly name: string; readonly description: string }[];
  relatedTo(relation: string, selected: Vec2, i: number, j: number): boolean;
  describe(i: number, j: number): { title: string; rows: (readonly [string, string])[] };
  /** Facts about the ring as a whole, for a heading. */
  summary(): (readonly [string, string])[];
  /** In the logarithmic embedding: where i + jω sits, the points there are, and their range. */
  place?(i: number, j: number): readonly number[];
  addresses?(): readonly Vec2[];
  mark?(i: number, j: number): { readonly head: "Disk"; readonly radius: number };
  readonly bounds?: { readonly i: Vec2; readonly j: Vec2 };
}

/**
 * The lattice of O_K for ℚ(√n), or with `discriminant` of the order of that discriminant;
 * undefined when n is a square, or the discriminant isn't one, or the logarithmic embedding is
 * asked of an imaginary field.
 */
export function quadraticLattice(
  n: number | bigint,
  options: QuadraticLatticeOptions = {},
): QuadraticLattice | undefined {
  const R =
    options.discriminant === undefined ? quadraticRing(BigInt(n)) : quadraticOrder(BigInt(options.discriminant));
  if (R === undefined || (options.embedding === "logarithmic" && R.discriminant < 0n)) return undefined;
  const ring = R;
  const [s, r] = [Number(R.s), Number(R.r)];
  const D = Number(R.discriminant);
  const group = classGroup(R);
  // ω = s/2 + √(D/4) for an even s, a square lattice; ω = (s + √D)/2 for an odd one, a centered,
  // hexagonal one.
  const hexagonal = s % 2 !== 0;

  const basis: readonly [Vec2, Vec2] =
    options.scale === "geometric"
      ? [
          [1, 0],
          [s / 2, Math.sqrt(Math.abs(D)) / 2],
        ]
      : [
          [1, 0],
          [s / 2, hexagonal ? Math.sqrt(3) / 2 : 1],
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
  const conductor = Number(R.conductor);

  function classifyFast(i: number, j: number): number {
    const n = normOf(i, j);
    if (n === 0) return CELL.zero;
    const m = Math.abs(n);
    if (m === 1) return CELL.unit;
    const factors = m < NORM_LIMIT ? factorSmall(m) : undefined;
    // Past the doubles, or at a prime of the conductor where the ideal theory below doesn't
    // hold: the exact kernel.
    if (factors === undefined || (conductor > 1 && factors.some(([p]) => conductor % p === 0))) {
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
  const SPLITTING = { split: 10, inert: 11, ramified: 12 } as const;
  /** How the rational prime p below a prime (i, j) splits: its norm is ±p (split, ramified) or p² (inert). */
  const splittingOf = (i: number, j: number): number => {
    const m = Math.abs(normOf(i, j));
    const p = Math.round(Math.sqrt(m));
    if (p * p === m && primeInfo(p).kind === 0) return SPLITTING.inert;
    return primeInfo(m).kind === 2 ? SPLITTING.ramified : SPLITTING.split;
  };

  const lattice: QuadraticLattice = {
    ring: R,
    title: R.conductor === 1n ? `ℚ(${sqrtText(R.d)})` : ringText(R),
    basis,
    maxIndex,
    known: (i, j) => cache.has(key(i, j)),
    // 1 and ω: a square grid for ℤ[√d], a rhombic one when ω = (−1 + √d)/2 tips up and to the left.
    // An even s makes the lattice square whatever ω is (ℤ[√−3]'s ω = −1 + √−3): its grid runs
    // along ω − s/2 = √(D/4) instead, at lattice coordinates (−s/2, 1).
    grid: [
      [1, 0],
      [hexagonal ? 0 : -s / 2, 1],
    ],
    // ω stands for the generator on its axis (i for ℤ[i], the root when the grid follows it); the
    // caption says what it is.
    gridLabel: (axis, k) =>
      axis === 0
        ? minus(k)
        : `${k === 1 ? "" : k === -1 ? "−" : minus(k)}${R.d === -1n ? "i" : hexagonal || s === 0 ? "ω" : rootOf(R)}`,
    properties: [
      { name: "IsPrime", description: "a prime element: (α) is a prime ideal" },
      { name: "IsIrreducible", description: "no factorization into two non-units; every prime is irreducible" },
      { name: "IsComposite", description: "a product of two non-units" },
      { name: "IsUnit", description: "norm ±1" },
      { name: "IsZero", description: "zero" },
      { name: "Unknown", description: "not yet classified" },
      { name: "Splits", description: "a prime over a rational prime p that splits: (p) = 𝔭𝔭′" },
      {
        name: "Inert",
        description: "a prime over a rational prime p that stays prime: the element is p, up to a unit",
      },
      { name: "Ramified", description: "a prime over a rational prime p that ramifies: (p) = 𝔭²" },
    ],
    prepare: (i, j) => void classified(i, j),
    has(i, j, property) {
      if (!cache.has(key(i, j)) && property !== "Unknown") return undefined;
      const code = classified(i, j);
      switch (property) {
        case "IsPrime":
          return code === CELL.prime;
        case "IsIrreducible":
          return code === CELL.prime || code === CELL.irreducible;
        case "IsComposite":
          return code === CELL.composite;
        case "IsUnit":
          return code === CELL.unit;
        case "IsZero":
          return code === CELL.zero;
        case "Unknown":
          return code === CELL.unknown;
        case "Splits":
        case "Inert":
        case "Ramified": {
          if (code !== CELL.prime) return false;
          return (
            splittingOf(i, j) ===
            (property === "Splits" ? SPLITTING.split : property === "Inert" ? SPLITTING.inert : SPLITTING.ramified)
          );
        }
      }
      return false;
    },
    values: [
      { name: "Norm", description: "N(α), which is negative for some elements of a real field" },
      { name: "X", description: "the coefficient of 1" },
      { name: "Y", description: "the coefficient of ω" },
    ],
    value(i, j, name) {
      if (name === "Norm") return normOf(i, j);
      if (name === "X") return i;
      if (name === "Y") return j;
      return undefined;
    },
    relations: [
      { name: "Associates", description: "the selection times a unit" },
      { name: "Divides", description: "a divisor of the selection" },
      { name: "IrreducibleFactors", description: "an irreducible divisor of the selection" },
      { name: "Multiples", description: "a multiple of the selection" },
    ],
    relatedTo(relation, selected, i, j) {
      if (relation === "Associates") return associates(selected, [i, j]);
      if (relation === "Multiples") return divides(selected, [i, j]);
      if (relation === "Divides") return normOf(i, j) !== 0 && divides([i, j], selected);
      if (relation === "IrreducibleFactors") {
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
        const ufd = group?.order === 1 && R.conductor === 1n;
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
        // At a prime of the conductor the ideals aren't invertible, and (a) has no such factorization.
        const ideals = meetsConductor(R, a) ? undefined : idealFactorization(R, a);
        if (ideals !== undefined && !ufd) {
          rows.push(["ideals", ideals.map(([P, e]) => `${idealText(R, P)}${superscript(e)}`).join(" ")]);
        }
        const [w] = normalize(R, a);
        rows.push(["normal form", elementText(R, w)]);
      }
      return { title: elementText(R, a), rows };
    },
    summary() {
      return [
        ["ring", ringText(R)],
        ...(R.conductor > 1n ? ([["conductor", String(R.conductor)]] as [string, string][]) : []),
        ["discriminant", minus(R.discriminant)],
        ["class number", group === undefined ? "too large to enumerate" : String(group.order)],
        ["units", units],
      ];
    },
  };
  return options.embedding === "logarithmic" ? logarithmic(lattice, s, r) : lattice;
}

/** The logarithmic embedding draws the elements i + jω with |i|, |j| ≤ LOG_BOX and |N| ≤ LOG_NORMS. */
const LOG_BOX = 120;
const LOG_NORMS = 200;
/** A mark's radius, in units of log|σ|. */
const LOG_MARK = 0.045;

/**
 * `lattice`'s elements at (log|σ₁|, log|σ₂|), σ₁,₂(ω) = (s ± √D)/2 with D = s² + 4r > 0. Only small
 * norms: each lies on its line x + y = log|N|, and the large ones would fill the quadrant.
 */
function logarithmic(lattice: QuadraticLattice, s: number, r: number): QuadraticLattice {
  const root = Math.sqrt(s * s + 4 * r);
  const [w1, w2] = [(s + root) / 2, (s - root) / 2];
  const place = (i: number, j: number): Vec2 => [Math.log(Math.abs(i + j * w1)), Math.log(Math.abs(i + j * w2))];
  const addresses: Vec2[] = [];
  for (let i = -LOG_BOX; i <= LOG_BOX; i++)
    for (let j = -LOG_BOX; j <= LOG_BOX; j++) {
      const n = Math.abs(i * i + s * i * j - r * j * j);
      if (n !== 0 && n <= LOG_NORMS) addresses.push([i, j]);
    }
  // A figure's marks are drawn all at once, not dripped in: each is classified when first asked.
  const ready = (i: number, j: number): void => {
    if (!lattice.known(i, j)) lattice.prepare(i, j);
  };
  return {
    ...lattice,
    title: `${lattice.title}, logarithmically`,
    // The frame is the plane of (log|σ₁|, log|σ₂|) itself, not the lattice's.
    basis: [
      [1, 0],
      [0, 1],
    ],
    known: () => true,
    has(i, j, property) {
      ready(i, j);
      return lattice.has(i, j, property);
    },
    value(i, j, name) {
      ready(i, j);
      return lattice.value(i, j, name);
    },
    place,
    addresses: () => addresses,
    mark: () => ({ head: "Disk", radius: LOG_MARK }),
    bounds: { i: [-LOG_BOX, LOG_BOX], j: [-LOG_BOX, LOG_BOX] },
    // log|σ₁| and log|σ₂| on the axes; a grid line every unit of each.
    gridLabel: (_, k) => minus(k),
    describe(i, j) {
      const d = lattice.describe(i, j);
      const [x, y] = place(i, j);
      return { ...d, rows: [...d.rows, ["log |σ₁|, log |σ₂|", `${minus(+x.toFixed(3))}, ${minus(+y.toFixed(3))}`]] };
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
