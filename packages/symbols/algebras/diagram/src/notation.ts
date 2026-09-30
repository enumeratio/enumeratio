// @enumeratio/diagram's heads in traditional notation: the diagram-algebra family, each
// `symbol_{n}`, or `symbol_{n}(δ)` with the loop parameter.

import { type Box, fence, type Notation, type NotationRule, row, scalars, subscript } from "@enumeratio/boxes";

/** A family of algebras on `n` strands, `symbol_{n}`, or `symbol_{n}(parameter)`. */
const algebra =
  (symbol: Box): NotationRule =>
  ([n, parameter, ...rest], write) => {
    if (n === undefined || rest.length > 0) return undefined;
    const base = subscript(symbol, write.box(n));
    return parameter === undefined ? base : write.call(base, [parameter]);
  };

export const DIAGRAM_NOTATION: Notation = {
  PartitionAlgebra: scalars(algebra("P")),
  PlanarPartitionAlgebra: scalars(algebra("PP")),
  BrauerAlgebra: scalars(algebra("B")),
  TemperleyLiebAlgebra: scalars(algebra("TL")),
  MotzkinAlgebra: scalars(algebra("M")),
  RookAlgebra: scalars(algebra("R")),
  SymmetricGroupAlgebra: scalars(([n, ...rest], write) =>
    n === undefined || rest.length > 0 ? undefined : row(["k", fence("[", [subscript("S", write.box(n))], "]")]),
  ),
};
