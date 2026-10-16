---
name: FixedPoints
domain: Permutation statistics
signature: FixedPoints(p)
summary: "The number of fixed points of $p$: positions $i$ with $p_i = i$."
signatures:
  - call: FixedPoints(p)
    description: the fixed-point count of a one-line permutation $p$
    library: enumeratio-combinatorics
    type: (permutation) -> integer
seeAlso:
  - Derangements
  - CycleCount
  - SymmetricGroup
references:
  - system: wikipedia
    identity: Fixed point (mathematics)
  - system: mathworld
    identity: FixedPoint
catalog:
  - system: findstat
    identity: St000022
    url: https://www.findstat.org/St000022
    on: Permutation
statOn:
  - DecoratedPermutation
  - Endofunction
  - Permutation
  - SignedPermutation
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "FixedPoints")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- A permutation with no fixed points is a derangement (see [[Derangements]])
- Averaged over $S_n$ the count is exactly $1$, independent of $n$
- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
