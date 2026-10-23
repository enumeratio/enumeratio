---
name: SumOfHookLengths
domain: Partition statistics
signature: SumOfHookLengths(partition)
summary: The total of all hook lengths.
references:
  - system: wikipedia
    identity: Hook length formula
  - system: mathworld
    identity: HookLengthFormula
statOn:
  - IntegerPartition
signatures:
  - call: SumOfHookLengths(partition)
    description: The total of all hook lengths.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("IntegerPartition", $1, "SumOfHookLengths")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
catalog:
  - system: findstat
    identity: St000869
    url: https://www.findstat.org/St000869
    on: IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Hook of cell (i, j) is arm + leg + 1 = (λ_i - j) + (λ'_j - i) + 1.
