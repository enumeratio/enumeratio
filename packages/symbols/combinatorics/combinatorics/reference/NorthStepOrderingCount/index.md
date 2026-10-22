---
name: NorthStepOrderingCount
domain: Dyck path statistics
signature: NorthStepOrderingCount(path)
summary: The total orderings of the up steps such that the up steps after the k-th down step are never among the first k in the order.
catalog:
  - system: findstat
    identity: St001786
    url: https://www.findstat.org/St001786
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: NorthStepOrderingCount(path)
    description: The total orderings of the up steps such that the up steps after the k-th down step are never among the first k in the order.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The coefficient of z_1^a_1 ... z_n^a_n in the product of (z_1 + ... + z_k), by Stanley's product formula: each factor is the height before a down step over the factorial of the up steps since the last one.
