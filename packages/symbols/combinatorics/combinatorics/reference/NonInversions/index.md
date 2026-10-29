---
name: NonInversions
domain: Permutation statistics
signature: NonInversions(p)
summary: Pairs i < j with p(i) < p(j).
catalog:
  - system: findstat
    identity: St000246
    url: https://www.findstat.org/St000246
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: NonInversions(p)
    description: Pairs i < j with p(i) < p(j).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "NonInversions")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: mathlib4
    template: "((fun (l : List ℕ) => (Finset.univ.filter (fun x : Fin l.length × Fin l.length => x.1 < x.2 ∧ l[x.1] < l[x.2])).card) $1)"
    arity: 1
    note: Pairs i < j with l[i] < l[j], counted over Fin pairs of the list
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
