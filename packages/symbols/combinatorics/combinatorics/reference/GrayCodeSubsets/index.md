---
name: GrayCodeSubsets
domain: Collections
signature: GrayCodeSubsets(n)
summary: 'The subsets of $\{1, \dots, n\}$ in binary-reflected Gray-code order: consecutive subsets differ by exactly one element.'
signatures:
  - call: GrayCodeSubsets(n)
    description: the subsets of $\{1, \dots, n\}$ in binary-reflected Gray-code order
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<list<integer>>
seeAlso:
  - Subsets
  - GrayCodes
bindings:
  - origin: mapped
    form: combinatorica
    template: "Map[Sort[$1 + 1 - #] &, GrayCodeSubsets[Range[$1]]]"
    arity: 1
    note: Combinatorica's Gray code runs the other way round, from the last element; reflecting each element i to n + 1 - i gives ours.
---
