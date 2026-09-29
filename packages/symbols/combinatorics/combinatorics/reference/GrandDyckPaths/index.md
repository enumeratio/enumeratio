---
name: GrandDyckPaths
domain: Collections
signature: GrandDyckPaths(n)
summary: Free $\pm 1$-step paths of length $2n$ starting and ending at height $0$, with no non-negativity constraint.
signatures:
  - call: GrandDyckPaths(n)
    description: Free $\pm 1$-step paths of length $2n$ starting and ending at height $0$, with no non-negativity constraint
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<list<integer>>
seeAlso:
  - DyckPaths
references:
  - system: oeis
    identity: A000984
grades:
  - name: n
    role: axis
carrier: DyckPath
---

- Count is the central binomial coefficient $\binom{2n}{n}$ (A000984).
