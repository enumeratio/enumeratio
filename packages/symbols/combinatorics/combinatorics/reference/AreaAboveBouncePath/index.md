---
name: AreaAboveBouncePath
domain: Dyck path statistics
signature: AreaAboveBouncePath(path)
summary: "The boxes between the path and its bounce path: the area less the area of the bounce path."
catalog:
  - system: findstat
    identity: St001584
    url: https://www.findstat.org/St001584
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: AreaAboveBouncePath(path)
    description: "The boxes between the path and its bounce path: the area less the area of the bounce path."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The bounce path is U^b1 D^b1 U^b2 D^b2 ... for the climbs b of the bounce walk, so its area is the sum of binomial(b, 2).
