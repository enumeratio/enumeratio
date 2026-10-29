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
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "CycleCount")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: mathlib4
    template: '((fun (l : List ℕ) => let f : Fin l.length → Fin l.length := fun i => ((List.finRange l.length).find? (fun j => j.val + 1 = l[i]!)).getD i; let g : Fin l.length → Fin l.length := fun j => ((List.finRange l.length).find? (fun i => f i = j)).getD j; if h1 : ∀ i, g (f i) = i then (if h2 : ∀ j, f (g j) = j then (let p : Equiv.Perm (Fin l.length) := Equiv.mk f g h1 h2; toString ((Equiv.Perm.partition p).parts.card)) else "not a permutation") else "not a permutation") $1)'
    arity: 1
    note: A 1-based one-line permutation list, rebuilt as an Equiv.Perm (Fin n) (a list that is not a permutation prints "not a permutation"); Equiv.Perm.partition is the cycle type with the fixed points as 1-cycles
signatures:
  - call: CycleCount(p)
    description: the cycle count of a one-line permutation $p$
    library: enumeratio-combinatorics
    type: (permutation) -> integer
seeAlso:
  - FixedPoints
  - StirlingS1
  - SymmetricGroup
catalog:
  - system: findstat
    identity: St000031
    url: https://www.findstat.org/St000031
    on: Permutation
statOn:
  - Permutation
---

- Permutations of $\{1, \dots, n\}$ with $k$ cycles are counted by the unsigned Stirling number of the first kind $\left[{n\atop k}\right]$ (see [[StirlingS1]])
- The identity is all fixed points, so it splits into $n$ singleton cycles; an $n$-cycle is a single cycle
- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
