// A "Try it" panel's source: an example's typed literals as a Manipulate -- the `params`
// tuples (typed: integer step, `Boolean`, …) and the body as a template over their slots.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { type HeadSignature, inferFromSignature, paramsOf } from "./infer-controls.ts";
import { epsil } from "./mathjson.ts";
import { slotted } from "./symbols.ts";

export interface TryIt {
  /** `<notatio-manipulate params>`: one tuple per lifted argument. */
  readonly params: string;
  /** The body, as Epsil over the slots (`IntegerPartitions(_n)`), for a `<dynamic-box value>`. */
  readonly value: string;
}

/** What a derived explorer gives Try it (`explorerOf`'s `template` and `size`, as the page carries them). */
export interface ExplorerSizing {
  /** The call with its size as `{size}`: `Derangements({size})`. */
  readonly template?: string;
  readonly size?: { readonly name?: string; readonly min: number; readonly max: number; readonly start: number };
}

/** The argument position `{size}` takes in a template, or undefined when it has none. */
export function sizeIndexOf(template: string | undefined): number | undefined {
  const args = /^[A-Za-z0-9]+\((.*)\)$/s.exec(template ?? "")?.[1]?.split(",");
  const at = args?.findIndex((a) => a.trim() === "{size}");
  return at === undefined || at < 0 ? undefined : at;
}

/** `signature` with the explorer's stepper bounds on the size argument, so Try it and the table agree. */
export function withExplorerSize(signature: HeadSignature, explorer: ExplorerSizing | undefined): HeadSignature {
  const index = sizeIndexOf(explorer?.template);
  if (explorer?.size === undefined || index === undefined) return signature;
  return { ...signature, size: { min: explorer.size.min, max: explorer.size.max, index } };
}

/** The panel when no example lifts: the explorer's sized call, its size control the stepper's (start, min, max). */
export function tryItOfExplorer(explorer: ExplorerSizing | undefined): TryIt | undefined {
  const { template, size } = explorer ?? {};
  if (template === undefined || size === undefined || sizeIndexOf(template) === undefined) return undefined;
  const name = size.name !== undefined && /^\p{Ll}\w*$/u.test(size.name) ? size.name : "n";
  const params = paramsOf({
    name,
    domain: { kind: "integers", min: size.min, max: size.max },
    start: size.start,
    controlType: "Slider",
  });
  return params === undefined ? undefined : { params, value: template.replace("{size}", `_${name}`) };
}

/** The panel for `expr` (an example) over its head's typed signature; undefined when no argument lifts. */
export function tryItOf(expr: MathJsonExpression, signature: HeadSignature): TryIt | undefined {
  const { body, specs } = inferFromSignature(expr, signature);
  const tuples = specs.map((spec) => ({ name: spec.name, params: paramsOf(spec) }));
  const drawn = tuples.filter((t): t is { name: string; params: string } => t.params !== undefined);
  if (drawn.length === 0) return undefined;
  return {
    params: drawn.map((t) => t.params).join("; "),
    value: epsil(slotted(body as MathJsonExpression, new Set(drawn.map((t) => t.name)))),
  };
}
