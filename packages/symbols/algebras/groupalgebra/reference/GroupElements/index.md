---
name: GroupElements
domain: Permutations
signature: GroupElements(group)
summary: Every element of a group, or — for a [[PermutationGroup]] or [[AlternatingGroup]] with a second, list argument — the elements at those positions (`Part`-style, negative counts from the end).
signatures:
  - call: GroupElements(group)
    description: all of `group`'s elements
    library: enumeratio-groupalgebra
    type: (expression<AlternatingGroup> | expression<CyclicGroup> | expression<DihedralGroup> | expression<GroupDirectProduct> | expression<PermutationGroup>, list<integer>?) -> list<expression>
  - call: GroupElements(group, positions)
    description: a `PermutationGroup`'s or `AlternatingGroup`'s elements at `positions`, in its own order
    library: enumeratio-groupalgebra
seeAlso:
  - GroupOrder
  - PermutationGroup
  - AlternatingGroup
  - GroupGenerators
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_group_elements($1)
    arity: 1
    note: Sage lists a group in its own order; the elements are sorted by one-line word, as Wolfram's `GroupElements` and ours order them.
  - origin: mapped
    form: sage
    template: enumeratio_group_elements($1, $2)
    arity: 2
---

- A `PermutationGroup`'s or `AlternatingGroup`'s elements print as [[Cycles]], not as [[GroupBasis]] labels — its elements are permutations, not abstract group-algebra basis vectors
- The identity always comes first; the rest follow the ascending order of their one-line words
