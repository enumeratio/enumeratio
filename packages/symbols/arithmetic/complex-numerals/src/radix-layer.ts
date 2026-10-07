// Radix expansions as a layer for `Show`: `RadixExpansions(ring, base, digits, places)` draws
// every Σ dₖβᵏ of at most `places` digits on the ring's lattice (or, with `OnLattice -> False`, at
// whatever points of the plane a base and digits off the lattice give), and answers what a `Show`'s rules
// ask of each point it lands on — properties (`IsDigit`, `Overlaps`), values (`LeadingDigit`,
// `LastDigit`, `Digit(k)`, `Places`, `Address`, `Norm`) and relations to a selected point
// (`Congruent`, `SameLeadingDigit`, `SamePlaces`). It has the shape of a `Show` layer without
// importing it: a library does not import the presentation layer.

import { EXAMPLES, exampleNamed } from "./examples.ts";
import {
  basisOf,
  digitsOf,
  expansions,
  formatSettings,
  formatValue,
  leastResidues,
  lengthLimit,
  mul,
  norm,
  parseSettings,
  type RadixSettings,
  type System,
  type Value,
} from "./radix.ts";

type Vec2 = readonly [number, number];

/** What `RadixExpansions` is given: the digits besides 0, which every system has. */
export interface RadixLayerSettings {
  readonly system: System;
  readonly base: Value;
  readonly digits: readonly Value[];
  readonly places: number;
  /** Base and digits are lattice points, and each numeral a tile of the lattice; else points of the plane. */
  readonly onLattice?: boolean;
}

/** Base norms a random system draws from: big enough to be interesting, small enough to see. */
const RANDOM_NORMS = [2, 12] as const;

/**
 * A random system: a lattice, a base whose norm is in `RANDOM_NORMS`, and one small digit from each
 * residue class, so its tiles vary and every numeral is still a different point.
 */
export function randomSettings(random = Math.random): RadixLayerSettings {
  const system: System = random() < 0.5 ? "i" : "ω";
  let base: Value = [2, 1];
  for (let tries = 0; tries < 200; tries++) {
    const candidate: Value = [Math.round((random() * 2 - 1) * 4), Math.round((random() * 2 - 1) * 4)];
    const n = norm(system, candidate);
    if (n >= RANDOM_NORMS[0] && n <= RANDOM_NORMS[1]) {
      base = candidate;
      break;
    }
  }
  const units: Value[] = [ZERO, [1, 0], [0, 1], [-1, 0], [0, -1]];
  const digits = leastResidues(system, base)
    .slice(1)
    .map((d) => {
      const shift = mul(system, base, units[Math.floor(random() * units.length)]!);
      return [d[0] + shift[0], d[1] + shift[1]] as Value;
    })
    .filter((d) => !isZero(d));
  return { system, base, digits, places: lengthLimit(digits.length + 1), onLattice: true };
}

const ZERO: Value = [0, 0];
const isZero = (v: Value): boolean => v[0] === 0 && v[1] === 0;
const pretty = (text: string): string => text.replace(/-/g, "−");

/** The settings a notable example or favorite names, its digits besides 0; `Random` draws a new system. */
export function exampleSettings(id: string): RadixLayerSettings | undefined {
  if (id === "Random") return randomSettings();
  const e = exampleNamed(id);
  const s = e && parseSettings(e.code, { maxLength: e.maxLength || 8 });
  if (!e || !s) return undefined;
  return {
    system: s.system,
    base: s.base,
    digits: s.digits.filter((d) => !isZero(d)),
    places: e.maxLength || lengthLimit(s.digits.length),
  };
}

/** The example these settings are, by its settings sentence; `"Custom"` when none. */
export function exampleOf(s: RadixLayerSettings): string {
  const code = (x: RadixLayerSettings): string =>
    formatSettings({ ...full(x), maxLength: 1, colorBy: "aggregate", locked: true });
  const mine = code(s);
  if (s.onLattice === false) return "Custom";
  return EXAMPLES.find((e) => exampleSettings(e.id) && code(exampleSettings(e.id)!) === mine)?.id ?? "Custom";
}

/** Every example, for a variable's choices: its id and its menu label. */
export const EXAMPLE_CHOICES: readonly (readonly [id: string, label: string])[] = [
  ...EXAMPLES.map((e) => [e.id, e.label] as const),
  ["Random", "a random one"],
  ["Custom", "your own"],
];

const full = (s: RadixLayerSettings): RadixSettings => ({
  system: s.system,
  base: s.base,
  digits: [ZERO, ...s.digits.filter((d) => !isZero(d))],
  maxLength: Math.max(1, Math.min(s.places, lengthLimit(s.digits.length + 1))),
  colorBy: "aggregate",
  locked: true,
});

export interface RadixLayer {
  readonly title: string;
  readonly settings: RadixLayerSettings;
  readonly basis: readonly [Vec2, Vec2];
  readonly maxIndex: number;
  /** Off the lattice: each numeral's point in the plane, element (n, 0) the n-th. */
  points?(): readonly Vec2[];
  readonly grid: readonly [Vec2, Vec2];
  gridLabel(axis: 0 | 1, k: number): string;
  home(): { center: Vec2; extent: number };
  known(i: number, j: number): boolean;
  prepare(i: number, j: number): void;
  has(i: number, j: number, property: string): boolean | undefined;
  value(i: number, j: number, name: string): number | undefined;
  relatedTo(relation: string, selected: Vec2, i: number, j: number): boolean;
  summary(): readonly (readonly [string, string])[];
  describe(i: number, j: number): { title: string; rows: readonly (readonly [string, string])[] };
}

/** Every expansion of at most `places` digits, on the ring's lattice. */
export function radixExpansions(settings: RadixLayerSettings): RadixLayer {
  const s = full(settings);
  const data = expansions(s);
  const D = s.digits.length;
  const key = (a: number, b: number): string => `${a},${b}`;
  /** Lattice point → the least n landing there, and how many do. */
  const at = new Map<string, { n: number; count: number }>();
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let n = 0; n < data.count; n++) {
    const k = key(Math.round(data.ab[2 * n]!), Math.round(data.ab[2 * n + 1]!));
    const point = at.get(k);
    if (point === undefined) at.set(k, { n, count: 1 });
    else point.count++;
    const [x, y] = [data.xy[2 * n]!, data.xy[2 * n + 1]!];
    [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
  }
  const onLattice = settings.onLattice !== false;
  const points: Vec2[] = onLattice
    ? []
    : Array.from({ length: data.count }, (_, n) => [data.xy[2 * n]!, data.xy[2 * n + 1]!]);
  // On the lattice an element is a lattice point; off it, element (n, 0) is the n-th numeral.
  const nAt = (i: number, j: number): number | undefined =>
    onLattice ? at.get(key(i, j))?.n : j === 0 && i >= 0 && i < data.count ? i : undefined;
  const valueAt = (i: number, j: number): Value => {
    const n = onLattice ? undefined : nAt(i, j);
    return n === undefined ? [i, j] : [data.ab[2 * n]!, data.ab[2 * n + 1]!];
  };
  const digitsAt = (i: number, j: number): number[] | undefined => {
    const n = nAt(i, j);
    return n === undefined ? undefined : digitsOf(n, D);
  };
  const text = (v: Value): string => pretty(formatValue(s.system, v));

  return {
    title: `base ${text(s.base)}`,
    settings,
    basis: basisOf(s.system),
    maxIndex: 10_000_000,
    ...(onLattice ? {} : { points: () => points }),
    grid: [
      [1, 0],
      [0, 1],
    ],
    gridLabel: (axis, k) => pretty(axis === 0 ? String(k) : formatValue(s.system, [0, k])),
    home: () => ({
      center: [(x0 + x1) / 2, (y0 + y1) / 2],
      extent: Math.max((x1 - x0) / 2, (y1 - y0) / 2, 3) * 1.12,
    }),
    known: () => true,
    prepare: () => {},
    has(i, j, property) {
      const n = nAt(i, j);
      switch (property) {
        case "IsDigit":
          return n !== undefined && n < D;
        case "Overlaps":
          return onLattice && (at.get(key(i, j))?.count ?? 0) > 1;
        case "IsZero":
          return n === 0;
        case "Unknown":
          return false;
      }
      return undefined;
    },
    value(i, j, name) {
      const n = nAt(i, j);
      if (n === undefined) return name === "Norm" ? norm(s.system, valueAt(i, j)) : undefined;
      const ds = digitsOf(n, D);
      switch (name) {
        case "LeadingDigit":
          return ds.at(-1);
        case "LastDigit":
          return ds[0];
        case "Places":
          return n === 0 ? 0 : ds.length;
        case "Expansions":
          return onLattice ? at.get(key(i, j))!.count : 1;
        // n / |D|^L: the digits as a fraction, the leading one most significant, so a scheme
        // read at it nests the way the tiles do.
        case "Address":
          return n / D ** data.length;
        case "Norm":
          return norm(s.system, valueAt(i, j));
      }
      // `Digit(k)`: the k-th digit, k = 1 the units; 0 past the leading one.
      const place = /^Digit\((\d+)\)$/.exec(name);
      return place ? (ds[Number(place[1]) - 1] ?? 0) : undefined;
    },
    relatedTo(relation, [si, sj], i, j) {
      const [a, b] = [digitsAt(si, sj), digitsAt(i, j)];
      if (a === undefined || b === undefined) return false;
      switch (relation) {
        case "Congruent":
          return a[0] === b[0];
        case "SameLeadingDigit":
          return a.at(-1) === b.at(-1);
        case "SamePlaces":
          return a.length === b.length;
      }
      return false;
    },
    summary: () => [
      ["base", text(s.base)],
      ["digits", s.digits.map(text).join(", ")],
      ["expansions", data.count.toLocaleString()],
    ],
    describe(i, j) {
      const v = valueAt(i, j);
      const ds = digitsAt(i, j);
      const rows: [string, string][] = [["norm", pretty(String(norm(s.system, v)))]];
      if (ds === undefined) rows.push(["expansion", `none within ${data.length} places`]);
      else {
        rows.push([
          "digits",
          ds
            .toReversed()
            .map((d) => `(${text(s.digits[d]!)})`)
            .join(" "),
        ]);
        const count = onLattice ? at.get(key(i, j))!.count : 1;
        if (count > 1) rows.push(["expansions", String(count)]);
      }
      return { title: text(v), rows };
    },
  };
}
