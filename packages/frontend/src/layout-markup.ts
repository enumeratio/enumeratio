// A closed layout as markup (https://github.com/enumeratio/enumeratio/wiki/Speculative-Box-Primitives, §2): the grid of typeset
// leaves an evaluated `Grid`, `Row` or `Column` of closed math draws as. The Out draws it in the browser
// and a build writes it into the page ahead of that, so both come from here.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import type { Box } from "@enumeratio/boxes";
import { markupOf } from "./box-leaf.ts";
import { renderBox } from "./box-render.ts";
import { ENVIRONMENTS, type Environment, WEB } from "./environment.ts";
import { reduce } from "./reduce.ts";
import { staticLayoutBoxes } from "./symbols.ts";

/** What typesets the layout's math, and what the value is known to be. */
export interface LayoutLeaves {
  /** TeX to markup: a host's typesetter. */
  readonly typeset: (tex: string) => string;
  /** The value is the Out's evaluated answer, so a closed cell of a layout is final. */
  readonly evaluated: boolean;
  /** The value's traditional boxes, as the kernel wrote them with its packages' notation. */
  readonly written?: Box;
}

/**
 * `json` drawn for `env` as a layout of typeset leaves, or `undefined` when it isn't one: a layout
 * with a cell that may change with the page, or that draws, stays live. `reduced` is `json` already
 * reduced for `env`, for a caller that needs it too.
 */
export function layoutMarkup(
  json: MathJsonExpression,
  env: Environment,
  leaves: LayoutLeaves,
  reduced: MathJsonExpression = reduce(json, env),
): string | undefined {
  const unchanged = reduced === json || JSON.stringify(reduced) === JSON.stringify(json);
  const box = staticLayoutBoxes(reduced, leaves.evaluated, unchanged ? leaves.written : undefined);
  return box === undefined ? undefined : markupOf(renderBox(box), leaves.typeset);
}

/**
 * `layoutMarkup` for a page that may be read in any environment: only when no environment reduces
 * `json` to something else (a `Row` is a `Column` on a compact screen), so what the page shows
 * first is what each reader's Out draws.
 */
export function layoutMarkupEverywhere(json: MathJsonExpression, leaves: LayoutLeaves): string | undefined {
  const written = JSON.stringify(json);
  if (ENVIRONMENTS.some((env) => JSON.stringify(reduce(json, env)) !== written)) return undefined;
  return layoutMarkup(json, WEB, leaves);
}
