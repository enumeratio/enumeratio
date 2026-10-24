---
name: GroupProduct
domain: Oracle
signature: GroupProduct(...)
summary: Mapped through to oscar for the oracle; not yet written up here.
bindings:
  - origin: mapped
    form: oscar
    template: enumeratio_product($1, $2, $3)
    arity: 3
  - origin: mapped
    form: sage
    template: enumeratio_group_product($1, $2, $3)
    arity: 3
  - origin: mapped
    form: wolfram
    counterpart: false
    note: The product of two labeled basis elements of our group algebra (`GroupBasis`); Wolfram has no group algebra and no labels, only `PermutationProduct` on the permutations themselves.
    checked:
      version: 15.0.0
      on: 2026-10-23
stub: carrier
signatures:
  - call: GroupProduct(...)
    description: Mapped through to oscar for the oracle; not yet written up here.
    library: enumeratio-groupalgebra
    type: (expression<CyclicGroup> | expression<DihedralGroup> | expression<GroupDirectProduct>, expression, expression) -> expression
---
