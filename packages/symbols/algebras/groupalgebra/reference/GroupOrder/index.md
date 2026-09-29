---
name: GroupOrder
domain: Permutations
signature: GroupOrder(group)
summary: "$|G|$: how many elements a group has. Works over every carrier this package knows — [[CyclicGroup]], [[DihedralGroup]], [[GroupDirectProduct]], [[SymmetricGroup]], [[AlternatingGroup]] and [[PermutationGroup]]."
signatures:
  - call: GroupOrder(group)
    description: the number of elements of `group`
    library: enumeratio-groupalgebra
    type: (expression<AlternatingGroup> | expression<CyclicGroup> | expression<DihedralGroup> | expression<GroupDirectProduct> | expression<PermutationGroup> | expression<SymmetricGroup> | indexed_collection<list<integer>>) -> integer
seeAlso:
  - GroupElements
  - PermutationGroup
  - DihedralGroup
  - CyclicGroup
  - SymmetricGroup
  - AlternatingGroup
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: oscar
    template: order(($1).G)
    arity: 1
---

- For a `PermutationGroup`, the order comes from a breadth-first closure over its generators, not a stored table
- `GroupOrder(SymmetricGroup(n))` is $n!$, and `GroupOrder(AlternatingGroup(n))` is $n!/2$, without materialising the permutations
