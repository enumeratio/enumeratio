---
name: DownStepMajorIndex
domain: Dyck path statistics
signature: DownStepMajorIndex(path)
summary: "The major index counting positions in down steps only: over each valley, the number of down steps up to and including its down step; summed."
catalog:
  - system: findstat
    identity: St000947
    url: https://www.findstat.org/St000947
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: DownStepMajorIndex(path)
    description: "The major index counting positions in down steps only: over each valley, the number of down steps up to and including its down step; summed."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
