---
name: GroupIsAbelian
domain: Oracle
signature: GroupIsAbelian(...)
summary: Mapped through to oscar for the oracle; not yet written up here.
bindings:
  - origin: mapped
    form: oscar
    template: is_abelian(($1).G)
    arity: 1
  - origin: mapped
    form: sage
    template: enumeratio_is_abelian($1)
    arity: 1
  - origin: mapped
    form: wolfram
    template: "With[{g = GroupGenerators[$1]}, And @@ Flatten[Outer[PermutationProduct[#1, #2] === PermutationProduct[#2, #1] &, g, g]]]"
    arity: 1
    note: Wolfram has no abelian test for a permutation group; a group is abelian when its generators commute, which `PermutationProduct` decides on canonical `Cycles`.
stub: carrier
signatures:
  - call: GroupIsAbelian(...)
    description: Mapped through to oscar for the oracle; not yet written up here.
    library: enumeratio-groupalgebra
    type: (expression<CyclicGroup> | expression<DihedralGroup> | expression<GroupDirectProduct>) -> boolean
---
