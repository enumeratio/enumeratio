// A reference example's drawn value as boxes, in Node: the lowering a page's element or a cell
// does, minus the DOM. An expression that draws lowers by `makeBoxes` with the frontend's notation;
// a plot of an expression is sampled first (the compiled code, as the page's element runs it), and
// its samples lower. `shapeOf` reads a box's shape (`BoxShape`, in `@enumeratio/entry`) for a test
// to hold to what a record says. Pixels never come into it.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";
import { type Box, type BoxNode, makeBoxes, notationOf } from "@enumeratio/boxes";
import type { BoxShape, MathJSON } from "@enumeratio/entry";
import { plainJson } from "../src/graphics-rules.ts";
import { type CompiledItem, compilePlot } from "../src/plot-compile.ts";
import { plotBoxOfSamples, spanOf, unsampledPlot, vectorOptionsOf } from "../src/plot-lowering.ts";
import { PLOT_NOTATION } from "../src/plot-notation.ts";
import { plotSeries } from "../src/plot.ts";
import { polarPlotBox, samplePolar } from "../src/polarplot.ts";
import { FIGURE_NOTATION } from "../src/show-box.ts";
import { plotSettingsOf } from "../src/symbols.ts";
import { vectorPlotBox } from "../src/vectorplot.ts";

type Json = Parameters<typeof plainJson>[0];

const on = (v: string | undefined): boolean => v !== undefined && v !== "" && v !== "false";

/** compute-engine's helpers for compiled code, lent by a compiled function (as on the page). */
const systemHelpers = (ce: ComputeEngine): unknown =>
  (new JavaScriptTarget().compile(ce.box(["Power", "x", 3])).run as unknown as { SYS: unknown }).SYS;

/** What a compiled item reads: the plot's variables by name, and nothing else. */
type Sampler = (scope: Readonly<Record<string, number>>) => number;

/** `json`'s items, each element of a list on its own, as compiled code run as the page runs it. */
function samplers(
  ce: ComputeEngine,
  json: unknown,
  vars?: readonly string[],
): { compiled: readonly CompiledItem[]; free: readonly string[]; items: readonly Sampler[] } {
  const plot = compilePlot(ce, json, { target: "javascript", each: true, ...(vars === undefined ? {} : { vars }) });
  const sys = systemHelpers(ce);
  const items = plot.items.map((item) => {
    if (item.code === undefined) throw new Error(`not compilable: ${JSON.stringify(item.json)}`);
    // oxlint-disable-next-line no-implied-eval -- the engine's compiled output
    const fn = new Function("_SYS", "_", `return (${item.code});`) as (sys: unknown, scope: object) => unknown;
    return (scope: Readonly<Record<string, number>>): number => {
      const v = fn(sys, scope);
      return typeof v === "number" ? v : Number.NaN;
    };
  });
  return { compiled: plot.items, free: plot.unknowns.filter((u) => !u.startsWith("_")), items };
}

/** The plots of an expression: a `Show`'s producers wait on a view, which a page gives them. */
const SAMPLED: ReadonlySet<string> = new Set(["Plot", "ParametricPlot", "PolarPlot", "VectorPlot", "StreamPlot"]);

/** A plot of an expression, sampled over its domain: the box a page draws once its kernel has answered. */
function sampled(ce: ComputeEngine, held: readonly unknown[]): Box {
  const settings = plotSettingsOf(held as never)!;
  if (settings["epilog"] || settings["prolog"]) throw new Error("an Epilog or Prolog is read by the page, not here");
  const body = held[1];
  if (held[0] === "VectorPlot" || held[0] === "StreamPlot") {
    const [vx, vy] = [settings["xvar"] || "x", settings["yvar"] || "y"];
    const parts = Array.isArray(body) && body[0] === "Tuple" ? body.slice(1) : [];
    if (parts.length !== 2) throw new Error("a field is a pair of components");
    const [u, v] = parts.map((part) => samplers(ce, part, [vx, vy]).items[0]!);
    const { x, y, options } = vectorOptionsOf(settings);
    return vectorPlotBox(
      (px, py) => [u!({ [vx]: px, [vy]: py }), v!({ [vx]: px, [vy]: py })],
      x[0],
      x[1],
      y[0],
      y[1],
      options,
    );
  }
  const { compiled, free, items } = samplers(ce, body);
  const variable = settings["var"] || settings["tvar"] || free[0] || (held[0] === "PolarPlot" ? "theta" : "x");
  if (held[0] === "PolarPlot") {
    const [t0, t1] = spanOf(settings["trange"]) ?? [0, 2 * Math.PI];
    const n = Math.max(2, Math.min(2000, Number(settings["n"]) || 240));
    return polarPlotBox(
      samplePolar((t) => items[0]!({ [variable]: t }), t0, t1, n),
      {
        axes: settings["axes"] !== "false",
        closed: on(settings["closed"]),
        filled: on(settings["filled"]),
        markers: on(settings["markers"]),
        max: Number(settings["max"]) > 0 ? Number(settings["max"]) : undefined,
        title: settings["label"] || undefined,
      },
    );
  }
  const series = plotSeries(compiled, (k) => (t) => items[k]!({ [variable]: t }), {
    domain: spanOf(settings["domain"]) ?? [-6.283185, 6.283185],
    samples: Number(settings["samples"]) || 160,
    mode: settings["mode"],
    adaptive: settings["adaptive"] !== "false",
    parametric: settings["parametric"] !== undefined && settings["parametric"] !== "false",
  });
  return plotBoxOfSamples(settings, series);
}

/**
 * `expr` evaluated in `ce` and lowered to boxes as a front end draws it, with a plot of an
 * expression sampled. A value that doesn't draw lowers to `makeBoxes`' text boxes, which a caller
 * tells by the head.
 */
export function boxOfExample(ce: ComputeEngine, expr: MathJSON): Box {
  const value = plainJson(ce.box(expr as never).evaluate().json as Json);
  const notation = { ...notationOf(ce), ...FIGURE_NOTATION, ...PLOT_NOTATION };
  const box = makeBoxes(value as never, notation);
  const held = unsampledPlot(box) as readonly unknown[] | undefined;
  return held !== undefined && SAMPLED.has(String(held[0])) ? sampled(ce, held) : box;
}

const isNode = (box: unknown): box is BoxNode => Array.isArray(box) && typeof box[0] === "string";
const isOptions = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/** Boxes that only hold others: what a drawing's marks sit in. */
const CONTAINERS = new Set(["RowBox", "StyleBox", "TagBox", "GraphicsComplexBox", "InterpretationBox"]);

const ADDRESS = /^\d+,\d+(;\d+,\d+)*$/;

/** A number to 9 significant digits: the last digits of a sampled float are no claim. */
const settle = (x: unknown): unknown =>
  typeof x === "number"
    ? Number(x.toPrecision(9))
    : Array.isArray(x)
      ? x.map(settle)
      : isOptions(x)
        ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, settle(v)]))
        : x;

/**
 * `box`'s shape for the parts `asked` names: its head always; a drawing's `marks` and `roles` by
 * count, the root's options by key (numbers settled) and its operands, each only where `asked` has them.
 */
export function shapeOf(box: Box, asked: BoxShape): BoxShape {
  if (!isNode(box)) throw new Error(`not a box: ${JSON.stringify(box)}`);
  const marks: Record<string, number> = {};
  const roles: Record<string, number> = {};
  const walk = (node: unknown, role?: string): void => {
    if (!isNode(node)) return;
    // A figure's tags name an address (`0,1`, a link's `0,1;1,2`), a plot's name a role.
    if (node[0] === "TagBox" && typeof node[2] === "string")
      return walk(node[1], ADDRESS.test(node[2]) ? undefined : node[2]);
    if (!CONTAINERS.has(node[0])) {
      marks[node[0]] = (marks[node[0]] ?? 0) + 1;
      if (role !== undefined) roles[role] = (roles[role] ?? 0) + 1;
    } else if (node[0] === "RowBox" && Array.isArray(node[1])) for (const part of node[1]) walk(part, role);
    else walk(node[1]);
  };
  if (box[0] === "GraphicsBox") walk(box[1]);
  const shape: { -readonly [K in keyof BoxShape]: BoxShape[K] } = { head: box[0] };
  if (asked.marks !== undefined) shape.marks = marks;
  if (asked.roles !== undefined) shape.roles = roles;
  const last = box.at(-1);
  if (asked.operands !== undefined) shape.operands = box.slice(1, box.length > 1 && isOptions(last) ? -1 : undefined);
  if (asked.options !== undefined) {
    const have: Record<string, unknown> = box.length > 1 && isOptions(last) ? last : {};
    shape.options = Object.fromEntries(Object.keys(asked.options).map((key) => [key, settle(have[key])]));
  }
  return shape;
}

/** `shape` with its numbers settled, for comparing with `shapeOf`'s. */
export const settledShape = (shape: BoxShape): BoxShape => ({
  ...shape,
  ...(shape.options === undefined ? {} : { options: settle(shape.options) as Record<string, unknown> }),
});
