---
name: LongestCycleLength
domain: Permutation statistics
signature: LongestCycleLength(p)
summary: The size of the largest cycle (the catalog's second spelling).
statOn:
  - Permutation
signatures:
  - call: LongestCycleLength(p)
    description: The size of the largest cycle (the catalog's second spelling).
    library: enumeratio-combinatorics
    type: (permutation) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "LongestCycleLength")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: mathlib4
    template: '((fun (l : List ℕ) => let f : Fin l.length → Fin l.length := fun i => ((List.finRange l.length).find? (fun j => j.val + 1 = l[i]!)).getD i; let g : Fin l.length → Fin l.length := fun j => ((List.finRange l.length).find? (fun i => f i = j)).getD j; if h1 : ∀ i, g (f i) = i then (if h2 : ∀ j, f (g j) = j then (let p : Equiv.Perm (Fin l.length) := Equiv.mk f g h1 h2; toString ((Equiv.Perm.partition p).parts.sup)) else "not a permutation") else "not a permutation") $1)'
    arity: 1
    note: A 1-based one-line permutation list, rebuilt as an Equiv.Perm (Fin n) (a list that is not a permutation prints "not a permutation"); the empty permutation gives 0
catalog:
  - system: findstat
    identity: St000485
    url: https://www.findstat.org/St000485
    on: Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
