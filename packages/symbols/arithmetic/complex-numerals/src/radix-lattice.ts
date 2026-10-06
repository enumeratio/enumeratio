// Radix expansions as a layer for `<notatio-lattice-plot layer="radix">`. It has the shape of
// @enumeratio/frontend's `LatticeLayer` without importing it — a library does not import the
// presentation layer.

import { EXAMPLES, exampleNamed, FAVORITES, NOTABLE } from "./examples.ts";
import {
  basisOf,
  congruent,
  digitsOf,
  expansions,
  type Expansions,
  formatSettings,
  formatValue,
  fromPlane,
  isCompleteResidueSystem,
  leastResidues,
  lengthLimit,
  mul,
  norm,
  ordinal,
  parseSettings,
  parseValue,
  type RadixSettings,
  type System,
  type Value,
} from "./radix.ts";

type Vec2 = readonly [number, number];

export interface RadixLatticeOptions {
  /** A notable example or favorite by id; the starting point the other options adjust. */
  readonly example?: string;
  /** A settings sentence, as `formatSettings` writes it. */
  readonly code?: string;
  readonly system?: System;
  readonly base?: string;
  /** Digits, comma-separated: `0, 1, i, -1+i`. Default: the least residues mod β. */
  readonly digits?: string;
  readonly maxLength?: number;
  readonly colorBy?: string;
  readonly locked?: boolean;
}

/** Base norms the random button draws from: big enough to be interesting, small enough to see. */
const RANDOM_NORMS = [2, 12] as const;
const DEFAULT_CODE = NOTABLE[0]!.code;

const pretty = (text: string): string => text.replace(/-/g, "−");

/** sRGB hex blend, weights summing to 1. */
function blend(colors: readonly string[], weights: readonly number[]): string {
  let [r, g, b] = [0, 0, 0];
  colors.forEach((hex, k) => {
    const n = Number.parseInt(hex.slice(1), 16);
    const w = weights[k]!;
    r += ((n >> 16) & 255) * w;
    g += ((n >> 8) & 255) * w;
    b += (n & 255) * w;
  });
  const byte = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/** How much of the aggregate color the leading digit sets; each lower digit tints by what's left. */
const LEADING_WEIGHT = 0.8;

export function radixLattice(options: RadixLatticeOptions = {}) {
  const example = exampleNamed(options.example);
  const seed = parseSettings(options.code ?? example?.code ?? DEFAULT_CODE, {
    maxLength: options.maxLength ?? example?.maxLength ?? 8,
  })!;
  let settings: RadixSettings = {
    ...seed,
    ...(options.system ? { system: options.system } : {}),
    ...(options.colorBy ? { colorBy: options.colorBy } : {}),
    ...(options.maxLength ? { maxLength: options.maxLength } : {}),
    ...(options.locked === false ? { locked: false } : {}),
  };
  const base = options.base ? parseValue(options.base) : undefined;
  if (base) settings = { ...settings, base: base.value, ...(base.system ? { system: base.system } : {}) };
  if (options.digits) {
    const digits = options.digits.split(",").map((t) => parseValue(t)?.value);
    if (digits.every((d) => d !== undefined)) settings = { ...settings, digits: withZero(digits as Value[]) };
  } else if (base) {
    settings = { ...settings, digits: leastResidues(settings.system, settings.base) };
  }
  let exampleId = example && !options.base && !options.digits && !options.code ? example.id : matchExample(settings);

  let data: Expansions = expansions(settings);
  let points: Vec2[] = [];
  /** Locked: lattice point → least n landing there, and how many do. */
  const at = new Map<string, { n: number; count: number }>();
  const key = (a: number, b: number): string => `${a},${b}`;

  function withZero(digits: readonly Value[]): Value[] {
    return [[0, 0], ...digits.filter((d) => d[0] !== 0 || d[1] !== 0)];
  }

  function matchExample(s: RadixSettings): string {
    const code = formatSettings({ ...s, colorBy: "aggregate" });
    return (
      EXAMPLES.find(
        (e) => formatSettings({ ...parseSettings(e.code, { maxLength: 1 })!, colorBy: "aggregate" }) === code,
      )?.id ?? "custom"
    );
  }

  const rebuild = (): void => {
    data = expansions(settings);
    points = Array.from({ length: data.count }, (_, n) => [data.xy[2 * n]!, data.xy[2 * n + 1]!] as Vec2);
    at.clear();
    if (!settings.locked) return;
    for (let n = 0; n < data.count; n++) {
      const k = key(Math.round(data.ab[2 * n]!), Math.round(data.ab[2 * n + 1]!));
      const point = at.get(k);
      if (point === undefined) at.set(k, { n, count: 1 });
      else point.count++;
    }
  };
  rebuild();

  const update = (next: Partial<RadixSettings>): void => {
    settings = { ...settings, ...next };
    settings = { ...settings, maxLength: Math.min(settings.maxLength, lengthLimit(settings.digits.length)) };
    exampleId = matchExample(settings);
    rebuild();
    colorings = makeColorings();
  };

  /** The expansion index at (i, j): a lattice point when locked, the point's own index when not. */
  const nAt = (i: number, j: number): number | undefined => (settings.locked ? at.get(key(i, j))?.n : i);
  const digitsAt = (i: number, j: number): number[] | undefined => {
    const n = nAt(i, j);
    return n === undefined ? undefined : digitsOf(n, settings.digits.length);
  };
  const valueAt = (i: number, j: number): Value => (settings.locked ? [i, j] : [data.ab[2 * i]!, data.ab[2 * i + 1]!]);
  const text = (v: Value): string => pretty(formatValue(settings.system, v));

  const digitCategories = (paint: "discrete" | "own") =>
    settings.digits.map((d, k) => ({ code: k, label: text(d), paint, style: "outline" as const }));

  const makeColorings = () => {
    const length = data.length;
    const places = Array.from({ length }, (_, k) => ({
      id: `place-${k + 1}`,
      label: `${ordinal(k + 1)} digit`,
      categories: digitCategories("discrete"),
      code: (i: number, j: number) => digitsAt(i, j)?.[k] ?? (nAt(i, j) === undefined ? undefined : 0),
    }));
    return [
      {
        id: "aggregate",
        label: "all digits",
        categories: digitCategories("own"),
        code: (i: number, j: number) => digitsAt(i, j)?.at(-1),
        // The leading digit's color, tinted by each lower digit in turn: c = 0.8·lead + 0.2·c(rest).
        color(i: number, j: number, colors: readonly string[]) {
          const ds = digitsAt(i, j)!.toReversed();
          const weights = ds.map((_, k) =>
            k === ds.length - 1 ? (1 - LEADING_WEIGHT) ** k : LEADING_WEIGHT * (1 - LEADING_WEIGHT) ** k,
          );
          return blend(
            ds.map((d) => colors[d]!),
            weights,
          );
        },
      },
      {
        id: "leading",
        label: "leading digit",
        categories: digitCategories("discrete"),
        code: (i: number, j: number) => digitsAt(i, j)?.at(-1),
      },
      ...places,
    ];
  };
  let colorings = makeColorings();

  const exampleOptions = [
    ...NOTABLE.map((e) => ({ id: e.id, label: e.label })),
    ...FAVORITES.map((e) => ({ id: e.id, label: e.label })),
    { id: "custom", label: "your own" },
  ];

  const randomize = (): void => {
    const system: System = Math.random() < 0.5 ? "i" : "ω";
    let base: Value = [2, 1];
    for (let tries = 0; tries < 200; tries++) {
      const candidate: Value = [Math.round((Math.random() * 2 - 1) * 4), Math.round((Math.random() * 2 - 1) * 4)];
      const n = norm(system, candidate);
      if (n >= RANDOM_NORMS[0] && n <= RANDOM_NORMS[1]) {
        base = candidate;
        break;
      }
    }
    // One random small representative per residue class: varied tiles, still a complete system.
    const residues = leastResidues(system, base);
    const digits = residues.map((d, k) => {
      if (k === 0) return d;
      const units: Value[] = [
        [0, 0],
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ];
      const shifts = units.map((u) => mul(system, base, u));
      const s = shifts[Math.floor(Math.random() * shifts.length)]!;
      return [d[0] + s[0], d[1] + s[1]] as Value;
    });
    const colorBy = ["aggregate", "leading", "place-1", "place-2"][Math.floor(Math.random() * 4)]!;
    update({ system, base, digits, colorBy, locked: true, maxLength: lengthLimit(digits.length) });
  };

  const addDigit = (): void => {
    const taken = (v: Value) =>
      settings.digits.some((d) => Math.abs(d[0] - v[0]) < 1e-9 && Math.abs(d[1] - v[1]) < 1e-9);
    // The least-norm lattice point not yet a digit, preferring a residue class not yet covered.
    const reach = 6;
    const candidates: Value[] = [];
    for (let a = -reach; a <= reach; a++)
      for (let b = -reach; b <= reach; b++) if (!taken([a, b])) candidates.push([a, b]);
    candidates.sort((u, v) => norm(settings.system, u) - norm(settings.system, v));
    const fresh = candidates.find((c) => !settings.digits.some((d) => congruent(settings.system, settings.base, c, d)));
    update({ digits: [...settings.digits, fresh ?? candidates[0]!] });
  };

  const lattice = {
    get kind() {
      return settings.locked ? ("lattice" as const) : ("points" as const);
    },
    get title() {
      return `base ${text(settings.base)}`;
    },
    get basis() {
      return basisOf(settings.system);
    },
    maxIndex: 10_000_000,
    legendPlacement: "right",
    get colorings() {
      return colorings;
    },
    points: () => points,
    known: () => true,
    emphasized: (i: number, j: number) => {
      const n = nAt(i, j);
      return n !== undefined && n < settings.digits.length;
    },
    label(i: number, j: number) {
      const n = nAt(i, j);
      return n !== undefined && n < settings.digits.length ? text(settings.digits[n]!) : undefined;
    },
    get grid(): readonly [Vec2, Vec2] {
      return [
        [1, 0],
        [0, 1],
      ];
    },
    gridLabel: (axis: 0 | 1, k: number) => pretty(axis === 0 ? String(k) : formatValue(settings.system, [0, k])),
    highlightModes: [{ id: "congruent", label: "same last digit" }],
    related(mode: string, selected: Vec2, i: number, j: number) {
      if (mode !== "congruent") return false;
      const [a, b] = [nAt(selected[0], selected[1]), nAt(i, j)];
      return a !== undefined && b !== undefined && a % settings.digits.length === b % settings.digits.length;
    },
    describe(i: number, j: number) {
      const v = valueAt(i, j);
      const ds = digitsAt(i, j);
      const rows: [string, string][] = [["norm", pretty(String(Math.round(norm(settings.system, v) * 1000) / 1000))]];
      if (ds === undefined) rows.push(["expansion", `none within ${data.length} places`]);
      else {
        rows.push([
          "digits",
          ds
            .toReversed()
            .map((d) => `(${text(settings.digits[d]!)})`)
            .join(" "),
        ]);
        rows.push(["places", String(ds.length)]);
        const count = settings.locked ? at.get(key(i, j))?.count : 1;
        if (count !== undefined && count > 1) rows.push(["expansions", String(count)]);
      }
      return { title: text(v), rows };
    },
    home() {
      let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
      for (const [x, y] of points)
        [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
      return {
        center: [(x0 + x1) / 2, (y0 + y1) / 2] as Vec2,
        extent: Math.max((x1 - x0) / 2, (y1 - y0) / 2, 3) * 1.12,
      };
    },
    handles() {
      const place = (v: Value): Vec2 => (settings.locked ? v : planeOf(v));
      return [
        { id: "base", at: place(settings.base), label: `β = ${text(settings.base)}` },
        ...settings.digits.slice(1).map((d, k) => ({ id: `digit-${k + 1}`, at: place(d), label: "" })),
      ];
    },
    moveHandle(id: string, to: Vec2): boolean {
      const value: Value = settings.locked ? to : fromPlane(settings.system, to);
      const clash = (v: Value) => Math.abs(v[0] - value[0]) < 1e-9 && Math.abs(v[1] - value[1]) < 1e-9;
      if (id === "base") {
        if (norm(settings.system, value) < 1.5 || clash(settings.base)) return false;
        update({ base: value });
        return true;
      }
      const k = Number(id.slice("digit-".length));
      if (clash([0, 0]) || settings.digits.some(clash)) return false;
      update({ digits: settings.digits.map((d, i) => (i === k ? value : d)) });
      return true;
    },
    controls() {
      return [
        {
          id: "system",
          label: "lattice",
          kind: "select" as const,
          value: settings.system,
          options: [
            { id: "i", label: "ℤ[i], squares" },
            { id: "ω", label: "ℤ[ω], hexagons" },
          ],
        },
        {
          id: "locked",
          label: "on the lattice",
          kind: "toggle" as const,
          value: String(settings.locked),
          title: "Snap the base and digits to lattice points",
        },
        {
          id: "length",
          label: "places",
          kind: "number" as const,
          value: String(data.length),
          min: 1,
          max: lengthLimit(settings.digits.length),
        },
        { id: "add", label: "+ digit", kind: "button" as const, title: "Add a digit" },
        { id: "remove", label: "− digit", kind: "button" as const, title: "Remove the last digit" },
        { id: "random", label: "random", kind: "button" as const, title: "A random base, one digit per residue class" },
        {
          id: "code",
          label: "settings",
          kind: "text" as const,
          value: formatSettings({ ...settings, maxLength: data.length }),
          title: "Copy these settings, or paste others",
        },
      ];
    },
    setControl(id: string, value: string): boolean {
      if (id === "system" && (value === "i" || value === "ω")) {
        update({ system: value, digits: settings.locked ? leastResidues(value, settings.base) : settings.digits });
      } else if (id === "locked") {
        const locked = value === "true";
        const round = (v: Value): Value => [Math.round(v[0]), Math.round(v[1])];
        if (locked) {
          const digits = withZero(settings.digits.map(round)).filter(
            (d, k, all) => all.findIndex((e) => e[0] === d[0] && e[1] === d[1]) === k,
          );
          update({ locked, base: round(settings.base), digits });
        } else update({ locked });
      } else if (id === "length") {
        const n = Math.round(Number(value));
        if (!Number.isFinite(n) || n < 1) return false;
        update({ maxLength: n });
      } else if (id === "add") addDigit();
      else if (id === "remove") {
        if (settings.digits.length <= 2) return false;
        update({ digits: settings.digits.slice(0, -1) });
      } else if (id === "random") randomize();
      else if (id === "code") {
        const parsed = parseSettings(value, { maxLength: settings.maxLength });
        if (!parsed) return false;
        update(parsed);
      } else if (id === "example") {
        const e = exampleNamed(value);
        if (!e) return false;
        const parsed = parseSettings(e.code, { maxLength: e.maxLength || lengthLimit(1) })!;
        update({ ...parsed, maxLength: e.maxLength || lengthLimit(parsed.digits.length) });
      } else return false;
      return true;
    },
    caption() {
      const complete = isCompleteResidueSystem(settings.system, settings.base, settings.digits);
      const example = exampleNamed(exampleId);
      const digits = settings.digits.map(text).join(", ");
      return [
        "Base ",
        { strong: text(settings.base) },
        `, digits ${digits}: the ${data.count.toLocaleString()} expansions of at most ${data.length} places`,
        complete
          ? ", every one a different point. "
          : settings.locked
            ? ", some landing on the same point: the digits are not one per residue class mod β. "
            : ". ",
        { choice: "example", value: exampleId, options: exampleOptions },
        example?.note ? `. ${example.note}` : "",
        example?.source ? ` (${example.source})` : "",
      ];
    },
    summary(): [string, string][] {
      return [];
    },
    get settings() {
      return settings;
    },
  };

  function planeOf(v: Value): Vec2 {
    const [a, b] = v;
    return settings.system === "i" ? [a, b] : [a - b / 2, (b * Math.sqrt(3)) / 2];
  }

  return lattice;
}

export type RadixLattice = ReturnType<typeof radixLattice>;
