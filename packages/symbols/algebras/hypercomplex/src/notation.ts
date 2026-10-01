// @enumeratio/hypercomplex's heads in traditional notation: the Clifford algebra Cl_{p,q}(R)
// and the multicomplex tower C_n.

import { fence, indexed, type Notation, row, scalars, subscript, type PackageNotation } from "@enumeratio/boxes";

export const HYPERCOMPLEX_NOTATION: Notation = {
  CliffordAlgebra: scalars(([p, q, ...rest], write) =>
    p === undefined || q === undefined || rest.length > 0
      ? undefined
      : row([subscript("Cl", row([write.box(p), ",", write.box(q)])), fence("(", ["ℝ"], ")")]),
  ),
  MulticomplexAlgebra: scalars(indexed("ℂ")),
};

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { traditional: HYPERCOMPLEX_NOTATION };
