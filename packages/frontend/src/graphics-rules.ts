// How a layer styles its elements, without the DOM: Wolfram's `ColorRules` for faces and
// `BoundaryStyle` for edges, each a list of `test -> style`, read from MathJSON.
//
// A test names properties a layer publishes for an element (`IsPrime`, `Inert`) or the view adds
// (`Selected`, `Associates(Selected)`), combined with `And`, `Or` and `Not`. It gives a weight in
// [0, 1] (a boolean is the crisp case) that scales its style's opacity. How the face colors of
// matching rules combine is `ColorMixing`: Wolfram's first match by default, or every match,
// painted in order (`"Normal"`) or mixed in any order (`"Screen"`, `"Add"`, `"Multiply"`), where
// an element no rule matches contributes nothing: unknown is the identity. Edges always nest in
// rule order.

import type { Vec2 } from "./lattice.ts";
import type { BandMode, Gradient } from "./palettes.ts";
import { bandPosition, gradientNamed, hexToRgb, reverseGradient, rgbToHex, sampleGradient } from "./palettes.ts";

/** Where a frame looks: its center, half-height, and the y-scale `AspectRatio -> Automatic` binds. */
export interface FrameView {
  readonly center: Vec2;
  readonly extent: number;
  /** Plane y per unit of the frame's y: 1 for uniform tiles, a field's own ratio for true scale. */
  readonly yScale: number;
}

/** MathJSON, loosely: rules are read from it without the engine's types. */
type Json = unknown;

const headOf = (json: Json): string | undefined =>
  Array.isArray(json) && typeof json[0] === "string" ? json[0] : undefined;
const argsOf = (json: Json): Json[] => (Array.isArray(json) ? json.slice(1) : []);

// ── Tests ────────────────────────────────────────────────────────────────────────────────

/** What a test asks of an element: a property, or a relation to the selection. */
export interface ElementFacts {
  /** A property the layer publishes: `IsPrime`. */
  has(property: string): boolean;
  /** A relation to the selected elements: `Associates`, `Divides`, `Multiples`. */
  related(relation: string): boolean;
  readonly selected: boolean;
}

/** A test's weight for an element, in [0, 1]. */
export type Test = (facts: ElementFacts) => number;

const crisp = (b: boolean): number => (b ? 1 : 0);

/**
 * A test from MathJSON: a property symbol, `Selected`, a relation to it (`Associates(Selected)`),
 * `True`, or `And` (the product of weights), `Or` (the largest) and `Not` (one less the weight)
 * of those. Undefined for anything else, so a layer reports the rule it can't read rather than
 * guessing.
 */
export function testOf(json: Json): Test | undefined {
  if (json === "True") return () => 1;
  if (json === "Selected") return (f) => crisp(f.selected);
  if (typeof json === "string") return (f) => crisp(f.has(json));
  const head = headOf(json);
  const parts = argsOf(json).map(testOf);
  if (parts.some((p) => p === undefined)) return undefined;
  const ts = parts as Test[];
  if (head === "And") return (f) => ts.reduce((w, t) => (w === 0 ? 0 : w * t(f)), 1);
  if (head === "Or") return (f) => ts.reduce((w, t) => (w === 1 ? 1 : Math.max(w, t(f))), 0);
  if (head === "Not" && ts.length === 1) return (f) => 1 - ts[0]!(f);
  const [arg] = argsOf(json);
  if (head !== undefined && arg === "Selected" && argsOf(json).length === 1) return (f) => crisp(f.related(head));
  return undefined;
}

/** The property names a test reads, so a layer computes only what is asked. */
export function propertiesOf(json: Json, out = new Set<string>()): Set<string> {
  if (typeof json === "string" && json !== "True" && json !== "Selected") out.add(json);
  const head = headOf(json);
  if (head === "And" || head === "Or" || head === "Not") for (const a of argsOf(json)) propertiesOf(a, out);
  return out;
}

/** A test as a reader would say it: `IsIrreducible and not IsPrime`. */
export function testText(json: Json): string {
  if (typeof json === "string") return json;
  const head = headOf(json);
  const args = argsOf(json);
  if (head === "Not") return `not ${testText(args[0])}`;
  if (head === "And") return args.map(testText).join(" and ");
  if (head === "Or") return args.map(testText).join(" or ");
  if (head !== undefined) return `${head}(${args.map(testText).join(", ")})`;
  return String(json);
}

// ── Reading values ───────────────────────────────────────────────────────────────────────

/** `Name -> value` (or the named argument `Name: value`) when `name` is declared: its name. */
export function ruleNameOf(json: Json): string | undefined {
  const h = headOf(json);
  const key = argsOf(json)[0];
  const name = typeof key === "string" ? key.replace(/^'(.*)'$/, "$1") : undefined;
  const isRule = h === "KeyValuePair" || h === "Tuple" || h === "Rule" || h === "NamedArgument";
  return isRule && argsOf(json).length === 2 ? name : undefined;
}

/**
 * An application's arguments split into positional ones and options. An argument `Name -> v` is
 * an option exactly when `Name` is one the head declares; any other rule is positional, so
 * `IsPrime -> Teal` stays a rule.
 */
export function splitOptions(
  json: Json,
  declared: ReadonlySet<string>,
): { positional: Json[]; options: Map<string, Json> } {
  const positional: Json[] = [];
  const options = new Map<string, Json>();
  for (const a of argsOf(json)) {
    const name = ruleNameOf(a);
    if (name !== undefined && declared.has(name)) {
      if (!options.has(name)) options.set(name, argsOf(a)[1]);
    } else positional.push(a);
  }
  return { positional, options };
}

/** MathJSON in plain array form: `{fn}`, `{sym}`, `{num}` and `{str}` objects, metadata dropped. */
export function plainJson(json: Json): Json {
  if (Array.isArray(json)) return json.map(plainJson);
  if (json !== null && typeof json === "object") {
    const o = json as { fn?: Json[]; sym?: string; num?: string; str?: string };
    if (Array.isArray(o.fn)) return o.fn.map(plainJson);
    if (typeof o.sym === "string") return o.sym;
    if (typeof o.str === "string") return `'${o.str}'`;
    if (typeof o.num === "string") {
      const n = Number(o.num);
      return Number.isFinite(n) ? n : json;
    }
  }
  return json;
}

const numberOf = (json: Json, fallback: number): number => {
  if (headOf(json) === "Negate") return -numberOf(argsOf(json)[0], -fallback);
  const n = typeof json === "number" ? json : typeof json === "string" ? Number(json) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
};
const stringOf = (json: Json): string | undefined =>
  typeof json === "string" ? json.replace(/^'(.*)'$/, "$1") : (json as { str?: string } | undefined)?.str;

/** A list's entries, or the one value when it isn't a list. */
const entriesOf = (json: Json): Json[] => (headOf(json) === "List" ? argsOf(json) : json === undefined ? [] : [json]);

// ── Colors ───────────────────────────────────────────────────────────────────────────────

/** Named colors a rule may use, hand-picked to read on the dark grounds. */
export const NAMED_COLORS: Readonly<Record<string, string>> = {
  White: "#ffffff",
  Black: "#000000",
  Gray: "#8a8a99",
  Red: "#ff5a5f",
  Orange: "#ff9f43",
  Gold: "#ffd166",
  Yellow: "#ffe66d",
  Green: "#5dd39e",
  Teal: "#3ddbd9",
  Cyan: "#4cc9f0",
  Blue: "#4f8cff",
  Purple: "#a78bfa",
  Magenta: "#f15bb5",
  Pink: "#ff8fab",
};

/** A color from `Red`, `"#ff8800"`, `RGBColor(r, g, b)` or `GrayLevel(g)`, each in [0, 1]. */
export function colorOf(json: Json): string | undefined {
  const s = stringOf(json);
  if (s !== undefined) return NAMED_COLORS[s] ?? (/^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : undefined);
  const args = argsOf(json).map((v) => numberOf(v, Number.NaN));
  if (headOf(json) === "RGBColor" && args.slice(0, 3).every(Number.isFinite))
    return rgbToHex([args[0]!, args[1]!, args[2]!]);
  if (headOf(json) === "GrayLevel" && Number.isFinite(args[0])) return rgbToHex([args[0]!, args[0]!, args[0]!]);
  return undefined;
}

/** Wolfram's names for what a gradient does past its two ends (`LinearGradientFilling`'s padding). */
export const PADDINGS: Readonly<Record<string, BandMode>> = { Reflected: "reflect", Periodic: "wrap", Fixed: "clamp" };
export const paddingName = (mode: BandMode): string => Object.keys(PADDINGS).find((k) => PADDINGS[k] === mode)!;

/** A color scheme read at a value the layer computes per element, its range stated. */
export interface SchemeColor {
  readonly gradient: Gradient;
  /** The value, over the layer's published values: `Sqrt(Abs(Norm))`. */
  readonly value: Json;
  /** Where the range starts: the value the scheme's first color is at. */
  readonly offset: number;
  /** The range's width: one pass of the scheme. */
  readonly band: number;
  readonly mode: BandMode;
}

export type Paint = string | SchemeColor;

/**
 * `ColorData(spec)(value)`, Wolfram's color function applied to a value the layer computes:
 * `spec` is a scheme's name (`"Dusk"`), or a list of it with a range (`["Dusk", [0, 10]]`, the
 * scheme stretched over it), `"Reverse"`, and (ours) Wolfram's padding past the range's ends,
 * `"Reflected"`, `"Periodic"` or `"Fixed"`. Without one it clamps, as Wolfram's does, and a cyclic
 * scheme wraps.
 */
export function schemeOf(json: Json): SchemeColor | undefined {
  if (headOf(json) !== "Apply") return undefined;
  const [fn, value] = argsOf(json);
  if (headOf(fn) !== "ColorData" || value === undefined) return undefined;
  const [spec] = argsOf(fn);
  const parts = headOf(spec) === "List" ? argsOf(spec) : [spec];
  let gradient = gradientNamed(stringOf(parts[0]));
  let [offset, band] = [0, 1];
  let mode: BandMode | undefined;
  for (const part of parts.slice(1)) {
    const word = stringOf(part);
    if (word === "Reverse") gradient = reverseGradient(gradient);
    else if (word !== undefined && word in PADDINGS) mode = PADDINGS[word];
    else if (headOf(part) === "List") {
      const [lo, hi] = argsOf(part).map((v) => numberOf(v, Number.NaN));
      if (Number.isFinite(lo) && Number.isFinite(hi) && hi! > lo!) [offset, band] = [lo!, hi! - lo!];
    } else return undefined;
  }
  return { gradient, value, offset, band, mode: mode ?? (gradient.cyclic ? "wrap" : "clamp") };
}

/** A paint and its opacity from a color, a scheme, or `Opacity(a, either)`. */
export function paintOf(json: Json): { paint: Paint; opacity: number } | undefined {
  if (headOf(json) === "Opacity") {
    const [a, inner] = argsOf(json);
    const p = inner === undefined ? undefined : paintOf(inner);
    return p && { paint: p.paint, opacity: p.opacity * numberOf(a, 1) };
  }
  const scheme = schemeOf(json);
  if (scheme) return { paint: scheme, opacity: 1 };
  const color = colorOf(json);
  return color === undefined ? undefined : { paint: color, opacity: 1 };
}

// ── Rules ────────────────────────────────────────────────────────────────────────────────

interface RuleBase {
  /** The test as written. */
  readonly when: Json;
  readonly test: Test;
  /** What the legend calls it. */
  readonly label: string;
}

export interface ColorRule extends RuleBase {
  readonly paint: Paint;
  readonly opacity: number;
}

export interface Edge {
  readonly color: string;
  /** CSS pixels. */
  readonly width: number;
  readonly opacity: number;
  /** Dash and gap lengths in CSS pixels; empty for a solid edge. */
  readonly dashing: readonly number[];
}

export interface BoundaryRule extends RuleBase, Edge {}

const testAndStyle = (json: Json): [Json, Json, Test] | undefined => {
  const head = headOf(json);
  if (head !== "Rule" && head !== "KeyValuePair" && head !== "Tuple") return undefined;
  const [when, style] = argsOf(json);
  const test = testOf(when);
  return test && [when, style, test];
};

/** `test -> color`, the color a color, a scheme or `Opacity(a, either)`. */
export function colorRuleOf(json: Json): ColorRule | undefined {
  const parts = testAndStyle(json);
  const p = parts && paintOf(parts[1]);
  return parts && p && { when: parts[0], test: parts[2], label: testText(parts[0]), ...p };
}

/** Edge widths Wolfram names. */
const THICKNESSES: Readonly<Record<string, number>> = { Thin: 1, Thick: 2.5 };
const DASHINGS: Readonly<Record<string, readonly number[]>> = {
  Dashed: [6, 4],
  Dotted: [1.5, 3],
  DotDashed: [1.5, 3, 6, 3],
};

/**
 * An edge from a color or a `Directive` (`EdgeForm` around one is the same thing) of a color,
 * `AbsoluteThickness(px)`, `Thin`/`Thick`, `Opacity(a)`, and `AbsoluteDashing({dash, gap})` or
 * `Dashed`/`Dotted`/`DotDashed`.
 */
export function edgeOf(json: Json): Edge | undefined {
  const parts = headOf(json) === "EdgeForm" ? argsOf(json) : headOf(json) === "Directive" ? argsOf(json) : [json];
  let color: string | undefined;
  let width = 1.5;
  let opacity = 1;
  let dashing: readonly number[] = [];
  for (const p of parts.flatMap((q) => (headOf(q) === "Directive" ? argsOf(q) : [q]))) {
    const h = headOf(p);
    const sym = typeof p === "string" ? p : undefined;
    if (h === "AbsoluteThickness") width = numberOf(argsOf(p)[0], width);
    else if (sym !== undefined && sym in THICKNESSES) width = THICKNESSES[sym]!;
    else if (h === "AbsoluteDashing") dashing = entriesOf(argsOf(p)[0]).map((v) => numberOf(v, 0));
    else if (sym !== undefined && sym in DASHINGS) dashing = DASHINGS[sym]!;
    else if (h === "Opacity" && argsOf(p).length === 1) opacity = numberOf(argsOf(p)[0], 1);
    else {
      const painted = paintOf(p);
      if (!painted || typeof painted.paint !== "string") return undefined;
      color = painted.paint;
      opacity *= painted.opacity;
    }
  }
  return color === undefined ? undefined : { color, width, opacity, dashing };
}

/** `test -> edge`. */
export function boundaryRuleOf(json: Json): BoundaryRule | undefined {
  const parts = testAndStyle(json);
  const e = parts && edgeOf(parts[1]);
  return parts && e && { when: parts[0], test: parts[2], label: testText(parts[0]), ...e };
}

/** Every rule of a `ColorRules` or `BoundaryStyle` value that reads; `unread` counts the rest. */
export function rulesOf<R>(json: Json, read: (rule: Json) => R | undefined): { rules: R[]; unread: number } {
  const rules: R[] = [];
  let unread = 0;
  for (const entry of entriesOf(json)) {
    const r = read(entry);
    if (r) rules.push(r);
    else unread++;
  }
  return { rules, unread };
}

// ── Values ───────────────────────────────────────────────────────────────────────────────

type ValueReader = (base: (name: string) => number | undefined) => number | undefined;

const UNARY: Readonly<Record<string, (x: number) => number>> = {
  Sqrt: Math.sqrt,
  Abs: Math.abs,
  Log: Math.log,
  Exp: Math.exp,
  Negate: (x) => -x,
  Floor: Math.floor,
};

const FOLDS: Readonly<Record<string, (xs: number[]) => number>> = {
  Add: (xs) => xs.reduce((a, b) => a + b, 0),
  Multiply: (xs) => xs.reduce((a, b) => a * b, 1),
  Subtract: ([a, b]) => a! - (b ?? 0),
  Divide: ([a, b]) => a! / b!,
  Power: ([a, b]) => a! ** b!,
};

/**
 * A value expression a scheme reads, over the values a layer publishes per element (`Norm`,
 * `X`, `Y`): numbers, those names, `Add`, `Multiply`, `Subtract`, `Divide`, `Power`, and a few
 * unary functions. Undefined for anything else.
 */
export function valueOf(json: Json): ValueReader | undefined {
  if (typeof json === "number") return () => json;
  if (typeof json === "string") return (base) => base(json);
  const head = headOf(json);
  const parts = argsOf(json).map(valueOf);
  if (head === undefined || parts.some((p) => p === undefined)) return undefined;
  const ps = parts as ValueReader[];
  const unary = UNARY[head];
  if (unary && ps.length === 1)
    return (base) => {
      const x = ps[0]!(base);
      return x === undefined ? undefined : unary(x);
    };
  const fold = FOLDS[head];
  if (!fold) return undefined;
  return (base) => {
    const xs = ps.map((p) => p(base));
    return xs.some((x) => x === undefined) ? undefined : fold(xs as number[]);
  };
}

// ── Mixing ───────────────────────────────────────────────────────────────────────────────

/** `ColorMixing`'s settings; `"First"` is Wolfram's `Automatic`. */
export type ColorMixing = "First" | "Normal" | "Screen" | "Add" | "Multiply";

export const COLOR_MIXINGS: readonly ColorMixing[] = ["First", "Normal", "Screen", "Add", "Multiply"];

export function colorMixingOf(json: Json): ColorMixing {
  const s = stringOf(json);
  return s !== undefined && (COLOR_MIXINGS as readonly string[]).includes(s) && s !== "First"
    ? (s as ColorMixing)
    : "First";
}

/**
 * The CSS `mix-blend-mode` a layer's canvas takes so its mixed colors combine with what is
 * under it the same way they combined with each other.
 */
export const CANVAS_BLEND: Readonly<Record<ColorMixing, string>> = {
  First: "normal",
  Normal: "normal",
  Screen: "screen",
  Add: "plus-lighter",
  Multiply: "multiply",
};

/** The color a scheme gives a value. */
export const schemeColor = (paint: SchemeColor, value: number, phase = 0): string =>
  sampleGradient(paint.gradient, bandPosition(value - paint.offset + phase * paint.band, paint.band, paint.mode));

type Layer = readonly [color: string, alpha: number];

const css = ([r, g, b]: readonly number[], a: number): string =>
  a >= 1
    ? rgbToHex([r!, g!, b!])
    : `rgba(${Math.round(r! * 255)}, ${Math.round(g! * 255)}, ${Math.round(b! * 255)}, ${+a.toFixed(3)})`;

/**
 * Mix colors, each at an alpha, into one CSS color; undefined when nothing contributes.
 * - `First`: the first.
 * - `Normal`: each painted over the last ("over" compositing), so order matters.
 * - `Screen`: 1 − ∏(1 − αc); `Add`: Σ αc, capped; `Multiply`: ∏(1 − α(1 − c)). Each is
 *   commutative, with the identity (black, black, white) for an element nothing matches, and
 *   drawn opaque on a canvas that blends the same way with the ground.
 */
export function mixColors(layers: readonly Layer[], mixing: ColorMixing): string | undefined {
  if (layers.length === 0) return undefined;
  if (mixing === "First") return css(hexToRgb(layers[0]![0]), layers[0]![1]);
  if (mixing === "Normal") {
    let [r, g, b, a] = [0, 0, 0, 0];
    for (const [color, alpha] of layers) {
      const [cr, cg, cb] = hexToRgb(color);
      const out = alpha + a * (1 - alpha);
      if (out === 0) continue;
      r = (cr * alpha + r * a * (1 - alpha)) / out;
      g = (cg * alpha + g * a * (1 - alpha)) / out;
      b = (cb * alpha + b * a * (1 - alpha)) / out;
      a = out;
    }
    return css([r, g, b], a);
  }
  const channels = [0, 1, 2].map((k) => {
    const xs = layers.map(([color, alpha]) => alpha * hexToRgb(color)[k]!);
    if (mixing === "Screen") return 1 - xs.reduce((p, x) => p * (1 - x), 1);
    if (mixing === "Add")
      return Math.min(
        1,
        xs.reduce((s, x) => s + x, 0),
      );
    return layers.reduce((p, [color, alpha]) => p * (1 - alpha * (1 - hexToRgb(color)[k]!)), 1);
  });
  return css(channels, 1);
}

/** What an element's matching rules make of it: one face color (mixed) and its edges, in order. */
export interface ElementStyle {
  readonly color?: string;
  readonly edges: readonly Edge[];
}

/**
 * Style an element: its color rules' colors mixed by `mixing` (a scheme read at `valueOf`'s
 * value), each at its opacity times its test's weight; its boundary rules' edges in order.
 */
export function styleElement(
  colors: readonly ColorRule[],
  boundaries: readonly BoundaryRule[],
  mixing: ColorMixing,
  facts: ElementFacts,
  valueOf: (value: Json) => number | undefined,
  phase = 0,
): ElementStyle {
  const layers: Layer[] = [];
  for (const rule of colors) {
    const w = rule.test(facts);
    if (w <= 0) continue;
    const { paint } = rule;
    let color: string | undefined = typeof paint === "string" ? paint : undefined;
    if (typeof paint !== "string") {
      const v = valueOf(paint.value);
      if (v !== undefined && Number.isFinite(v)) color = schemeColor(paint, v, phase);
    }
    if (color === undefined) continue;
    layers.push([color, rule.opacity * w]);
    if (mixing === "First") break;
  }
  const edges: Edge[] = [];
  for (const rule of boundaries) {
    const w = rule.test(facts);
    if (w > 0) edges.push(w >= 1 ? rule : { ...rule, opacity: rule.opacity * w });
  }
  const color = mixColors(layers, mixing);
  return color === undefined ? { edges } : { color, edges };
}
