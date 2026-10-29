---
name: SimplesOfMaximalEvenProjectiveDimension
domain: Dyck path statistics
signature: SimplesOfMaximalEvenProjectiveDimension(path)
summary: "The simple modules whose projective dimension is the greatest even one that occurs: the global dimension if it is even, else one less."
catalog:
  - system: findstat
    identity: St001493
    url: https://www.findstat.org/St001493
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: SimplesOfMaximalEvenProjectiveDimension(path)
    description: "The simple modules whose projective dimension is the greatest even one that occurs: the global dimension if it is even, else one less."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
