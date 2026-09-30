// @enumeratio/number-theory's heads in traditional notation: the p-adic valuation v_b(n).

import { type Notation, scalars, subscript } from "@enumeratio/boxes";

export const NUMBER_THEORY_NOTATION: Notation = {
  IntegerExponent: scalars(([n, b, ...rest], write) =>
    n === undefined || rest.length > 0
      ? undefined
      : write.call(subscript("v", b === undefined ? "10" : write.box(b)), [n]),
  ),
};
