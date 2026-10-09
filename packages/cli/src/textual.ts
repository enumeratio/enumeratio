// The text surface's reading of a result: a `Plot` head, sampled by the session and
// drawn on braille cells, for a terminal without an image protocol and for a pipe.
// The Node host prefers an inline image where the terminal has one; this is what
// stands in where it does not, and what the control strip draws under itself.

import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";
import { type Box, notationOf } from "@enumeratio/boxes";
import { optionsOf } from "@enumeratio/formats";
import {
  headOf,
  numOf,
  opsOf,
  plainJson,
  plotSettingsOf,
  strOf,
  symOf,
  tupleOf,
  vectorOptionsOf,
  vectorPlotBox,
} from "@enumeratio/frontend";
import { compilePlot } from "@enumeratio/frontend/plot-compile";
import type { PlotPoint, Session } from "./engine.ts";
import { figureText, plotText, type Sampled } from "./figure.ts";

type Json = Parameters<typeof headOf>[0];

/** The points an `Epilog` draws: `Point((x, y))`, or a list with some in it. */
function pointsOf(epilog: Json): PlotPoint[] {
  if (epilog === undefined) return [];
  if (headOf(epilog) === "Point") {
    const [x, y] = tupleOf(opsOf(epilog)[0])?.map(numOf) ?? [];
    return x === undefined || y === undefined ? [] : [{ x, y }];
  }
  return headOf(epilog) === "List" ? opsOf(epilog).flatMap(pointsOf) : [];
}

/** `Plot(f, (x, a, b))` read off: the body as notatio-ready MathJSON, its variable and range. */
export function plotOf(
  json: Json,
): { body: Json; variable: string; from: number; to: number; marks: PlotPoint[] } | undefined {
  if (headOf(json) !== "Plot") return undefined;
  const [body, iterator] = opsOf(json);
  const { options } = optionsOf(json as never);
  if (body === undefined) return undefined;
  const parts = tupleOf(iterator) ?? [];
  const variable = symOf(parts[0]) ?? "x";
  const from = numOf(parts[1]) ?? -5;
  const to = numOf(parts[2]) ?? 5;
  return { body, variable, from, to, marks: pointsOf(options.Epilog) };
}

/** A `Plot` result sampled with the session, with its `Epilog` marks, if it is one. */
export function sampledPlot(session: Session, json: Json): Sampled | undefined {
  const plot = plotOf(json);
  const points = samplePlot(session, json);
  return plot === undefined || points === undefined ? undefined : { points, marks: plot.marks };
}

/** Sample a `Plot` result with the session, if it is one. */
export function samplePlot(session: Session, json: Json): PlotPoint[] | undefined {
  const plot = plotOf(json);
  if (plot === undefined) return undefined;
  return session.sampleJson(plot.body, { variable: plot.variable, from: plot.from, to: plot.to });
}

/** Arrows and streamline seeds per side on cells, unless `N` says otherwise. */
const TERMINAL_ARROWS = 8;
const TERMINAL_STREAMS = 4;

/** A bare compute-engine's helpers for compiled JavaScript (`_SYS`: integer powers, gamma, …). */
const systemHelpers = (ce: Session["ce"]): unknown =>
  (new JavaScriptTarget().compile(ce.box(["Power", "x", 3])).run as unknown as { SYS: unknown }).SYS;

/** `component` as a function of the plot's two variables: compiled JavaScript, else `subs` and `N`. */
function componentSampler(
  session: Session,
  component: Json,
  [vx, vy]: readonly [string, string],
): (x: number, y: number) => number {
  const { ce } = session;
  const [item] = compilePlot(ce, component, { target: "javascript", vars: [vx, vy] }).items;
  if (item?.code !== undefined && !item.code.includes("_.__")) {
    // oxlint-disable-next-line no-implied-eval -- the code is compute-engine's compiled output
    const fn = new Function("_SYS", "_", `return (${item.code});`) as (sys: unknown, scope: object) => unknown;
    const sys = systemHelpers(ce);
    return (x, y) => {
      const v = fn(sys, { [vx]: x, [vy]: y });
      return typeof v === "number" ? v : Number.NaN;
    };
  }
  const expr = ce.box(component as never);
  return (x, y) => expr.subs({ [vx]: ce.number(x), [vy]: ce.number(y) }).N().re;
}

/**
 * A `VectorPlot` or `StreamPlot` result sampled with the session: the `GraphicsBox` of its arrows
 * or streamlines, if it is one and its field is a pair.
 */
export function sampledField(session: Session, json: Json): Box | undefined {
  const head = headOf(json);
  if (head !== "VectorPlot" && head !== "StreamPlot") return undefined;
  const settings = plotSettingsOf(plainJson(json) as never);
  const parts = tupleOf(opsOf(json)[0]);
  if (settings === undefined || parts?.length !== 2) return undefined;
  const vars = [settings["xvar"] || "x", settings["yvar"] || "y"] as const;
  const [u, v] = parts.map((part) => componentSampler(session, part, vars));
  const { x, y, options } = vectorOptionsOf(settings);
  // A cell is 2 × 4 dots: the page's grid would be a smear, so a terminal's default is sparser.
  const n = options.n ?? (options.type === "stream" ? TERMINAL_STREAMS : TERMINAL_ARROWS);
  return vectorPlotBox((px, py) => [u!(px, py), v!(px, py)], x[0], x[1], y[0], y[1], { ...options, n });
}

/**
 * The result as text: a plot or a figure drawn on cells, else the session's rendering. A plot a
 * pipe pinned comes back `Labeled` with its caption, and keeps it under the cells.
 */
export function textOf(session: Session, json: Json, width = 60, height = 12): string {
  if (headOf(json) === "Labeled") {
    const [body, label] = opsOf(json);
    const caption = strOf(label);
    if (body !== undefined && caption !== undefined && plotOf(body) !== undefined)
      return `${textOf(session, body, width, height)}\n  ${caption}`;
  }
  const sampled = sampledPlot(session, json);
  if (sampled !== undefined) return plotText(sampled, { width, height });
  const figure = figureText(json, {
    width,
    field: (field) => sampledField(session, field),
    notation: notationOf(session.ce),
    evaluate: (pinned) => session.render(session.ce.box(pinned as never).evaluate()),
  });
  if (figure !== undefined) return figure;
  return session.render(session.ce.box(json as never).evaluate());
}
