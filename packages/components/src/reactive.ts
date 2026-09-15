import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

// The dataflow core shared by `<notatio-notebook>` and `<notatio-worksheet>`: cells with
// stable identity, evaluated top-to-bottom in a scope that is rebuilt from scratch on
// every pass. Rebuilding is what makes it reactive rather than incremental -- deleting
// a binding cell removes its variable, and no cell can leave a stale value behind.
//
// The DOM lives in the elements; everything here is pure or engine-only, so the
// interesting decisions (what is a control, what can be drawn) are unit-testable
// without a browser.

export interface Cell {
  /** Stable identity, never reused; keys result state across reorder and deletion. */
  id: number;
  value: string;
  /** Worksheet only: whether this cell draws on the shared screen. Defaults to visible. */
  hidden?: boolean;
  /** Worksheet only: an explicit projection, overriding what the free variables imply. */
  projection?: ProjectionKind;
  /** Worksheet only: an author's slider bounds, overriding the inferred ones. */
  range?: ControlRange;
  /**
   * Worksheet only: the cell cannot be removed, and its binding cannot be renamed or
   * unbound -- only its value changed. A page that is *about* p and q wants those to
   * exist whatever the reader types.
   */
  locked?: boolean;
  /** Worksheet only: the binding is a whole number, and its slider steps by one. */
  integer?: boolean;
  /**
   * Worksheet only: the domain asserted for this cell's binding, spelled as a
   * compute-engine type (`integer`, `real`, `complex`, ...). The name is declared with
   * it, so a value outside it is rejected by the engine rather than by a check of ours.
   */
  domain?: string;
  /**
   * Worksheet only: the symbol this cell is pinned to. The name and its type become
   * fixed chrome in the input and only the value can be edited -- so a page *about* p
   * keeps a p bound to something, whatever the reader types into it.
   */
  bind?: string;
}

export interface CellResult {
  latex: string;
  markup: string;
  /** The bound symbol, when the cell is an assignment (`a := …`). */
  name?: string;
  status: "" | "error" | "invalid";
  detail: string;
}

// --- cell-number references --------------------------------------------------------

/** The old `@_n` shorthand. */
const AT_SHORTHAND = /@_\{?\d+\}?/;

function hasInOutAt(node: unknown): boolean {
  if (!Array.isArray(node)) return false;
  if (node[0] === "At" && (node[1] === "In" || node[1] === "Out")) return true;
  return node.some(hasInOutAt);
}

/**
 * True if a cell's input attempts a cell-number reference (`@_n`, `In[n]`, `Out[n]`).
 * Those only mean something where evaluation order is fixed; where cells reorder
 * freely they are rejected with a diagnostic rather than evaluated.
 */
export function referencesOrdinal(src: string, json: unknown): boolean {
  return AT_SHORTHAND.test(src) || hasInOutAt(json);
}

/**
 * The compute-engine types whose values are whole numbers, and so whose sliders should
 * step by one. Not every integer type is spelled `integer`.
 */
export const INTEGER_TYPES = new Set([
  "integer",
  "finite_integer",
  "non_negative_integer",
  "positive_integer",
  "negative_integer",
  "non_positive_integer",
]);

/** The symbol a cell binds, if it is an assignment. */
export function boundName(json: unknown): string | undefined {
  return Array.isArray(json) && json[0] === "Assign" && typeof json[1] === "string"
    ? json[1]
    : undefined;
}

// --- controls ----------------------------------------------------------------------

/** One movable axis of a binding. A complex binding contributes two. */
export interface WorksheetControl {
  name: string;
  /** Which part of the binding this slider moves. */
  part: "real" | "re" | "im";
  /** This axis's current value. */
  value: number;
  /** The binding's other part, carried so a rewrite can keep it. */
  other: number;
  min: number;
  max: number;
  step: number;
}

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
export function inferRange(
  value: number,
  integer = false,
): { min: number; max: number; step: number } {
  const bound = Math.abs(value) <= DEFAULT_BOUND ? DEFAULT_BOUND : niceCeiling(Math.abs(value));
  // A whole-number axis steps by one; there is nothing between 3 and 4 to land on.
  if (integer) return { min: -Math.round(bound), max: Math.round(bound), step: 1 };
  // ~400 notches across the range, snapped to a 1-2-5 step so the readout stays clean.
  return { min: -bound, max: bound, step: niceCeiling((2 * bound) / 400) };
}

/**
 * The controls a cell contributes. A cell qualifies when it binds a *number*: a real
 * one is a single slider, and a complex one is two -- there is no reason a knob has to
 * be real, and splitting it is what lets `s := 2 + 3i` be swept like any other
 * parameter. A function definition or a value that stayed symbolic contributes none.
 */
export function controlsFor(
  name: string | undefined,
  value: BoxedExpression,
  range?: ControlRange,
  integer = false,
): WorksheetControl[] {
  if (name === undefined) return [];
  const re = value.re;
  const im = value.im;
  if (!Number.isFinite(re) || !Number.isFinite(im)) return [];
  // An edited range applies to the whole binding, both parts of a complex one included:
  // the two sliders are two axes of one number, and separate sensitivities would be a
  // confusing thing to have to keep in your head.
  const span = (v: number) => resolveRange(v, range, integer);
  if (im === 0) return [{ name, part: "real", value: re, other: 0, ...span(re) }];
  return [
    { name, part: "re", value: re, other: im, ...span(re) },
    { name, part: "im", value: im, other: re, ...span(im) },
  ];
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

/**
 * How compute-engine spells a font-variant symbol internally, and the LaTeX that
 * produced it. A `\mathsf{extent}` is the symbol `extent_sansserif`.
 */
const FONT_SUFFIX: Record<string, string> = {
  _sansserif: "mathsf",
  _monospace: "mathtt",
  _bold: "mathbf",
  _fraktur: "mathfrak",
  _doublestruck: "mathbb",
  _script: "mathscr",
};

/**
 * The LaTeX that parses back to symbol `name`.
 *
 * Writing the internal name straight into a cell does not round-trip: `extent_sansserif`
 * is not `\mathsf{extent}`, and a bare multi-letter `camera` parses as six letters
 * multiplied together. Both would silently destroy the binding the moment a slider
 * moved it.
 */
export function symbolLatex(name: string): string {
  for (const [suffix, command] of Object.entries(FONT_SUFFIX)) {
    if (name.endsWith(suffix)) return `\\${command}{${name.slice(0, -suffix.length)}}`;
  }
  return name.length === 1 ? name : `\\mathrm{${name}}`;
}

/**
 * The notatio a control's cell should now read, after one of its axes moved. A complex
 * binding is rewritten whole, so moving either slider preserves the other part.
 */
export function bindingSource(control: WorksheetControl, next: number, integer = false): string {
  const round = (v: number) => (integer ? Math.round(v) : Number(v.toPrecision(12)));
  const name = symbolLatex(control.name);
  if (control.part === "real") return `${name}\\coloneq ${round(next)}`;
  const re = round(control.part === "re" ? next : control.other);
  const im = round(control.part === "im" ? next : control.other);
  const sign = im < 0 ? "-" : "+";
  return `${name}\\coloneq ${re} ${sign} ${Math.abs(im)}i`;
}

// --- projection --------------------------------------------------------------------

export type ProjectionKind = "none" | "portrait" | "curve" | "surface" | "image" | "curve3d";

/** The variable names each projection reads, in axis order. */
export const PROJECTION_VARS: Record<ProjectionKind, readonly string[]> = {
  none: [],
  portrait: ["z"],
  curve: ["x"],
  surface: ["x", "y"],
  // An image is already a picture -- it is drawn because of what it *is*, not because
  // of what it is a function of, so it leaves nothing free.
  image: [],
  // Likewise a curve in space: it is a list of points, not a function of an axis.
  curve3d: [],
};

/**
 * What a cell draws, from the variables it leaves free. `z` means the complex plane
 * and colours as a portrait; `x` alone is a curve; `x` and `y` together a surface.
 * Anything else -- no free variables, or free names that are not axes -- draws
 * nothing, which is how a binding cell stays off the screen without saying so.
 *
 * This is only the default: a cell may name its own projection, since the inference
 * is a convention about letters and conventions are sometimes wrong.
 */
export function inferProjection(free: readonly string[]): ProjectionKind {
  const set = new Set(free);
  if (set.size === 0) return "none";
  if (set.has("z") && set.size === 1) return "portrait";
  if (set.has("x") && set.has("y") && set.size === 2) return "surface";
  if (set.has("x") && set.size === 1) return "curve";
  return "none";
}

/** Is `kind` drawable given the variables the cell actually leaves free? */
export function projectionFits(kind: ProjectionKind, free: readonly string[]): boolean {
  if (kind === "none") return true;
  const needed = PROJECTION_VARS[kind];
  const set = new Set(free);
  return needed.every((v) => set.has(v)) && free.every((v) => needed.includes(v));
}

/**
 * Why a projection cannot draw a cell, in a sentence a reader can act on.
 *
 * Paired with `Missing`: the *value* says the request was understood and declined, and
 * this says what would have had to be true instead. The difference from staying
 * unevaluated matters — an unevaluated expression is indistinguishable from one nobody
 * got to yet, which is how a pane came to silently draw nothing more than once.
 *
 * (Wolfram's `Missing["reason"]` carries the reason itself. compute-engine's `Missing`
 * is a bare placeholder symbol and errors if applied to anything, so the reason travels
 * beside it rather than inside it.)
 */
export function projectionReason(kind: ProjectionKind, free: readonly string[]): string {
  const needed = PROJECTION_VARS[kind];
  const over = free.length > 0 ? free.join(", ") : "nothing";
  return needed.length === 0
    ? `nothing here to draw a ${kind} from`
    : `a ${kind} is drawn over ${needed.join(", ")}, and this is over ${over}`;
}

/** The value a declining projection yields: understood, and declined. */
export const missingProjection = (ce: ComputeEngine): BoxedExpression => ce.symbol("Missing");

/**
 * The free variables of a cell: symbols it reads that the sheet's scope does not
 * bind. `bound` is every name the sheet defines, so a cell over a slider variable is
 * not "free" in it -- only the axes it is actually plotted against remain.
 */
export function freeVariables(expr: BoxedExpression, bound: ReadonlySet<string>): string[] {
  const out = new Set<string>();
  for (const name of expr.unknowns) if (!bound.has(name)) out.add(name);
  return [...out].sort();
}

// --- the evaluation pass -------------------------------------------------------------

export interface PassCell {
  cell: Cell;
  result: CellResult;
  /** The cell's evaluated value, when it produced one. */
  value?: BoxedExpression;
  /**
   * The cell as written with every binding substituted, but *not* evaluated -- what a
   * plot should draw.
   *
   * Deliberately not the evaluated value. Evaluating collapses a cell into whatever
   * closed form it happens to have at that parameter: ζ(0, z) becomes a Bernoulli
   * polynomial, ζ(1, z) becomes ComplexInfinity and stops being drawable at all. So a
   * pane would change shape, and sometimes vanish, as a slider crossed those points.
   * Substituting alone keeps `HurwitzZeta(1, z)` a Hurwitz zeta, which draws its pole
   * like any other -- and keeps the compiled shape fixed while a slider moves.
   */
  plot?: BoxedExpression;
}

export interface PassOptions {
  /** Reject cell-number references (a sheet and the reactive notebook both do). */
  readonly rejectOrdinals: boolean;
  /** Convert result LaTeX to typeset markup. */
  readonly markup: (latex: string) => string;
  /** Collect evaluation errors out of a result's JSON. */
  readonly errors: (json: unknown) => string[];
}

/** The symbols a set of cells assigns, found without evaluating anything. */
function assignedNames(engine: ComputeEngine, cells: readonly Cell[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const cell of cells) {
    if (!cell.value.trim()) continue;
    try {
      const name = boundName(engine.parse(cell.value).json);
      // A declared cell keeps its assertion even while it is unparseable, so a name
      // pinned to a type cannot lose the type by being temporarily mistyped.
      const named = name ?? (cell.domain ? cell.bind : undefined);
      if (named !== undefined && !names.has(named)) names.set(named, cell.domain ?? "unknown");
    } catch {
      // A cell that will not parse assigns nothing; it reports when it is evaluated.
    }
  }
  return names;
}

/**
 * Evaluate every cell in a fresh scope, in order. Assignments bind into the scope and
 * later cells see them by name.
 *
 * Every assigned name is *declared* into the scope first, and that is load-bearing
 * rather than tidy: pushing a scope is not by itself enough to contain an assignment.
 * A symbol another element on the page has merely mentioned is declared on the shared
 * root, and `s := 2` then writes through to that outer binding instead of shadowing
 * it -- so two notebooks using `x`, or a notebook and the reference pages, would
 * quietly share variables. Declaring locally first gives the assignment somewhere of
 * its own to land.
 *
 * The push/eval/pop is synchronous on purpose: the engine is shared with every other
 * element on the page, so a pass that yielded mid-scope could interleave its bindings
 * with someone else's.
 */
export function runPass(
  engine: ComputeEngine,
  cells: readonly Cell[],
  options: PassOptions,
): PassCell[] {
  const out: PassCell[] = [];
  const names = assignedNames(engine, cells);
  const scope = engine.createScope({});
  engine.pushScope(scope);
  try {
    for (const [name, type] of names) {
      try {
        engine.declare(name, type);
      } catch {
        // A protected or already-local name needs no shadow. An unusable type would
        // also land here; fall back to an undeclared one rather than losing the cell.
        try {
          engine.declare(name, "unknown");
        } catch {
          /* already declared locally */
        }
      }
    }
    const bindings: Record<string, BoxedExpression> = {};
    for (const cell of cells) {
      if (!cell.value.trim()) continue;
      const passed = evaluateCell(engine, cell, options, bindings);
      if (passed.result.name && passed.value) bindings[passed.result.name] = passed.value;
      out.push(passed);
    }
  } finally {
    engine.popScope();
  }
  return out;
}

/** `subs` on an expression that cannot take it is not worth failing a cell over. */
function safeSubs(
  expr: BoxedExpression,
  bindings: Record<string, BoxedExpression>,
): BoxedExpression | undefined {
  try {
    return expr.subs(bindings);
  } catch {
    return undefined;
  }
}

/** Above this many operands, a result is described rather than typeset. */
const ELIDE_ABOVE = 64;

/**
 * A short description of a result too big to typeset, or `undefined` to typeset it.
 *
 * Serializing a 600-point curve runs to ~68 KB of LaTeX and ~800 KB of markup, and the
 * markup alone costs about a second -- per pass, for an output line nobody reads, of a
 * cell that exists to be *drawn*. A dragged slider cannot afford that, and it was what
 * made a curve worksheet feel stuck. The shape is what a reader wanted from that line
 * anyway; Wolfram elides long output for the same reason.
 */
function elideResult(expr: BoxedExpression): string | undefined {
  if (expr.operator !== "List") return undefined;
  // `ops` lives on compute-engine's narrowed function interface; read it structurally.
  const opsOf = (e: BoxedExpression): readonly BoxedExpression[] =>
    (e as unknown as { ops?: readonly BoxedExpression[] }).ops ?? [];
  const rows = opsOf(expr).length;
  if (rows <= ELIDE_ABOVE) return undefined;
  const inner = opsOf(expr)[0];
  const shape = inner?.operator === "List" ? `${rows}\\times ${opsOf(inner).length}` : `${rows}`;
  return `\\left[\\ldots\\right]_{${shape}}`;
}

function evaluateCell(
  engine: ComputeEngine,
  cell: Cell,
  options: PassOptions,
  bindings: Record<string, BoxedExpression>,
): PassCell {
  const fail = (status: "error" | "invalid", detail: string): PassCell => ({
    cell,
    result: { latex: "", markup: "", status, detail },
  });
  try {
    const parsed = engine.parse(cell.value);
    const json = parsed.json;
    if (options.rejectOrdinals && referencesOrdinal(cell.value, json)) {
      return fail(
        "invalid",
        "cell-number references aren't valid here — bind a variable with := instead",
      );
    }
    const name = boundName(json);
    // Substituted but unevaluated, and taken before `evaluate` so an Assign's own
    // right-hand side is not mistaken for something to draw.
    const plot = name === undefined ? safeSubs(parsed, bindings) : undefined;
    const evaled = parsed.evaluate(); // an Assign binds `name` into the scope
    const errors = options.errors(evaled.json);
    const latex = elideResult(evaled) ?? evaled.latex;
    return {
      cell,
      value: evaled,
      plot,
      result: {
        latex,
        markup: latex ? options.markup(latex) : "",
        name,
        status: errors.length ? "error" : "",
        detail: errors.join("; "),
      },
    };
  } catch (err) {
    return fail("error", err instanceof Error ? err.message : String(err));
  }
}
