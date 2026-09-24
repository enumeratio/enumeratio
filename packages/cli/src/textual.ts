// The text surface's reading of a result: a `Plot` head, sampled by the session and
// drawn on braille cells, for a terminal without an image protocol and for a pipe.
// The Node host prefers an inline image where the terminal has one; this is what
// stands in where it does not, and what the control strip draws under itself.

import { headOf, numOf, opsOf, strOf, symOf, tupleOf } from "../../notatio/src/symbols.ts";
import { textPlot } from "../../notatio/src/textplot.ts";
import type { PlotPoint, Session } from "./engine.ts";

type Json = Parameters<typeof headOf>[0];

/** `Plot(f, (x, a, b))` read off: the body as notatio-ready MathJSON, its variable and range. */
export function plotOf(
  json: Json,
): { body: Json; variable: string; from: number; to: number } | undefined {
  if (headOf(json) !== "Plot") return undefined;
  const [body, iterator] = opsOf(json);
  if (body === undefined) return undefined;
  const parts = tupleOf(iterator) ?? [];
  const variable = symOf(parts[0]) ?? "x";
  const from = numOf(parts[1]) ?? -5;
  const to = numOf(parts[2]) ?? 5;
  return { body, variable, from, to };
}

/** Sample a `Plot` result with the session, if it is one. */
export function samplePlot(session: Session, json: Json): PlotPoint[] | undefined {
  const plot = plotOf(json);
  if (plot === undefined) return undefined;
  return session.sampleJson(plot.body, { variable: plot.variable, from: plot.from, to: plot.to });
}

/**
 * The result as text: a plot drawn on cells, else the session's rendering. A plot a
 * pipe pinned comes back `Labeled` with its caption, and keeps it under the cells.
 */
export function textOf(session: Session, json: Json, width = 60): string {
  if (headOf(json) === "Labeled") {
    const [body, label] = opsOf(json);
    const caption = strOf(label);
    if (body !== undefined && caption !== undefined && plotOf(body) !== undefined)
      return `${textOf(session, body, width)}\n  ${caption}`;
  }
  const points = samplePlot(session, json);
  if (points !== undefined) return textPlot(points, { width, height: 12 });
  return session.render(session.ce.box(json as never).evaluate());
}
