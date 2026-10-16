---
name: BoxWeight
domain: Dyck path statistics
signature: BoxWeight(path)
summary: The product, over the up steps, of one more than the number of down steps before it.
catalog:
  - system: findstat
    identity: St001808
    url: https://www.findstat.org/St001808
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: BoxWeight(path)
    description: The product, over the up steps, of one more than the number of down steps before it.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Follows FindStat's Sage code and its data, not its description: the description gives 4 for the path UUDD, the code and every stored value give 1.
