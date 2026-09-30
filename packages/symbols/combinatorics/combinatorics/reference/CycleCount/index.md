---
name: CycleCount
domain: Permutation statistics
signature: CycleCount(p)
summary: The number of cycles in the disjoint-cycle decomposition of $p$.
formerly:
  - Cycles
primitive: kernel
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/combinatorics/combinatorics/collections/src/stats.ts:cycleCount
    note: Orbit traversal with a visited set — the one statistic here that does not reduce to an expression.
signatures:
  - call: CycleCount(p)
    description: the cycle count of a one-line permutation $p$
    library: enumeratio-combinatorics
    type: (permutation) -> integer
seeAlso:
  - FixedPoints
  - StirlingS1
  - SymmetricGroup
---

- Permutations of $\{1, \dots, n\}$ with $k$ cycles are counted by the unsigned Stirling number of the first kind $\left[{n\atop k}\right]$ (see [[StirlingS1]])
- The identity is all fixed points, so it splits into $n$ singleton cycles; an $n$-cycle is a single cycle
- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
