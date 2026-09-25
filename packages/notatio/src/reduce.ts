// Close the gap between what an expression asks for and what an environment can do,
// in the expression: `reduce(expr, env)` is MathJSON to MathJSON, and what comes out
// asks for nothing the environment lacks. A control with nothing to drive it is
// PINNED (its variable takes its starting value, and the declaration becomes a
// caption) or SAMPLED (a grid of the body at a few values -- small multiples, the
// print-native reading of a slider); a `Dynamic` becomes what it read; a GPU plot on a
// surface without one is rasterized; a `Row` in a narrow column stacks. It runs before
// `structuralOf`, so every backend downstream is unchanged.
// See design/rendering-environments.md.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { optionsOf, withOptions } from "@enumeratio/formats";
import { serializeNotatio } from "@enumeratio/formats/notatio";
import { can, type Environment, type Reading } from "./environment.ts";
import {
  CONTROL_HEADS,
  type ControlKind,
  HELD_HEADS,
  headOf,
  numOf,
  opsOf,
  strOf,
  symOf,
  tupleOf,
  variable,
  visualSymbol,
} from "./symbols.ts";

type Json = MathJsonExpression;

/** What a control (or a Manipulate parameter) declares about its variable. */
export interface Declaration {
  readonly name: string;
  readonly head: string;
  readonly kind: ControlKind;
  /** Where the variable starts, if the author said. */
  readonly init?: Json;
  /** The control's own argument: a range tuple, a list of entries, a box of corners. */
  readonly spec?: Json;
  /** `Static -> "Pin" | "Sample" | n` on the control or its Manipulate. */
  readonly reading?: Reading | number;
}

const STATIC_OPTION = "Static";

const readingOf = (value: Json | undefined): Reading | number | undefined => {
  if (value === undefined) return undefined;
  const n = numOf(value);
  if (n !== undefined) return n;
  const text = (strOf(value) ?? symOf(value))?.toLowerCase();
  return text === "pin" || text === "sample" ? text : undefined;
};

/** A Manipulate parameter `(a, 0, 5, 0.5)` / `((a, 2), 0, 5)` / `(a, [entries])` as a declaration. */
function manipulateParameter(node: Json, reading?: Reading | number): Declaration | undefined {
  const parts = tupleOf(node);
  if (parts === undefined || parts.length < 2) return undefined;
  const { name, init } = variable(parts[0]);
  if (name === undefined) return undefined;
  const rest = parts.slice(1).filter((p) => symOf(p) === undefined || numOf(p) !== undefined);
  const listed = tupleOf(rest[0]) !== undefined;
  const declaration: Declaration = listed
    ? { name, head: "Manipulate", kind: "listed", spec: rest[0] }
    : { name, head: "Manipulate", kind: "ranged", spec: ["Tuple", ...rest] as unknown as Json };
  return {
    ...declaration,
    ...(init === undefined ? {} : { init }),
    ...(reading === undefined ? {} : { reading }),
  };
}

/** Every declaration in an expression, in tree order. */
export function declarations(expr: Json, into: Declaration[] = []): Declaration[] {
  const head = headOf(expr);
  if (head !== undefined && HELD_HEADS.has(head)) return into;
  if (head === "Manipulate") {
    const { ops, options } = optionsOf(expr);
    const reading = readingOf(options[STATIC_OPTION]);
    for (const op of ops.slice(1)) {
      const d = manipulateParameter(op, reading);
      if (d !== undefined) into.push(d);
    }
    if (ops[0] !== undefined) declarations(ops[0], into);
    return into;
  }
  const kind = head === undefined ? undefined : visualSymbol(head)?.control;
  if (head !== undefined && kind !== undefined && CONTROL_HEADS.has(head)) {
    const { ops, options } = optionsOf(expr);
    const { name, init } = variable(ops[0]);
    const reading = readingOf(options[STATIC_OPTION]);
    if (name !== undefined) {
      into.push({
        name,
        head,
        kind,
        ...(init === undefined ? {} : { init }),
        ...(ops[1] === undefined ? {} : { spec: ops[1] }),
        ...(reading === undefined ? {} : { reading }),
      });
    }
    return into;
  }
  for (const op of opsOf(expr)) declarations(op, into);
  return into;
}

// --- values -----------------------------------------------------------------------

const number = (v: number): Json => Number(v.toPrecision(12)) as Json;
const string = (s: string): Json => `'${s}'` as Json;
const text = (node: Json): string => strOf(node) ?? serializeNotatio(node);

/** A value with the parser's binary noise taken off its numbers (`0.3` arrives as 0.30000000000000004). */
function cleaned(node: Json): Json {
  const n = numOf(node);
  if (n !== undefined) return number(n);
  const head = headOf(node);
  if (head === undefined) return node;
  return [head, ...opsOf(node).map(cleaned)] as unknown as Json;
}

/** The entry a choice binds: `Labeled(v, "label")` binds `v`. */
const entryValue = (node: Json): Json => (headOf(node) === "Labeled" ? (opsOf(node)[0] ?? node) : node);

/** A range spec's numbers, when they are numbers. */
function rangeOf(spec: Json | undefined): { min: number; max: number; step?: number } | undefined {
  const parts = tupleOf(spec);
  if (parts === undefined) return undefined;
  const [min, max, step] = parts.map(numOf);
  if (min === undefined || max === undefined) return undefined;
  return step === undefined ? { min, max } : { min, max, step };
}

/** Where a pinned control leaves its variable: its start, else the least it allows. */
export function pinValue(d: Declaration): Json | undefined {
  const value = pinned(d);
  return value === undefined ? undefined : cleaned(value);
}

function pinned(d: Declaration): Json | undefined {
  if (d.init !== undefined) return d.kind === "listed" ? entryValue(d.init) : d.init;
  const parts = tupleOf(d.spec);
  switch (d.kind) {
    case "ranged":
      return parts?.[0];
    case "listed":
      return parts === undefined ? "False" : parts[0] === undefined ? undefined : entryValue(parts[0]);
    case "simple":
      return d.head === "Checkbox" ? "False" : undefined;
    case "interval":
      return parts !== undefined && parts.length >= 2 ? (["Tuple", parts[0], parts[1]] as unknown as Json) : undefined;
    case "planar":
      return parts?.[0];
    case "locator":
      return ["Tuple", 0, 0] as unknown as Json;
  }
}

/** Up to `n` values a sampled control takes, or undefined when it has no grid to sample. */
export function sampleValues(d: Declaration, n: number): Json[] | undefined {
  if (n < 1) return undefined;
  const parts = tupleOf(d.spec);
  switch (d.kind) {
    case "ranged": {
      const range = rangeOf(d.spec);
      if (range === undefined) return undefined;
      const { min, max, step } = range;
      if (step !== undefined && step > 0) {
        const count = Math.floor((max - min) / step + 1e-9) + 1;
        if (count <= n) return Array.from({ length: count }, (_, i) => number(min + i * step));
        // Too many grid points: n of them, spread evenly and kept on the grid.
        return Array.from({ length: n }, (_, i) => number(min + Math.round(((count - 1) * i) / (n - 1)) * step));
      }
      if (n === 1) return [number(min)];
      return Array.from({ length: n }, (_, i) => number(min + ((max - min) * i) / (n - 1)));
    }
    case "listed":
      return parts === undefined ? ["False", "True"] : parts.slice(0, n).map((p) => cleaned(entryValue(p)));
    case "simple":
      return d.head === "Checkbox" ? ["False", "True"] : undefined;
    default:
      return undefined;
  }
}

/** The declaration as a caption: what was pinned, and what it could have been. */
export function caption(d: Declaration, value: Json): string {
  const lhs = `${d.name} = ${text(value)}`;
  const parts = tupleOf(d.spec);
  switch (d.kind) {
    case "ranged":
    case "interval": {
      const range = rangeOf(d.spec);
      return range === undefined ? lhs : `${lhs} (${text(number(range.min))} ≤ ${d.name} ≤ ${text(number(range.max))})`;
    }
    case "listed":
      return parts === undefined
        ? lhs
        : `${lhs} (${parts.map((p) => text(headOf(p) === "Labeled" ? (opsOf(p)[1] ?? p) : p)).join(" | ")})`;
    default:
      return lhs;
  }
}

// --- the rewrite ------------------------------------------------------------------

const LAYOUT = new Set(["Row", "Column", "Grid", "Panel", "Labeled"]);

/** A control that was removed: a layout drops it, anything else reads its variable. */
interface Removed {
  readonly removed: true;
  readonly name: string;
}
const isRemoved = (x: unknown): x is Removed => (x as Removed)?.removed === true;

/**
 * `expr` with `values` substituted and every control declaration taken out. A `Dynamic`
 * stays unless `unwrap`: with nothing left to follow it is a readout evaluated once,
 * which is a renderer's job, or the host's when the host evaluates itself.
 */
function substitute(node: Json, values: ReadonlyMap<string, Json>, unwrap = false): Json | Removed {
  const sym = symOf(node);
  if (sym !== undefined) return values.get(sym) ?? node;
  const head = headOf(node);
  if (head === undefined || HELD_HEADS.has(head)) return node;
  const ops = opsOf(node);
  if (head === "Manipulate" || (head === "Dynamic" && unwrap)) {
    return ops[0] === undefined ? node : substitute(ops[0], values, unwrap);
  }
  if (CONTROL_HEADS.has(head) && visualSymbol(head)?.control !== undefined) {
    const { name } = variable(ops[0]);
    return name === undefined ? node : { removed: true, name };
  }
  const settle = (op: Json | Removed): Json => (isRemoved(op) ? (op.name as Json) : op);
  const sub = (n: Json): Json | Removed => substitute(n, values, unwrap);
  if (LAYOUT.has(head)) {
    // A control in a layout is dropped from it; a list of entries keeps its shape.
    const prune = (entries: readonly Json[]): Json[] => entries.map(sub).filter((e): e is Json => !isRemoved(e));
    const rebuilt = ops.map((op, i) => {
      const inner = tupleOf(op);
      if (inner === undefined || (head === "Labeled" && i === 1)) return sub(op);
      if (head === "Grid") {
        // Rows stay rectangular: a removed cell is an empty one.
        const rows = inner.map((row) => {
          const cells = tupleOf(row);
          if (cells === undefined) return sub(row);
          return [
            "List",
            ...cells.map((c) => {
              const r = sub(c);
              return isRemoved(r) ? string("") : r;
            }),
          ] as unknown as Json;
        });
        const blank = (r: Json | Removed): boolean =>
          !isRemoved(r) && (tupleOf(r)?.every((c) => strOf(c) === "") ?? false);
        return ["List", ...rows.filter((r): r is Json => !isRemoved(r) && !blank(r))] as unknown as Json;
      }
      return ["List", ...prune(inner)] as unknown as Json;
    });
    const kept = rebuilt.filter((op): op is Json => !isRemoved(op));
    if (kept.length === 0 || (head === "Labeled" && isRemoved(rebuilt[0]))) {
      return { removed: true, name: "" };
    }
    const emptied = kept.every((op) => {
      const inner = tupleOf(op);
      return inner !== undefined && inner.length === 0;
    });
    if (emptied) return { removed: true, name: "" };
    // A row or column with one thing left in it is that thing.
    if (head === "Row" || head === "Column") {
      const only = kept.length === 1 ? tupleOf(kept[0]) : undefined;
      if (only !== undefined && only.length === 1) return only[0]!;
    }
    return [head, ...kept] as unknown as Json;
  }
  return [head, ...ops.map((op) => settle(sub(op)))] as unknown as Json;
}

/**
 * Every `Dynamic(e)` as `e` evaluated -- a readout with no engine behind it at view time
 * is the value it had when the page was made. `evaluate` is the host's engine; reduce
 * stays pure, so a host that evaluates applies this after it (a static reading only).
 */
export function evaluateReadouts(node: Json, evaluate: (expr: Json) => Json): Json {
  const head = headOf(node);
  if (head === undefined || HELD_HEADS.has(head)) return node;
  const ops = opsOf(node);
  if (head === "Dynamic") return ops[0] === undefined ? node : evaluate(ops[0]);
  return [head, ...ops.map((op) => evaluateReadouts(op, evaluate))] as unknown as Json;
}

/**
 * The expression with its controls taken out and their variables set to `values` -- what
 * a host that drives the controls itself (a TUI) shows for one state of them. A
 * variable with no value keeps its symbol.
 */
export function pin(expr: Json, values: ReadonlyMap<string, Json>): Json {
  const r = substitute(expr, values, true);
  let body = !isRemoved(r) ? r : r.name === "" ? expr : (values.get(r.name) ?? (r.name as Json));
  // A Locator pinned is a mark on its plot, as a static reading leaves it.
  for (const d of declarations(expr)) {
    const point = d.kind === "locator" ? values.get(d.name) : undefined;
    if (point !== undefined) body = markLocator(body, point).node;
  }
  return body;
}

/**
 * A pinned `Locator` is a mark on the plot it sat over: `Epilog -> Point((x, y))` on the
 * first `Plot` in the tree (joined to an `Epilog` already there). Nothing to mark, nothing
 * changes.
 */
function markLocator(node: Json, point: Json): { node: Json; marked: boolean } {
  const head = headOf(node);
  if (head === undefined || HELD_HEADS.has(head)) return { node, marked: false };
  if (head === "Plot") {
    const { ops, options } = optionsOf(node);
    const mark = ["Point", point] as unknown as Json;
    const epilog = options.Epilog;
    const joined = epilog === undefined ? mark : (["List", ...(tupleOf(epilog) ?? [epilog]), mark] as unknown as Json);
    return { node: withOptions("Plot", ops, { ...options, Epilog: joined }), marked: true };
  }
  const ops = opsOf(node);
  for (let i = 0; i < ops.length; i++) {
    const r = markLocator(ops[i]!, point);
    if (r.marked) {
      const next = [...ops];
      next[i] = r.node;
      return { node: [head, ...next] as unknown as Json, marked: true };
    }
  }
  return { node, marked: false };
}

const SAMPLEABLE = new Set<ControlKind>(["ranged", "listed", "simple"]);

/** The one declaration to sample, under the expression's own say and then the policy. */
function chooseSampled(decls: readonly Declaration[], env: Environment): Declaration | undefined {
  const asked = decls.find((d) => d.reading === "sample" || typeof d.reading === "number");
  if (asked !== undefined) return asked;
  if (env.static.controls !== "sample") return undefined;
  return decls.find((d) => d.reading !== "pin" && SAMPLEABLE.has(d.kind) && sampleValues(d, 2) !== undefined);
}

const chunk = <T>(xs: readonly T[], n: number): T[][] =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, (i + 1) * n));

/** The controls read statically: pin all but one, and lay that one out over its values. */
function staticControls(expr: Json, env: Environment): Json {
  const decls = declarations(expr);
  if (decls.length === 0) return expr;
  const sampled = chooseSampled(decls, env);
  const pinned = new Map<string, Json>();
  const captions: string[] = [];
  for (const d of decls) {
    if (d === sampled) continue;
    const value = pinValue(d);
    if (value === undefined) continue;
    pinned.set(d.name, value);
    captions.push(caption(d, value));
  }
  const settle = (r: Json | Removed): Json | undefined =>
    isRemoved(r) ? (r.name === "" ? undefined : (pinned.get(r.name) ?? (r.name as Json))) : r;
  let body: Json | undefined;
  if (sampled !== undefined) {
    const n = typeof sampled.reading === "number" ? sampled.reading : env.static.samples;
    const values = sampleValues(sampled, n) ?? [];
    // A control that was the whole picture samples its own value.
    const free = settle(substitute(expr, pinned)) ?? (sampled.name as Json);
    if (values.length === 0) return expr;
    const cells = values.map((v) => {
      const cell = settle(substitute(free, new Map([[sampled.name, v]])));
      // The label under each cell, as a figure's caption goes.
      return ["Labeled", cell ?? v, string(`${sampled.name} = ${text(v)}`), "Bottom"] as unknown as Json;
    });
    const list = (xs: readonly Json[]): Json => ["List", ...xs] as unknown as Json;
    body =
      sampled.head === "Animator"
        ? (["Row", list(cells)] as unknown as Json)
        : (["Grid", list(chunk(cells, env.static.columns).map(list))] as unknown as Json);
  } else {
    body = settle(substitute(expr, pinned));
    if (body === undefined) return expr;
  }
  for (const d of decls) {
    const point = d.kind === "locator" ? pinned.get(d.name) : undefined;
    if (point !== undefined) body = markLocator(body, point).node;
  }
  return captions.length === 0 ? body : (["Labeled", body, string(captions.join("; ")), "Bottom"] as unknown as Json);
}

const GPU_HEADS = new Set(["ComplexPlot", "ComplexPlot3D"]);

/** The environment's other rules, applied top-down: surfaces and layout. */
function surfaces(node: Json, env: Environment): Json {
  const head = headOf(node);
  if (head === undefined || HELD_HEADS.has(head)) return node;
  const ops = opsOf(node).map((op) => surfaces(op, env));
  if (GPU_HEADS.has(head) && !can.draw(env, "gpu") && can.draw(env, "raster")) {
    return ["Rasterize", [head, ...ops]] as unknown as Json;
  }
  if (head === "Row" && env.layout === "compact") return ["Column", ...ops] as unknown as Json;
  return [head, ...ops] as unknown as Json;
}

/**
 * The expression, asking for nothing `env` cannot give. With something to drive them
 * the controls stay; without, they are pinned or sampled. Then the surface rules.
 */
export function reduce(expr: Json, env: Environment): Json {
  const controlled = can.drive(env) ? expr : staticControls(expr, env);
  return surfaces(controlled, env);
}
