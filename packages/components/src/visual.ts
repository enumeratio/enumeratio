import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { type Environment, layoutMarkup, type LayoutLeaves, markupOf, reduce, renderingOf } from "@enumeratio/frontend";

/** What typesets the math in a picture: a host's typesetter, and the value's boxes where it has them. */
export type Leaves = LayoutLeaves;

/**
 * The picture an Out draws for its value, reduced for `env` first: on paper or down a
 * pipe a control is pinned or sampled rather than drawn live and unmovable. Empty when
 * the value is not a head that draws. An evaluated layout of closed math (a `Grid` of numbers and
 * formulas) is drawn from its boxes, its cells typeset leaves; a cell that may change with the
 * page stays a readout.
 */
export function visualMarkup(json: MathJsonExpression, env: Environment, leaves?: Leaves): string {
  const reduced = reduce(json, env);
  const laid = leaves === undefined ? undefined : layoutMarkup(json, env, leaves, reduced);
  if (laid !== undefined) return laid;
  const rendering = renderingOf(reduced);
  return rendering === undefined ? "" : markupOf(rendering, leaves?.typeset);
}
