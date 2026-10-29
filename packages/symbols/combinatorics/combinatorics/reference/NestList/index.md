---
name: NestList
domain: Collections
signature: NestList(f, x, n)
summary: The list of x, f(x), f(f(x)), ... up to n applications of f.
signatures:
  - call: NestList(f, x, n)
    description: $x$ followed by every intermediate value up to $Nest(f, x, n)$, $n + 1$ entries in all.
    library: enumeratio-combinatorics
    type: "(function: any, x: any, n: integer) -> list<any>"
seeAlso:
  - Nest
  - FixedPoint
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: mathlib4
    template: "((List.range (($3 : ℕ) + 1)).map (fun ξ => Nat.repeat $1 ξ $2))"
    arity: 3
    note: The start and each of n applications, n + 1 entries. A negative or non-integer count fails to elaborate, where ours holds the call.
---

- See [[Nest]] for just the final value.
