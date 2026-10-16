---
name: PyramidWeight
domain: Dyck path statistics
signature: PyramidWeight(path)
summary: "Over each peak, the shorter of the up run before it and the down run after it, summed: the sizes of the maximal pyramids."
catalog:
  - system: findstat
    identity: St000144
    url: https://www.findstat.org/St000144
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: PyramidWeight(path)
    description: "Over each peak, the shorter of the up run before it and the down run after it, summed: the sizes of the maximal pyramids."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
