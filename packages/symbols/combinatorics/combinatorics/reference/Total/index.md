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
    form: sage
    template: sum($1)
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Wolfram's levels and `Method` arguments are not implemented.
