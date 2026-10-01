// @enumeratio/modular's heads in traditional notation: PSL(2,Z) matrices, Dedekind sums,
// class numbers, the Rademacher functions. (KroneckerSymbol is compute-engine's own head,
// so its Legendre-family notation lives in @enumeratio/boxes' ENGINE_NOTATION.)

import { fence, grid, named, type Notation, scalars, type PackageNotation } from "@enumeratio/boxes";

export const MODULAR_NOTATION: Notation = {
  ModularMatrix: scalars((args, write) =>
    args.length === 4
      ? fence(
          "(",
          [
            grid([
              [write.box(args[0]!), write.box(args[1]!)],
              [write.box(args[2]!), write.box(args[3]!)],
            ]),
          ],
          ")",
        )
      : undefined,
  ),
  DedekindSum: scalars(named("s", 2)),
  FormClassNumber: scalars(named("h", 1)),
  RademacherPhi: scalars(named("Φ", 1)),
  RademacherSymbol: scalars(named("Ψ", 1)),
};

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { traditional: MODULAR_NOTATION };
