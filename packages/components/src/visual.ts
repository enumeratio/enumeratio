import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import type { Box } from "@enumeratio/boxes";
import { type Environment, markupOf, reduce, renderBox, renderingOf, staticLayoutBoxes } from "@enumeratio/frontend";

/** What typesets the math in a picture: a host's typesetter, and the value's boxes where it has them. */
export interface Leaves {
  readonly typeset: (tex: string) => string;
  /** The value is the Out's evaluated answer, so a closed cell of a layout is final. */
  readonly evaluated: boolean;
  /** The value's traditional boxes, as the kernel wrote them with its packages' notation. */
  readonly written?: Box;
}

/**
 * The picture an Out draws for its value, reduced for `env` first: on paper or down a
 * pipe a control is pinned or sampled rather than drawn live and unmovable. Empty when
 * the value is not a head that draws. An evaluated layout of closed math (a `Grid` of numbers and
 * formulas) is drawn from its boxes, its cells typeset leaves; a cell that may change with the
 * page stays a readout.
 */
export function visualMarkup(json: MathJsonExpression, env: Environment, leaves?: Leaves): string {
  const reduced = reduce(json, env);
  if (leaves !== undefined) {
    const unchanged = reduced === json || JSON.stringify(reduced) === JSON.stringify(json);
    const box = staticLayoutBoxes(reduced, leaves.evaluated, unchanged ? leaves.written : undefined);
    if (box !== undefined) return markupOf(renderBox(box), leaves.typeset);
  }
  const rendering = renderingOf(reduced);
  return rendering === undefined ? "" : markupOf(rendering, leaves?.typeset);
}
