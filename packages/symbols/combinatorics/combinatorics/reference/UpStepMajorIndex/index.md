---
name: UpStepMajorIndex
domain: Dyck path statistics
signature: UpStepMajorIndex(path)
summary: "The major index counting positions in up steps only: over each valley, the number of up steps up to its down step; summed."
catalog:
  - system: findstat
    identity: St001161
    url: https://www.findstat.org/St001161
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: UpStepMajorIndex(path)
    description: "The major index counting positions in up steps only: over each valley, the number of up steps up to its down step; summed."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
