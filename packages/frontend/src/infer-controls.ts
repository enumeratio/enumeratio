// Controls from an expression: what a reader may move in it, and how. The free symbols of
// an expression each get a `ControlSpec` -- a `Domain` (variables.ts's vocabulary: kind,
// bounds, choices) with a starting value and the control that draws it -- from, in order
// of precedence: an author's hint (a Manipulate tuple), the engine's declared type or
// assumptions for the symbol, an optional letter convention (`n` is an integer), and
// last a real in [-10, 10]. Pure: no DOM, no engine required.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { ControlType } from "./manipulate.ts";
import type { Domain } from "./variables.ts";

type Json = unknown;

// --- ranges -------------------------------------------------------------------------

/** A 1-2-5 number at or above `x` — the granularity people choose by hand. */
function niceCeiling(x: number): number {
  if (!(x > 0)) return 1;
  const decade = 10 ** Math.floor(Math.log10(x));
  const norm = x / decade;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * decade;
}

/** The default half-width of a slider: knobs start at ±10 unless the value needs more. */
export const DEFAULT_BOUND = 10;

/**
 * The range a plain numeric binding gets, and the step to move it by.
 *
 * Symmetric about zero and ±10 by default, widening only far enough to contain a value
 * that does not fit. The point is that it be *predictable*: the previous rule scaled
 * with the value through powers of ten, so 2 got [0, 10] while 8 got [0, 100] and 0.5
 * got [0, 1] — neighbouring values landing on wildly different ranges, and a positive
 * value never able to reach a negative one. A knob whose sensitivity you cannot guess
 * is a knob that runs away the moment you touch it.
 *
 * This is a starting point, not a claim about the model: the endpoints are editable,
 * and `Auto` is still the eventual answer.
 */
export function inferRange(value: number, integer = false): { min: number; max: number; step: number } {
  const bound = Math.abs(value) <= DEFAULT_BOUND ? DEFAULT_BOUND : niceCeiling(Math.abs(value));
  // A whole-number axis steps by one; there is nothing between 3 and 4 to land on.
  if (integer) return { min: -Math.round(bound), max: Math.round(bound), step: 1 };
  // ~400 notches across the range, snapped to a 1-2-5 step so the readout stays clean.
  return { min: -bound, max: bound, step: niceCeiling((2 * bound) / 400) };
}

/** An author's override of a control's range; any part may be left to the default. */
export interface ControlRange {
  min?: number;
  max?: number;
  step?: number;
}

/** The inferred range with an author's overrides applied, and kept usable. */
export function resolveRange(
  value: number,
  range: ControlRange | undefined,
  integer = false,
): { min: number; max: number; step: number } {
  const base = inferRange(value, integer);
  const min = Number.isFinite(range?.min) ? (range?.min as number) : base.min;
  const max = Number.isFinite(range?.max) ? (range?.max as number) : base.max;
  // An inverted or empty range would leave a slider that cannot move.
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (!(hi > lo)) return base;
  if (integer) return { min: Math.round(lo), max: Math.round(hi), step: 1 };
  const step =
    Number.isFinite(range?.step) && (range?.step as number) > 0
      ? (range?.step as number)
      : niceCeiling((hi - lo) / 400);
  return { min: lo, max: hi, step };
}

// --- specs --------------------------------------------------------------------------

/** One inferred control: the symbol it moves, what it may be, where it starts, how it is drawn. */
export interface ControlSpec {
  readonly name: string;
  readonly domain: Domain;
  /** MathJSON: a number, `True`/`False`, a quoted string, a `Tuple` point. */
  readonly start: Json;
  readonly controlType?: ControlType;
}

/** What an author says about one symbol; each part overrides the inferred one. */
export interface ControlHint {
  /** A compute-engine type (`integer`, `positive_real`, `boolean`, …). */
  readonly type?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly start?: Json;
  /** A discrete list to choose from; wins over `type`. */
  readonly choices?: readonly Json[];
  readonly controlType?: ControlType;
}

export interface InferContext {
  /** Declared types and assumptions are read from here. */
  readonly engine?: Pick<ComputeEngine, "box">;
  /** Types by name, where there is no engine to ask; the engine's, if both say. */
  readonly types?: Readonly<Record<string, string>>;
  /** Names the scope already binds: no control for these. */
  readonly bound?: ReadonlySet<string>;
  readonly hints?: Readonly<Record<string, ControlHint>>;
  /** Only these symbols (a bare name in a Manipulate); default every free symbol. */
  readonly names?: readonly string[];
  /** Guess from a symbol's letter when nothing else says: `n`, `m`, `k` integer, `z` complex. Off by default. */
  readonly letterConventions?: boolean;
}

// --- free symbols -------------------------------------------------------------------

/** Heads whose `(x, …)` tuples, or implicit `x`, bind a variable rather than read one. */
const PLOT_HEADS = new Set([
  "Plot",
  "Plot3D",
  "ContourPlot",
  "DensityPlot",
  "PolarPlot",
  "VectorPlot",
  "StreamPlot",
  "ParametricPlot",
  "ComplexPlot",
  "ComplexPlot3D",
]);
const ITERATOR_HEADS = new Set([...PLOT_HEADS, "Sum", "Product", "Integrate", "Table", "Limit", "Manipulate"]);
const FUNCTION_HEADS = new Set(["Function", "Lambda"]);
/** The variables a plot reads when its range does not name them. */
const PLOT_VARIABLES = ["x", "y", "t", "z"];
/** Lowercase names that are constants, not unknowns. */
const CONSTANTS = new Set(["i", "e"]);

const isUnknownName = (s: string): boolean => /^\p{Ll}/u.test(s) && !CONSTANTS.has(s) && !s.startsWith("'");

function symbolOf(node: Json): string | undefined {
  if (typeof node === "string") return node;
  const sym = (node as { sym?: unknown } | null)?.sym;
  return typeof sym === "string" ? sym : undefined;
}

/** The symbols `json` reads, in order of first appearance, minus those it binds itself. */
export function freeSymbols(json: Json): string[] {
  const seen: string[] = [];
  const bound = new Set<string>();
  const walk = (node: Json): void => {
    if (typeof node === "string" || (node && typeof node === "object" && "sym" in node)) {
      const s = symbolOf(node);
      if (s !== undefined && isUnknownName(s) && !seen.includes(s)) seen.push(s);
      return;
    }
    const fn = (node as { fn?: unknown[] } | null)?.fn;
    const parts = Array.isArray(node) ? node : Array.isArray(fn) ? fn : undefined;
    if (parts === undefined) return;
    const head = typeof parts[0] === "string" ? parts[0] : undefined;
    const operands = head === undefined ? parts : parts.slice(1);
    if (head !== undefined && PLOT_HEADS.has(head)) for (const v of PLOT_VARIABLES) bound.add(v);
    if (head !== undefined && FUNCTION_HEADS.has(head))
      for (const p of operands.slice(1)) {
        const s = symbolOf(p);
        if (s !== undefined) bound.add(s);
      }
    if (head !== undefined && ITERATOR_HEADS.has(head))
      for (const op of operands) {
        const items = Array.isArray(op) && op[0] === "Tuple" ? op.slice(1) : undefined;
        const s = items && items.length >= 3 ? symbolOf(items[0]) : undefined;
        if (s !== undefined) bound.add(s);
      }
    for (const op of operands) walk(op);
  };
  walk(json);
  return seen.filter((s) => !bound.has(s));
}

// --- rules --------------------------------------------------------------------------

const INTEGER_TYPES = new Set(["integer", "finite_integer"]);
const REAL_TYPES = new Set(["real", "finite_real", "number", "finite_number", "rational", "finite_rational"]);

/** The named sign subtypes, as the bounded types they abbreviate. */
const SIGN_TYPES: Readonly<Record<string, string>> = {
  positive_integer: "integer<1..>",
  non_negative_integer: "integer<0..>",
  negative_integer: "integer<..-1>",
  non_positive_integer: "integer<..0>",
  positive_real: "real<0<..>",
  non_negative_real: "real<0..>",
  negative_real: "real<..<0>",
  non_positive_real: "real<..0>",
};

/**
 * A compute-engine type with the bounds an assumption gave it: `integer<1..>` after
 * `n > 0`, `real<0<..>` (open at 0) after `w > 0`, `real<0..10>`.
 */
function splitType(type: string): { base: string; lo?: number; loOpen: boolean; hi?: number; hiOpen: boolean } {
  const named = SIGN_TYPES[type.trim()] ?? type.trim();
  const m = /^(\w+)<(.*)>$/s.exec(named);
  if (m === null) return { base: named, loOpen: false, hiOpen: false };
  const [left = "", right = ""] = m[2].split("..");
  const num = (t: string): number | undefined => (t.trim() === "" ? undefined : Number(t));
  return {
    base: m[1],
    lo: num(left.replace("<", "")),
    loOpen: left.includes("<"),
    hi: num(right.replace("<", "")),
    hiOpen: right.includes("<"),
  };
}
/** The whole-number ends a type gives an integer (`integer<1..>` is from 1); none where it gives no end. */
export function integerBounds(type: string): { min?: number; max?: number } | undefined {
  const { base, lo, loOpen, hi, hiOpen } = splitType(type);
  if (!INTEGER_TYPES.has(base)) return undefined;
  return {
    ...(lo === undefined ? {} : { min: Math.ceil(lo) + (loOpen && Number.isInteger(lo) ? 1 : 0) }),
    ...(hi === undefined ? {} : { max: Math.floor(hi) - (hiOpen && Number.isInteger(hi) ? 1 : 0) }),
  };
}

const COMPLEX_TYPES = new Set(["complex", "finite_complex", "imaginary"]);
/** Half-width of the box a complex number's pad covers. */
const COMPLEX_BOUND = 2;

/** The controls each kind of domain can sensibly be drawn by; a hint outside these is ignored. */
const COMPATIBLE: Readonly<Record<Domain["kind"], readonly ControlType[]>> = {
  integers: ["Slider", "VerticalSlider", "Animator", "Knob", "InputField"],
  reals: ["Slider", "VerticalSlider", "Animator", "Knob", "InputField"],
  choices: ["SetterBar", "RadioButtonBar", "PopupMenu", "ListPicker", "Toggler"],
  booleans: ["Checkbox", "Toggler"],
  points: ["Slider2D", "InputField"],
  named: ["PopupMenu"],
  any: ["InputField"],
};

/** How many choices a bar can show before a menu reads better -- Manipulate's own cut. */
export const BAR_LIMIT = 5;

const clampTo = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** A finite union of literals -- `'a' | 'b'`, `1 | 2 | 3` -- as its values. */
function literalChoices(type: string): Json[] | undefined {
  const parts = type.split("|").map((p) => p.trim());
  if (parts.length < 2) return undefined;
  const values: Json[] = [];
  for (const p of parts) {
    if (/^'.*'$/s.test(p)) values.push(p);
    else if (p !== "" && Number.isFinite(Number(p))) values.push(Number(p));
    else return undefined;
  }
  return values;
}

const labelOf = (v: Json): string => (typeof v === "string" ? v.replace(/^'(.*)'$/s, "$1") : String(v));

function choicesSpec(name: string, values: readonly Json[], start?: Json): ControlSpec {
  return {
    name,
    domain: { kind: "choices", values, labels: values.map(labelOf) },
    start: start !== undefined && values.some((v) => v === start) ? start : values[0],
    controlType: values.length <= BAR_LIMIT ? "SetterBar" : "PopupMenu",
  };
}

/** A slider's ends: the known ones, the other a usual span away from it (or the default). */
function span(lo: number | undefined, hi: number | undefined, dflt: { min: number; max: number }): [number, number] {
  // A one-sided bound keeps the default far end unless that leaves too little to move in.
  const min = lo ?? (hi === undefined || hi > dflt.min / 2 ? dflt.min : hi - DEFAULT_BOUND);
  const max = hi ?? (lo === undefined || lo < dflt.max / 2 ? dflt.max : lo + DEFAULT_BOUND);
  return [min, max];
}

/** The spec a compute-engine type names, with an author's overrides applied; undefined for a type with no control. */
function specOfType(name: string, type: string, hint: ControlHint | undefined): ControlSpec | undefined {
  const choices = literalChoices(type);
  if (choices !== undefined) return choicesSpec(name, choices, hint?.start);
  const { base: kind, lo, loOpen, hi, hiOpen } = splitType(type);
  if (INTEGER_TYPES.has(kind)) {
    const dflt = inferRange(1, true);
    const lowest = lo === undefined ? undefined : Math.ceil(lo) + (loOpen && Number.isInteger(lo) ? 1 : 0);
    const highest = hi === undefined ? undefined : Math.floor(hi) - (hiOpen && Number.isInteger(hi) ? 1 : 0);
    // One-sided bounds keep a slider's usual span, measured from the bound.
    const [min, max] = span(hint?.min ?? lowest, hint?.max ?? highest, dflt).map(Math.round) as [number, number];
    const start = typeof hint?.start === "number" ? hint.start : clampTo(1, min, max);
    return { name, domain: { kind: "integers", min, max }, start: clampTo(start, min, max), controlType: "Slider" };
  }
  if (REAL_TYPES.has(kind)) {
    const dflt = inferRange(1);
    const step = hint?.step ?? dflt.step;
    // An open bound stops one step in, so the slider never sits on the excluded value.
    const lowest = lo === undefined ? undefined : lo + (loOpen ? step : 0);
    const highest = hi === undefined ? undefined : hi - (hiOpen ? step : 0);
    const [min, max] = span(hint?.min ?? lowest, hint?.max ?? highest, dflt);
    const start = typeof hint?.start === "number" ? hint.start : clampTo(1, min, max);
    return {
      name,
      domain: { kind: "reals", min, max, step },
      start: clampTo(start, min, max),
      controlType: "Slider",
    };
  }
  if (COMPLEX_TYPES.has(type)) {
    return {
      name,
      domain: { kind: "points", ring: "ComplexNumbers", min: -COMPLEX_BOUND, max: COMPLEX_BOUND },
      start: hint?.start ?? ["Tuple", 1, 0],
      controlType: "Slider2D",
    };
  }
  if (type === "boolean") {
    return { name, domain: { kind: "booleans" }, start: hint?.start ?? "False", controlType: "Checkbox" };
  }
  if (type === "string") {
    return { name, domain: { kind: "any" }, start: hint?.start ?? "''", controlType: "InputField" };
  }
  return undefined;
}

const LETTER_TYPES: Readonly<Record<string, string>> = { n: "integer", m: "integer", k: "integer", z: "complex" };

/** The type a symbol's letter suggests (`n` is an integer), for a host that turns the convention on. */
export const letterType = (name: string): string | undefined => LETTER_TYPES[name];

/** What the engine says a symbol's type is, if it says anything useful. */
function declaredType(name: string, ctx: InferContext): string | undefined {
  const asked = ctx.engine?.box(name).type?.toString();
  const type = asked !== undefined && asked !== "unknown" && asked !== "any" ? asked : ctx.types?.[name];
  return type === "unknown" || type === "any" ? undefined : type;
}

/** The control for one symbol. */
export function inferControl(name: string, ctx: InferContext = {}): ControlSpec {
  const hint = ctx.hints?.[name];
  const spec =
    (hint?.choices !== undefined && hint.choices.length > 0
      ? choicesSpec(name, hint.choices, hint.start)
      : undefined) ??
    specOfHint(name, hint) ??
    specOfType(name, hint?.type ?? declaredType(name, ctx) ?? "", hint) ??
    (ctx.letterConventions && LETTER_TYPES[name] !== undefined
      ? specOfType(name, LETTER_TYPES[name], hint)
      : undefined) ??
    (specOfType(name, "real", hint) as ControlSpec);
  const wanted = hint?.controlType;
  return wanted !== undefined && COMPATIBLE[spec.domain.kind].includes(wanted)
    ? { ...spec, controlType: wanted }
    : spec;
}

/** A hint that gives a range for a name with no type: numeric bounds make it a real (an integer when whole). */
function specOfHint(name: string, hint: ControlHint | undefined): ControlSpec | undefined {
  if (hint === undefined || hint.type !== undefined) return undefined;
  if (hint.min === undefined && hint.max === undefined) return undefined;
  return specOfType(name, "real", hint);
}

/** The controls `expr` (MathJSON) asks for: one per free symbol, or per name in `ctx.names`. */
export function inferControls(expr: Json, ctx: InferContext = {}): ControlSpec[] {
  const wanted = ctx.names ?? freeSymbols(expr);
  return [...new Set(wanted)].filter((n) => !ctx.bound?.has(n)).map((n) => inferControl(n, ctx));
}

// --- to Manipulate's tuples ----------------------------------------------------------

const epsilNumber = (n: number): string => String(Number(n.toPrecision(12)));

/** A spec as the `params` tuple `parseControls` reads. */
export function paramsOf(spec: ControlSpec): string | undefined {
  const { name, domain, start, controlType } = spec;
  const type = controlType === undefined ? "" : `, ${controlType}`;
  switch (domain.kind) {
    case "integers":
      return `{{${name}, ${String(start)}}, ${domain.min}, ${domain.max}, 1${type}}`;
    case "reals":
      return `{{${name}, ${epsilNumber(Number(start))}}, ${epsilNumber(domain.min)}, ${epsilNumber(domain.max)}, ${epsilNumber(domain.step)}${type}}`;
    case "choices": {
      // Numbers as they are, strings quoted (they may be quoted already, `'a'`, in a type).
      const entries = domain.values.map((v) => (typeof v === "string" ? `"${labelOf(v)}"` : v));
      if (entries.some((v) => typeof v !== "string" && typeof v !== "number")) return undefined;
      const first = typeof start === "string" ? `"${labelOf(start)}"` : String(start);
      return `{{${name}, ${first}}, {${entries.join(", ")}}${type}}`;
    }
    case "booleans":
      return `{{${name}, ${String(start)}}, Boolean${type}}`;
    case "points": {
      const [re, im] = Array.isArray(start) ? (start as Json[]).slice(1) : [0, 0];
      return `{{${name}, ${String(re)}, ${String(im)}}, Complex${type}}`;
    }
    case "any":
      return `{{${name}, ${typeof start === "string" ? start : "''"}}, String${type}}`;
    default:
      return undefined;
  }
}

// --- from a head's signature ---------------------------------------------------------

/** One parameter of a head's typed signature (`@enumeratio/manifest`'s `Parameter`). */
export interface SignatureParameter {
  readonly name?: string;
  readonly type: string;
  readonly variadic?: boolean;
}

/** A head and its parameters' types: what turns the literals of a call into controls. */
export interface HeadSignature {
  readonly head: string;
  readonly parameters: readonly SignatureParameter[];
  /** The largest safe value of the first integer parameter (a record's `maxSize`): a type-like upper bound. */
  readonly maxSize?: number;
  /** The finite values of the head's options, by key (a record's `optionValues`). */
  readonly options?: Readonly<Record<string, readonly (string | number | boolean)[]>>;
}

/** `Key -> value` as a `Rule`, `KeyValuePair` or the capitalised-key `Tuple` it canonicalises to (not `@enumeratio/engine`'s `ruleOf`: that would load the engine). */
function ruleOf(node: Json): { name: string; value: Json } | undefined {
  const parts = Array.isArray(node) ? node : (node as { fn?: unknown[] } | null)?.fn;
  if (!Array.isArray(parts) || parts.length !== 3) return undefined;
  if (parts[0] !== "Rule" && parts[0] !== "KeyValuePair" && parts[0] !== "Tuple") return undefined;
  const name = symbolOf(parts[1]);
  return name !== undefined && /^\p{Lu}/u.test(name) ? { name, value: parts[2] } : undefined;
}

/** An option value as MathJSON: `True`/`False`, a `'quoted'` string, a number. */
const optionJson = (v: string | number | boolean): Json =>
  typeof v === "boolean" ? (v ? "True" : "False") : typeof v === "string" ? `'${v}'` : v;

/** An option's value as written in an example, in `optionJson`'s spelling; undefined for anything else. */
function writtenValue(node: Json): string | number | undefined {
  const word = symbolOf(node);
  if (word === "True" || word === "False") return word;
  const str = (node as { str?: unknown } | null)?.str;
  if (typeof str === "string") return `'${str}'`;
  if (typeof node === "string" && /^'.*'$/s.test(node)) return node;
  return numberOf(node);
}

/** The `|`-separated members of a type, leaving those inside `<>`, `()`, `[]`, `{}`. */
function unionMembers(type: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < type.length; i++) {
    const c = type[i];
    if ("<([{".includes(c)) depth++;
    else if (">)]}".includes(c) && !(c === ">" && type[i - 1] === "-")) depth--;
    else if (c === "|" && depth === 0) {
      parts.push(type.slice(from, i).trim());
      from = i + 1;
    }
  }
  parts.push(type.slice(from).trim());
  return parts;
}

/** The part of a (possibly union) type that a control can draw: the first member with a spec. */
function controllable(type: string): string | undefined {
  if (literalChoices(type) !== undefined) return type;
  return unionMembers(type).find((m) => specOfType("_", m, undefined) !== undefined);
}

const numberOf = (node: Json): number | undefined =>
  typeof node === "number"
    ? node
    : typeof (node as { num?: unknown } | null)?.num === "string"
      ? Number((node as { num: string }).num)
      : undefined;

/** A lifted integer runs to the literal or this, whichever is larger; only a type bound widens it (a collection's cost grows fast). */
const LIFT_SPAN = 6;

/**
 * `expr` with the literals at TYPED parameter positions of its first call of `signature.head`
 * replaced by symbols, and a hint for each: its type, and the literal as its start. A position
 * typed `any`, or of a type no control draws, stays as written.
 */
export function liftLiterals(expr: Json, signature: HeadSignature): { body: Json; hints: Record<string, ControlHint> } {
  const hints: Record<string, ControlHint> = {};
  const taken = new Set<string>();
  const collect = (node: Json): void => {
    if (typeof node === "string") taken.add(node);
    else if (Array.isArray(node)) node.forEach(collect);
    else if (node && typeof node === "object") {
      const { sym, fn } = node as { sym?: unknown; fn?: unknown[] };
      if (typeof sym === "string") taken.add(sym);
      fn?.forEach(collect);
    }
  };
  collect(expr);

  const last = signature.parameters.at(-1);
  // The cap belongs to the size parameter: the first integer lifted.
  let capped = false;
  const liftArg = (arg: Json, i: number): Json => {
    const param = signature.parameters[i] ?? (last?.variadic ? last : undefined);
    const type = param === undefined ? undefined : controllable(param.type);
    if (param === undefined || type === undefined) return arg;
    const word = symbolOf(arg);
    const start = word === "True" || word === "False" ? word : numberOf(arg);
    if (start === undefined) return arg;
    const bounds = splitType(type);
    const fits =
      typeof start === "string"
        ? bounds.base === "boolean"
        : INTEGER_TYPES.has(bounds.base)
          ? Number.isInteger(start)
          : REAL_TYPES.has(bounds.base) || literalChoices(type) !== undefined;
    if (!fits) return arg;
    const written = param.name !== undefined && /^\p{Ll}\w*$/u.test(param.name) ? param.name : `p${i + 1}`;
    const name = taken.has(written) || written in hints ? `p${i + 1}` : written;
    if (taken.has(name) || name in hints) return arg;
    // The record's cap bounds the size parameter, tighter than any type bound; else a small span.
    const upper = (hi: number | undefined, from: number): number => {
      const sized = !capped && signature.maxSize !== undefined;
      if (sized) capped = true;
      return sized ? Math.min(hi ?? Infinity, signature.maxSize as number) : (hi ?? Math.max(LIFT_SPAN, from));
    };
    hints[name] = {
      type,
      start,
      // An integer runs over a small span from zero, or to the literal if that lies outside it.
      ...(typeof start === "number" && INTEGER_TYPES.has(bounds.base)
        ? { min: bounds.lo ?? Math.min(0, start), max: upper(bounds.hi, start) }
        : {}),
    };
    return name;
  };

  // `Key -> value` for an option whose values a record lists: the value becomes a control that starts there.
  const liftOption = (arg: Json): Json => {
    const rule = signature.options === undefined ? undefined : ruleOf(arg);
    const allowed =
      rule === undefined
        ? undefined
        : Object.hasOwn(signature.options!, rule.name)
          ? signature.options![rule.name]
          : undefined;
    if (rule === undefined || allowed === undefined || allowed.length < 2) return arg;
    const start = writtenValue(rule.value as Json);
    const values = allowed.map(optionJson);
    if (start === undefined || !values.includes(start)) return arg;
    const name = rule.name.replace(/^./, (c) => c.toLowerCase());
    if (taken.has(name) || name in hints) return arg;
    const boolean = values.length === 2 && values.includes("True") && values.includes("False");
    hints[name] = boolean ? { type: "boolean", start } : { choices: values, start };
    const next = (Array.isArray(arg) ? [...arg] : [...(arg as { fn: unknown[] }).fn]) as Json[];
    next[2] = name;
    return Array.isArray(arg) ? next : { ...(arg as object), fn: next };
  };

  let done = false;
  const lift = (node: Json): Json => {
    if (done) return node;
    const fn = (node as { fn?: unknown[] } | null)?.fn;
    const parts = Array.isArray(node) ? (node as Json[]) : Array.isArray(fn) ? (fn as Json[]) : undefined;
    if (parts === undefined) return node;
    const rebuilt = (next: Json[]): Json => (Array.isArray(node) ? next : { ...(node as object), fn: next });
    if (parts[0] !== signature.head) return rebuilt(parts.map((p, i) => (i === 0 ? p : lift(p))));
    done = true;
    return rebuilt([parts[0], ...parts.slice(1).map((arg, i) => liftOption(liftArg(arg, i)))]);
  };
  return { body: lift(expr), hints };
}

/**
 * The controls for the typed arguments of a call: `IntegerPartitions(8)` with
 * `(integer, any?, any?)` is `n`, an integer from 0 to 12 starting at 8. Typed positions only.
 */
export function inferFromSignature(
  expr: Json,
  signature: HeadSignature,
  ctx: Omit<InferContext, "hints" | "names"> = {},
): { body: Json; specs: ControlSpec[] } {
  const { body, hints } = liftLiterals(expr, signature);
  return { body, specs: inferControls(body, { ...ctx, hints, names: Object.keys(hints) }) };
}
