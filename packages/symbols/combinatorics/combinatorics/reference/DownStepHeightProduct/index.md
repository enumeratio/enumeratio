---
name: DownStepHeightProduct
domain: Dyck path statistics
signature: DownStepHeightProduct(path)
summary: The product, over the down steps, of the height each starts from.
catalog:
  - system: findstat
    identity: St000038
    url: https://www.findstat.org/St000038
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: DownStepHeightProduct(path)
    description: The product, over the down steps, of the height each starts from.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
