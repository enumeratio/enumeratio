---
name: GroupDirectProduct
domain: Oracle
signature: GroupDirectProduct(...)
summary: Mapped through to oscar for the oracle; not yet written up here.
bindings:
  - origin: mapped
    form: oscar
    template: enumeratio_direct_product($1, $2)
    arity: 2
  - origin: mapped
    form: sage
    template: enumeratio_direct($1, $2)
    arity: 2
  - origin: mapped
    form: wolfram
    template: With[{a = $1, b = $2}, With[{d = Max[0, Cases[GroupGenerators[a], _Integer, Infinity]]}, PermutationGroup[Join[GroupGenerators[a], GroupGenerators[b] /. Cycles[l_] :> Cycles[Map[# + d &, l, {2}]]]]]]
    arity: 2
    note: Wolfram has no direct product of permutation groups; the second factor's points are shifted past the first's, so the two act on disjoint points. Elements carry no `a/b` labels there, so only order, abelian-ness and class counts compare.
stub: carrier
signatures:
  - call: GroupDirectProduct(...)
    description: Mapped through to oscar for the oracle; not yet written up here.
    library: enumeratio-groupalgebra
    type: (expression<CyclicGroup> | expression<DihedralGroup> | expression<GroupDirectProduct>, expression<CyclicGroup> | expression<DihedralGroup> | expression<GroupDirectProduct>) -> expression<GroupDirectProduct>
---
