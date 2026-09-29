---
name: Length
domain: Collections
signature: Length(collection)
summary: The number of elements in the collection.
signatures:
  - call: Length(collection)
    description: the number of elements in the collection.
  - call: Length(expr)
    description: the number of top-level operands of any expression, not just a collection.
    library: enumeratio-collections
    type: (any) -> infinity | integer
    overrides: compute-engine
seeAlso:
  - Count
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: wolfram
    template: Length[$1]
    arity: 1
    note: Wolfram's Length of an atom (not a list) is 0, not an error, matching ours; a bare len() raises on a non-list, so it is guarded.
  - origin: mapped
    form: sympy
    template: (len($1) if hasattr($1, '__len__') else (len($1.args) if hasattr($1, 'args') else 0))
    arity: 1
    note: Wolfram's Length of an atom (not a list) is 0, not an error, matching ours; a bare len() raises on a non-list, so it is guarded. A sympy expression (not a Python list) has no __len__ but counts its own terms via .args (Add(a,b,c,d).args has 4 elements; a bare Symbol's .args is empty, giving 0 like an atom).
  - origin: mapped
    form: sage
    template: (len($1) if hasattr($1, '__len__') else (len($1.operands()) if hasattr($1, 'operands') else 0))
    arity: 1
    note: Wolfram's Length of an atom (not a list) is 0, not an error, matching ours; a bare len() raises on a non-list, so it is guarded. A Sage symbolic expression (not a Python list) has no __len__ but counts its own terms via .operands() — a method, unlike sympy's .args tuple (Add(a,b,c,d).operands() has 4 elements; a bare variable's is empty, giving 0 like an atom).
statOn:
  - ContinuedFraction
  - IntegerPartition
  - LabeledTree
---

- Works on any collection head, not just $List$ — e.g. $Set$.
- Additive over concatenation: $Length(Join(A, B)) = Length(A) + Length(B)$. See [[Join]].
- An atom has no parts, so its length is 0 — it isn't a type error.
- Any other expression's length is its number of top-level operands, e.g. the number of terms in a sum.
- See [[Count]] to count occurrences of a specific value instead of every element.
