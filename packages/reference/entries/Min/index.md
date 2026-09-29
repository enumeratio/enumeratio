---
name: Min
domain: Arithmetic
signature: Min(a, b, …)
summary: The smallest of its arguments.
signatures:
  - call: Min(a, b, …)
    description: the smallest of two or more values.
  - call: Min(list)
    description: the smallest value in a list.
  - call: Min()
    description: the identity element $+\infty$, for a call with no arguments at all.
    library: enumeratio-combinatorics
    type: (any*) -> any
    overrides: enumeratio-analytic
  - call: Min(a, b, …)
    description: The smallest of its arguments.
    library: enumeratio-analytic
    type: (value+) -> number
    overrides: compute-engine
  - call: Min(a, b, …)
    description: for values of any ordered type, not just numbers -- the meet, in a lattice that is not a total order.
    library: enumeratio-structures
    type: (any*) -> any
    overrides: enumeratio-combinatorics
seeAlso:
  - Max
  - Clamp
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: wolfram
    template: Min[$*,]
    note: Same flattening as Max.
  - origin: mapped
    form: sympy
    template: enumeratio_min($*,)
    note: Same flattening as Max.
  - origin: mapped
    form: sage
    template: enumeratio_min($*,)
    note: Same flattening as Max.
---

- The smallest of its arguments, or of a single list argument.
- Multiple arguments -- lists included -- are flattened into one pool rather than compared pairwise or threaded element-wise. See [[Max]].
- Commutative and associative: order and grouping don't matter.
- $\min(a,b) + \max(a,b) = a + b$ for any two values. See [[Max]].
- Infinities participate directly in the comparison.
- With no arguments at all, returns the identity element $+\infty$.
