---
name: Runs
domain: Permutation statistics
signature: Runs(p)
summary: Maximal increasing runs — one more than the number of descents.
references:
  - system: wikipedia
    identity: Permutation#Ascents, descents, runs, exceedances
  - system: mathworld
    identity: PermutationRun
statOn:
  - BinaryWord
  - Permutation
signatures:
  - call: Runs(p)
    description: Maximal increasing runs — one more than the number of descents.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
bindings:
  - origin: mapped
    form: combinatorica
    template: Length[Runs[$1]]
    arity: 1
    note: Combinatorica's Runs returns the runs themselves; ours is their count.
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "Runs")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
catalog:
  - system: findstat
    identity: St000325
    url: https://www.findstat.org/St000325
    on: Permutation
  - system: findstat
    identity: St000470
    url: https://www.findstat.org/St000470
    on: Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
