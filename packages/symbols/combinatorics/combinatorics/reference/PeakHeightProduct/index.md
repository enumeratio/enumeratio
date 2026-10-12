---
name: PeakHeightProduct
domain: Dyck path statistics
signature: PeakHeightProduct(path)
summary: The product of the heights of the peaks.
catalog:
  - system: findstat
    identity: St001959
    url: https://www.findstat.org/St001959
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: PeakHeightProduct(path)
    description: The product of the heights of the peaks.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
