// @enumeratio/groupalgebra's heads in traditional notation: the cyclic and dihedral
// families by order, the group algebra k[G], the direct product, and |G|.

import { fence, indexed, type Notation, row, scalars } from "@enumeratio/boxes";

export const GROUPALGEBRA_NOTATION: Notation = {
  CyclicGroup: scalars(indexed("C")),
  DihedralGroup: scalars(indexed("D")),
  GroupDirectProduct: scalars((args, write) => {
    if (args.length < 2) return undefined;
    return row(args.flatMap((a, i) => (i === 0 ? [write.box(a)] : ["×", write.box(a)])));
  }),
  GroupAlgebra: scalars(([g, ...rest], write) =>
    g === undefined || rest.length > 0 ? undefined : row(["k", fence("[", [write.box(g)], "]")]),
  ),
  GroupOrder: scalars(([g, ...rest], write) =>
    g === undefined || rest.length > 0 ? undefined : fence("|", [write.box(g)], "|"),
  ),
};
