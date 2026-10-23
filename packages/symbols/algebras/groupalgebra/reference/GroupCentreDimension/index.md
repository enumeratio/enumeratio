---
name: GroupCentreDimension
domain: Oracle
signature: GroupCentreDimension(...)
summary: Mapped through to oscar for the oracle; not yet written up here.
bindings:
  - origin: mapped
    form: oscar
    template: number_of_conjugacy_classes(($1).G)
    arity: 1
  - origin: mapped
    form: sage
    template: enumeratio_centre_dimension($1)
    arity: 1
    note: The number of conjugacy classes, which is the dimension of the centre of the group algebra.
  - origin: mapped
    form: wolfram
    template: "With[{G = $1}, Total[GroupOrder[GroupCentralizer[G, #]] & /@ GroupElements[G]]/GroupOrder[G]]"
    arity: 1
    note: Wolfram has no conjugacy classes; the number of them is the average size of a centralizer (Burnside), from `GroupCentralizer`.
stub: carrier
signatures:
  - call: GroupCentreDimension(...)
    description: Mapped through to oscar for the oracle; not yet written up here.
    library: enumeratio-groupalgebra
    type: (expression<CyclicGroup> | expression<DihedralGroup> | expression<GroupDirectProduct>) -> integer
---
