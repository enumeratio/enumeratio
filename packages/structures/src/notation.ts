// @enumeratio/structures' heads in traditional notation: an algebra's dimension, dim(A).

import { named, type Notation, scalars } from "@enumeratio/boxes";

export const STRUCTURES_NOTATION: Notation = {
  AlgebraDimension: scalars(named("dim", 1)),
};
