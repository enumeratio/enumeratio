---
name: Prepend
domain: Collections
signature: Prepend(collection, value)
summary: The collection with value added as its first element.
signatures:
  - call: Prepend(collection, value)
    description: the collection with `value` added as its first element.
    library: enumeratio-combinatorics
    type: (collection<any>, value) -> collection
  - call: Prepend(association, rule)
    description: "`association` with `rule` (or a list of rules) inserted at the front; a prepended key displaces any later entry for the same key."
    library: enumeratio-combinatorics
seeAlso:
  - Append
  - Join
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: mathlib4
    template: "(($2) :: ($1))"
    arity: 2
    note: The value consed onto the list; a list value onto a list of scalars fails to elaborate (ours nests it as one element), as does an association.
---

- $Prepend(c, x) = Join(\{x\}, c)$. See [[Join]].
- Complements [[Append]] at the other end of a collection.
