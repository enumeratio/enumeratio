---
name: LargestAreaSequenceEntry
domain: Dyck path statistics
signature: LargestAreaSequenceEntry(path)
summary: "The largest entry of the area sequence: the greatest area to the right of an up step."
catalog:
  - system: findstat
    identity: St000442
    url: https://www.findstat.org/St000442
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: LargestAreaSequenceEntry(path)
    description: "The largest entry of the area sequence: the greatest area to the right of an up step."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
