// @enumeratio/incidence's heads in traditional notation: the poset families by size, the
// incidence algebra I(P), and the Möbius function μ_P(x, y).

import { indexed, named, type Notation, scalars, subscript, type PackageNotation } from "@enumeratio/boxes";

export const INCIDENCE_NOTATION: Notation = {
  DivisorLattice: scalars(indexed("D")),
  BooleanLattice: scalars(indexed("B")),
  Chain: scalars(indexed("C")),
  IncidenceAlgebra: scalars(named("I", 1)),
  MoebiusFunction: scalars(([poset, x, y, ...rest], write) =>
    poset === undefined || x === undefined || y === undefined || rest.length > 0
      ? undefined
      : write.call(subscript("μ", write.box(poset)), [x, y]),
  ),
};

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { traditional: INCIDENCE_NOTATION };
