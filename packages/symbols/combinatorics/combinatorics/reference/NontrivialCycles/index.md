---
name: NontrivialCycles
domain: Permutation statistics
signature: NontrivialCycles(p)
summary: "Cycles of size at least two: the cycles less the fixed points."
catalog:
  - system: findstat
    identity: St000162
    url: https://www.findstat.org/St000162
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: NontrivialCycles(p)
    description: "Cycles of size at least two: the cycles less the fixed points."
    library: enumeratio-combinatorics
    type: (permutation) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "NontrivialCycles")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: mathlib4
    template: "((fun (l : List ℕ) => let f : Fin l.length → Fin l.length := fun i => ((List.finRange l.length).find? (fun j => j.val + 1 = l[i]!)).getD i; let g : Fin l.length → Fin l.length := fun j => ((List.finRange l.length).find? (fun i => f i = j)).getD j; if h1 : ∀ i, g (f i) = i then (if h2 : ∀ j, f (g j) = j then (let p : Equiv.Perm (Fin l.length) := Equiv.mk f g h1 h2; toString (p.cycleType.card)) else \"not a permutation\") else \"not a permutation\") $1)"
    arity: 1
    note: "A 1-based one-line permutation list, rebuilt as an Equiv.Perm (Fin n) (a list that is not a permutation prints \"not a permutation\"); Equiv.Perm.cycleType omits the 1-cycles"
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
