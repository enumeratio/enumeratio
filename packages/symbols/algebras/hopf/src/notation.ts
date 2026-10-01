// @enumeratio/hopf's heads in traditional notation: the coalgebra operations (Δ, ε, S,
// ⊗), and the NSym/QSym bases indexed by composition.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import {
  type Box,
  named,
  type Notation,
  type NotationRule,
  row,
  scalars,
  subscript,
  type PackageNotation,
} from "@enumeratio/boxes";

/** A literal list of numbers, or `undefined`. */
const numbers = (x: MathJsonExpression | undefined): number[] | undefined => {
  if (!Array.isArray(x) || x[0] !== "List") return undefined;
  const items = (x as readonly unknown[]).slice(1);
  return items.every((e) => typeof e === "number") ? (items as number[]) : undefined;
};

/** A composition as it is subscripted: `(1,2)`, or `∅` for the empty one. */
const composition = (x: MathJsonExpression | undefined): Box | undefined => {
  const parts = numbers(x);
  if (parts === undefined) return undefined;
  return parts.length === 0 ? "∅" : `(${parts.join(",")})`;
};

/** A basis element of a composition-indexed basis, `symbol_{(1,2)}`. */
const byComposition =
  (symbol: Box): NotationRule =>
  ([alpha, ...rest]) => {
    const index = rest.length === 0 ? composition(alpha) : undefined;
    return index === undefined ? undefined : subscript(symbol, index);
  };

export const HOPF_NOTATION: Notation = {
  Coproduct: scalars(named("Δ", 1)),
  Counit: scalars(named("ε", 1)),
  Antipode: scalars(named("S", 1)),
  HopfTensor: scalars((args, write) => {
    if (args.length < 2) return undefined;
    return row(args.flatMap((a, i) => (i === 0 ? [write.tight(a)] : ["⊗", write.tight(a)])));
  }),
  // The composition is the index, so these write even carrying a literal list.
  QSymM: byComposition("M"),
  QSymF: byComposition("F"),
  NSymH: byComposition("H"),
  NSymR: byComposition("R"),
};

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { traditional: HOPF_NOTATION };
