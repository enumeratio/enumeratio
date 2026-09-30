// @enumeratio/analytic's heads in traditional notation: Barnes G, Clausen, Dirichlet
// L-functions, Pochhammer-style factorials, harmonic numbers, the Stieltjes constants.

import {
  fence,
  indexed,
  named,
  type Notation,
  overscript,
  row,
  scalars,
  subscript,
  subscripted,
  superscript,
  underscript,
} from "@enumeratio/boxes";

export const ANALYTIC_NOTATION: Notation = {
  StieltjesGamma: scalars(indexed("γ")),
  HarmonicNumber: scalars(([n, r, ...rest], write) => {
    if (n === undefined || rest.length > 0) return undefined;
    const base = subscript("H", write.box(n));
    return r === undefined ? base : superscript(base, fence("(", [write.box(r)], ")"));
  }),
  BarnesG: scalars(named("G", 1)),
  LogBarnesG: scalars(named(row(["log", "G"]), 1)),
  LogGamma: scalars(named(row(["log", "Γ"]), 1)),
  DirichletEta: scalars(named("η", 1)),
  DirichletBeta: scalars(named("β", 1)),
  DirichletCharacter: scalars(([k, j, n, ...rest], write) =>
    k === undefined || j === undefined || n === undefined || rest.length > 0
      ? undefined
      : write.call(subscript("χ", row([write.box(k), ",", write.box(j)])), [n]),
  ),
  DirichletL: scalars(([k, j, z, ...rest], write) =>
    k === undefined || j === undefined || z === undefined || rest.length > 0
      ? undefined
      : row(["L", fence("(", [write.box(z), ", ", subscript("χ", row([write.box(k), ",", write.box(j)]))], ")")]),
  ),
  ClausenCl: scalars(subscripted("Cl", 2)),
  // Rising = overline, falling = underline, as Wolfram's Pochhammer-family notation.
  FallingFactorial: scalars(([x, n, ...rest], write) =>
    x === undefined || n === undefined || rest.length > 0
      ? undefined
      : superscript(write.tight(x), underscript(write.box(n), "_")),
  ),
  RisingFactorial: scalars(([x, n, ...rest], write) =>
    x === undefined || n === undefined || rest.length > 0
      ? undefined
      : superscript(write.tight(x), overscript(write.box(n), "‾")),
  ),
};
