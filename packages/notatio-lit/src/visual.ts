import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { type Environment, markupOf, reduce, renderingOf } from "@enumeratio/notatio";

/**
 * The picture an Out draws for its value, reduced for `env` first: on paper or down a
 * pipe a control is pinned or sampled rather than drawn live and unmovable. Empty when
 * the value is not a head that draws.
 */
export function visualMarkup(json: MathJsonExpression, env: Environment): string {
  const rendering = renderingOf(reduce(json, env));
  return rendering === undefined ? "" : markupOf(rendering);
}
