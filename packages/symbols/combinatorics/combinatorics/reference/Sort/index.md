---
name: Sort
domain: Collections
signature: Sort(collection)
summary: The elements of the collection in increasing order.
signatures:
  - call: Sort(collection)
    description: the elements in increasing numeric order.
  - call: Sort(collection, comparator)
    description: sorted by a custom [[Function]] comparator, e.g. descending order.
  - call: Sort(expr)
    description: the operands of any expression, sorted in place — not just a collection's.
    library: enumeratio-combinatorics
    type: "((T, order: (((character) any -> unknown) | ((character, character) any -> boolean | number))?) -> T where T: string) & ((indexed_collection<T>, order: (((T) any -> unknown) | ((any, any) any -> boolean | number))?) -> list<T> where T)"
    overrides: compute-engine
seeAlso:
  - Ordering
names:
  wolframIdentity: true
---

- Idempotent: sorting an already-sorted collection changes nothing.
- $Sort(c) = At(c, Ordering(c))$. See [[Ordering]] and [[At]].
- `Sort(c, p)` puts `a` before `b` when `p(a, b)` holds and `p(b, a)` does not. Elements `p` holds both ways (a non-strict `p`, like `<=`) keep their input order; elements it holds neither way (a strict `p`, like `<`) come out in reverse input order, as Wolfram's does.
- Orders numbers numerically, strings in Wolfram's order (letters compare ignoring case, lowercase before uppercase on a tie, numbers before strings), and symbols alphabetically by name.
- The comparator form `Sort(list, p)` takes a predicate `p` reporting whether a pair is already in order.
- Works on the operands of any expression, not just a collection's elements.
- Differs from Wolfram: strings sort by code point, so `"B"` comes before `"a"`; Wolfram's canonical order puts `a, b, B`.
