// @enumeratio/hecke's heads in traditional notation: H_n(q) and its standard basis T_w,
// indexed by a permutation's one-line word.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { type Box, type Notation, scalars, subscript, type PackageNotation } from "@enumeratio/boxes";

/** A literal list of numbers, or `undefined`. */
const numbers = (x: MathJsonExpression | undefined): number[] | undefined => {
  if (!Array.isArray(x) || x[0] !== "List") return undefined;
  const items = (x as readonly unknown[]).slice(1);
  return items.every((e) => typeof e === "number") ? (items as number[]) : undefined;
};

/** A permutation in one-line notation: `213`, or `[10,2,…]` past one digit. */
const oneLine = (x: MathJsonExpression | undefined): Box | undefined => {
  const w = numbers(x);
  if (w === undefined) return undefined;
  return w.every((k) => k >= 0 && k <= 9) ? w.join("") : `[${w.join(",")}]`;
};

export const HECKE_NOTATION: Notation = {
  HeckeAlgebra: scalars(([n, ...rest], write) =>
    n === undefined || rest.length > 0 ? undefined : write.call(subscript("H", write.box(n)), ["q"]),
  ),
  // The word is the index, so it writes even carrying a literal list.
  HeckeT: ([w, ...rest]) => {
    const index = rest.length === 0 ? oneLine(w) : undefined;
    return index === undefined ? undefined : subscript("T", index);
  },
};

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { traditional: HECKE_NOTATION };
