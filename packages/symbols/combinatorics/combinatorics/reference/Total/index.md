---
name: Total
domain: Collections
signature: Total(list)
summary: The sum of the elements of a list; a matrix totals column by column.
signatures:
  - call: Total(list)
    description: $x_1 + x_2 + \cdots + x_n$ for the $n$ elements of $list$.
    library: enumeratio-combinatorics
    type: (collection<any>) -> any
seeAlso:
  - Mean
  - MovingMap
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: mathlib4
    template: (List.sum $1)
    arity: 1
    note: The sum of a list of numbers, 0 for the empty list; a matrix (ours totals column by column) fails to elaborate, since lists do not add.
  - origin: mapped
    form: sage
    template: sum($1)
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Wolfram's levels and `Method` arguments are not implemented.
