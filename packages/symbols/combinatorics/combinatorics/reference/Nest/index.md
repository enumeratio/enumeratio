---
name: Nest
domain: Collections
signature: Nest(f, x, n)
summary: f applied n times to x.
signatures:
  - call: Nest(f, x, n)
    description: $f$ applied to $x$, $n$ times in a row.
    library: enumeratio-combinatorics
    type: "(function: any, x: any, n: integer) -> any"
seeAlso:
  - NestList
  - FixedPoint
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: mathlib4
    template: "(Nat.repeat $1 ($3 : ℕ) $2)"
    arity: 3
    note: A negative or non-integer count fails to elaborate, where ours holds the call.
---

- $f$ can be a [[Function]] literal or a plain symbol; an undeclared symbol stays an unevaluated call, the way $Nest(f, x, 3)$ shows below.
- See [[NestList]] for every intermediate step, and [[FixedPoint]] for iterating until the value stops changing instead of a fixed count.
