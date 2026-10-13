---
name: BinaryStrings
domain: Collections
signature: BinaryStrings(n)
summary: The $2^n$ binary strings of length $n$, in standard binary counting order.
signatures:
  - call: BinaryStrings(n)
    description: the binary strings of length $n$
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<list<integer>>
seeAlso:
  - BinaryWords
bindings:
  - origin: mapped
    form: combinatorica
    template: Map[Function[s, Table[Boole[MemberQ[s, i]], {i, $1}]], BinarySubsets[Range[$1]]]
    arity: 1
    note: Combinatorica lists binary counting as subsets; the word of a subset has a 1 at each element.
---
