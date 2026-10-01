// @enumeratio/quiver's heads in traditional notation: the linearly oriented A_n and the
// path algebra kQ.

import { type Notation, overscript, row, scalars, subscript, type PackageNotation } from "@enumeratio/boxes";

export const QUIVER_NOTATION: Notation = {
  LinearQuiver: scalars(([n, ...rest], write) =>
    n === undefined || rest.length > 0 ? undefined : subscript(overscript("A", "→"), write.box(n)),
  ),
  PathAlgebra: scalars(([q, ...rest], write) =>
    q === undefined || rest.length > 0 ? undefined : row(["k", write.box(q)]),
  ),
};

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { traditional: QUIVER_NOTATION };
