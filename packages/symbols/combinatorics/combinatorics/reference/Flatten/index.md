---
name: Flatten
domain: Collections
signature: Flatten(collection)
summary: The collection with all levels of nested lists merged into one.
signatures:
  - call: Flatten(collection)
    description: every level of nested lists merged into one.
  - call: Flatten(collection, n)
    description: flattening limited to the top `n` levels.
  - call: Flatten(collection, PositiveInfinity)
    description: an explicit infinite depth, the same as the default.
    library: enumeratio-combinatorics
    type: (any, any?) -> any
    overrides: compute-engine
  - call: Flatten(collection, {{p1}, {p2}, …})
    description: a permutation-shaped list of levels regroups the array's dimensions — transposing a matrix, say.
    library: enumeratio-combinatorics
  - call: Flatten(expr)
    description: nested calls of any one head flatten, not just $List$'s.
    library: enumeratio-combinatorics
seeAlso:
  - Join
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: mathlib4
    template: "(($1 : List (List ℚ)).flatten)"
    arity: 1
    note: A list of lists of numbers, merged one level, which is every level there is. Deeper or ragged nesting and a flat list fail to elaborate, since Lean types them differently from ours.
  - origin: mapped
    form: mathlib4
    template: "(have _ : ($2 : ℤ) ≥ 1 := (by decide); ($1 : List (List ℚ)).flatten)"
    arity: 2
    note: A depth of one or more over a list of lists of numbers, where that is the same as flattening fully. Depth zero or a negative depth fails to elaborate, as does any nesting deeper than two levels.
---

- Undoes [[Partition]]: chunking and then re-flattening recovers the original list.
- Simply deletes inner braces/levels; it doesn't otherwise reorder or transform elements.
- A depth argument limits flattening to that many levels, leaving deeper nesting intact.
- Any single head's nested calls flatten, not just $List$'s.
