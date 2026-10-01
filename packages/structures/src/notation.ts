// @enumeratio/structures' heads in traditional notation: an algebra's dimension, dim(A).

import { named, type Notation, scalars, type PackageNotation } from "@enumeratio/boxes";

export const STRUCTURES_NOTATION: Notation = {
  AlgebraDimension: scalars(named("dim", 1)),
};

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { traditional: STRUCTURES_NOTATION };
