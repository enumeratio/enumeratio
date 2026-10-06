// Numbers written in a complex base β with a digit set D: the values Σ dₖβᵏ, k < L, dₖ ∈ D.
//
// Two coordinate systems, after the lattices they live on: `i`, where a value a + bi is (a, b),
// and `ω`, the Eisenstein integers, where a + bω is (a, b) with ω = e^{2πi/3} (ω² = −1 − ω).
// Locked, β and the digits are lattice points and so is every expansion; unlocked, they are any
// complex numbers and the expansions scatter across the plane.
//
// With 0 among the digits and one digit per residue class mod β (a complete residue system,
// |D| = N(β)), the |D|^L expansions of length at most L are distinct points; that is what makes
// base −1 + i with digits {0, 1} draw the twindragon rather than a smudge.

export type System = "i" | "ω";

/** a + b·u, u = i or ω. */
export type Value = readonly [a: number, b: number];

export interface RadixSettings {
  readonly system: System;
  readonly base: Value;
  /** The digits, 0 first. */
  readonly digits: readonly Value[];
  /** Places at most: expansions of length 1..maxLength. */
  readonly maxLength: number;
  /** `aggregate`, `leading`, or `place-k` (k = 1 is the units digit). */
  readonly colorBy: string;
  /** Base and digits are lattice points. */
  readonly locked: boolean;
}

/**
 * Expansions enumerated at most: maxLength is cut until |D|^L fits. 20 000 tiles draw at once and
 * already resolve every notable tile's shape; more only slows dragging a handle.
 */
export const RADIX_LIMIT = 20_000;

export const mul = (system: System, [a, b]: Value, [c, d]: Value): Value =>
  system === "i" ? [a * c - b * d, a * d + b * c] : [a * c - b * d, a * d + b * c - b * d];

export const add = ([a, b]: Value, [c, d]: Value): Value => [a + c, b + d];

export const norm = (system: System, [a, b]: Value): number => (system === "i" ? a * a + b * b : a * a - a * b + b * b);

/** Plane coordinates: the complex number itself. */
export const plane = (system: System, [a, b]: Value): Value =>
  system === "i" ? [a, b] : [a - b / 2, (b * Math.sqrt(3)) / 2];

export const fromPlane = (system: System, [x, y]: Value): Value => {
  if (system === "i") return [x, y];
  const b = (2 * y) / Math.sqrt(3);
  return [x + b / 2, b];
};

export const SQRT3_2 = Math.sqrt(3) / 2;

/** The lattice basis 1, u in the plane. */
export const basisOf = (system: System): readonly [Value, Value] =>
  system === "i"
    ? [
        [1, 0],
        [0, 1],
      ]
    : [
        [1, 0],
        [-0.5, SQRT3_2],
      ];

const isZero = (v: Value): boolean => v[0] === 0 && v[1] === 0;

/** a + bu as the reference writes it: `-1+i`, `2ω`, `-ω`, `1.25-0.5i`. */
export function formatValue(system: System, [a, b]: Value): string {
  const num = (x: number) => String(Math.round(x * 1000) / 1000);
  const unit = system;
  if (b === 0) return num(a);
  const coefficient = b === 1 ? "" : b === -1 ? "-" : num(b);
  const imaginary = `${coefficient}${unit}`;
  if (a === 0) return imaginary;
  return `${num(a)}${b < 0 ? "" : "+"}${imaginary}`;
}

/** The reverse of `formatValue`, unit included; the system is the unit's, if any. */
export function parseValue(text: string): { value: Value; system?: System } | undefined {
  const t = text.replace(/\s+/g, "").replace(/−/g, "-");
  if (t === "") return undefined;
  // Signed terms, each a number, a unit, or a number times a unit: `-2`, `+3ω`, `-i`.
  const term = /([+-]?)(\d*\.?\d*)([iω]?)/y;
  let [a, b] = [0, 0];
  let unit: System | undefined;
  for (let at = 0; at < t.length;) {
    term.lastIndex = at;
    const m = term.exec(t);
    if (!m || m[0] === "" || (m[2] === "" && m[3] === "")) return undefined;
    at = term.lastIndex;
    const v = (m[1] === "-" ? -1 : 1) * (m[2] === "" ? 1 : Number(m[2]));
    if (!Number.isFinite(v)) return undefined;
    if (m[3]) {
      if (unit !== undefined && unit !== m[3]) return undefined;
      unit = m[3] as System;
      b += v;
    } else {
      a += v;
    }
  }
  return unit === undefined ? { value: [a, b] } : { value: [a, b], system: unit };
}

const ORDINALS = ["1st", "2nd", "3rd"];
export const ordinal = (k: number): string => ORDINALS[k - 1] ?? `${k}th`;

/**
 * The settings as a sentence, the reference's own code: `base -1+i with digits 0, and 1 color by
 * 1st`. Pasting it back gives the same settings.
 */
export function formatSettings(s: RadixSettings): string {
  const digits = s.digits.map((d) => formatValue(s.system, d));
  const list = digits.length > 1 ? `${digits.slice(0, -1).join(", ")}, and ${digits.at(-1)}` : digits.join("");
  const color =
    s.colorBy === "leading"
      ? " color by lead"
      : s.colorBy.startsWith("place-")
        ? ` color by ${ordinal(Number(s.colorBy.slice(6)))}`
        : "";
  return `base ${formatValue(s.system, s.base)} with digits ${list}${color}`;
}

/** A settings sentence back to settings; the system is ω when any number in it uses ω. */
export function parseSettings(code: string, defaults: Pick<RadixSettings, "maxLength">): RadixSettings | undefined {
  const text = code.replace(/−/g, "-").trim();
  const match = /^base\s+(\S+)\s+with\s+digits\s+(.+?)(?:\s+colou?r\s*by\s+(\S+))?\s*$/i.exec(text);
  if (!match) return undefined;
  const [, baseText, digitsText, colorText] = match;
  const base = parseValue(baseText!);
  const digits = digitsText!
    .split(/,\s*(?:and\s+)?|\s+and\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map(parseValue);
  if (!base || digits.some((d) => d === undefined)) return undefined;
  const parsed = [base, ...(digits as { value: Value; system?: System }[])];
  const system: System = parsed.some((p) => p.system === "ω") ? "ω" : "i";
  const values = (digits as { value: Value }[]).map((d) => d.value);
  const ordered = [[0, 0] as Value, ...values.filter((v) => !isZero(v))];
  const place = /^(\d+)/.exec(colorText ?? "");
  const colorBy = !colorText
    ? "aggregate"
    : /^lead/i.test(colorText)
      ? "leading"
      : place
        ? `place-${place[1]}`
        : "aggregate";
  const locked = parsed.every((p) => Number.isInteger(p.value[0]) && Number.isInteger(p.value[1]));
  return {
    system,
    base: base.value,
    digits: ordered,
    maxLength: Math.max(defaults.maxLength, colorBy.startsWith("place-") ? Number(colorBy.slice(6)) : 1),
    colorBy,
    locked,
  };
}

/** Whether a ≡ b (mod β) on the lattice: β divides a − b, i.e. (a − b)·β̄ ≡ 0 componentwise mod N(β). */
export function congruent(system: System, base: Value, x: Value, y: Value): boolean {
  const n = norm(system, base);
  const conjugate: Value = system === "i" ? [base[0], -base[1]] : [base[0] - base[1], -base[1]];
  const [p, q] = mul(system, [x[0] - y[0], x[1] - y[1]], conjugate);
  return Math.abs(p % n) < 1e-9 && Math.abs(q % n) < 1e-9;
}

/** One lattice point of least norm per residue class mod β, 0 first; ties to the real, then positive. */
export function leastResidues(system: System, base: Value): Value[] {
  const n = Math.round(norm(system, base));
  if (n < 1) return [[0, 0]];
  const reach = Math.ceil(Math.sqrt(n)) + 2;
  const candidates: Value[] = [];
  for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) candidates.push([a, b]);
  candidates.sort(
    (u, v) => norm(system, u) - norm(system, v) || Math.abs(u[1]) - Math.abs(v[1]) || v[0] - u[0] || v[1] - u[1],
  );
  const chosen: Value[] = [];
  for (const c of candidates) {
    if (chosen.length === n) break;
    if (!chosen.some((d) => congruent(system, base, c, d))) chosen.push(c);
  }
  return chosen;
}

/** Whether the digits are a complete residue system mod β: one per class, and as many as N(β). */
export function isCompleteResidueSystem(system: System, base: Value, digits: readonly Value[]): boolean {
  if (digits.some((d) => !Number.isInteger(d[0]) || !Number.isInteger(d[1]))) return false;
  if (digits.length !== Math.round(norm(system, base))) return false;
  return digits.every((d, i) => digits.every((e, j) => i === j || !congruent(system, base, d, e)));
}

/** The longest length whose |D|^L expansions stay within RADIX_LIMIT. */
export const lengthLimit = (digitCount: number): number =>
  Math.max(1, Math.floor(Math.log(RADIX_LIMIT) / Math.log(Math.max(2, digitCount))));

/** The digits of n in base |D|, least significant first; 0 is [0]. */
export function digitsOf(n: number, b: number): number[] {
  const out: number[] = [];
  for (let m = n; m > 0; m = Math.floor(m / b)) out.push(m % b);
  return out.length === 0 ? [0] : out;
}

export interface Expansions {
  /** Plane coordinates, 2 per expansion. */
  readonly xy: Float64Array;
  /** The value in system coordinates, 2 per expansion. */
  readonly ab: Float64Array;
  /** Expansion count: |D|^L. */
  readonly count: number;
  readonly length: number;
}

/** Every Σ dₖβᵏ, k < L, indexed by n = Σ index(dₖ)·|D|ᵏ. */
export function expansions(s: RadixSettings): Expansions {
  const b = s.digits.length;
  const length = Math.min(s.maxLength, lengthLimit(b));
  const powers: Value[] = [[1, 0]];
  for (let k = 1; k < length; k++) powers.push(mul(s.system, powers[k - 1]!, s.base));
  // digitTerms[k][d] = d·βᵏ
  const terms = powers.map((p) => s.digits.map((d) => mul(s.system, d, p)));
  const count = b ** length;
  const ab = new Float64Array(2 * count);
  const xy = new Float64Array(2 * count);
  for (let n = 0; n < count; n++) {
    let [x, y] = [0, 0];
    for (let m = n, k = 0; m > 0; m = Math.floor(m / b), k++) {
      const [dx, dy] = terms[k]![m % b]!;
      x += dx;
      y += dy;
    }
    ab[2 * n] = x;
    ab[2 * n + 1] = y;
    const [px, py] = plane(s.system, [x, y]);
    xy[2 * n] = px;
    xy[2 * n + 1] = py;
  }
  return { xy, ab, count, length };
}
