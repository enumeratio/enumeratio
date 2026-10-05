// @enumeratio/numerals' heads in traditional notation: the p-adic valuation and norm read
// off a literal `AdicNumeral(p, x, …)`, naming the prime once as a subscript.

import type { Json } from "@enumeratio/engine";
import { fence, type Notation, scalars, subscript, type PackageNotation } from "@enumeratio/boxes";

/** A literal `AdicNumeral(p, x, …)` as its prime and value: `v_p(x)` names the prime once. */
const adic = (x: Json | undefined): { p: number; value: Json } | undefined =>
  Array.isArray(x) && x[0] === "AdicNumeral" && typeof x[1] === "number" && x[2] !== undefined
    ? { p: x[1], value: x[2] as Json }
    : undefined;

export const NUMERALS_NOTATION: Notation = {
  AdicValuation: scalars(([x, ...rest], write) => {
    const a = adic(x);
    return a === undefined || rest.length > 0 ? undefined : write.call(subscript("v", String(a.p)), [a.value]);
  }),
  AdicNorm: scalars(([x, ...rest], write) => {
    const a = adic(x);
    return a === undefined || rest.length > 0
      ? undefined
      : subscript(fence("|", [write.box(a.value)], "|"), String(a.p));
  }),
};

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { traditional: NUMERALS_NOTATION };
