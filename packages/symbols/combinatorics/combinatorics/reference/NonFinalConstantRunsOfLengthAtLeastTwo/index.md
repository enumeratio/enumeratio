---
name: NonFinalConstantRunsOfLengthAtLeastTwo
domain: Dyck path statistics
signature: NonFinalConstantRunsOfLengthAtLeastTwo(path)
summary: "Maximal runs of equal steps, at least two long, that are followed by a step of the other kind: the occurrences of two up steps then a down step, or two down steps then an up step."
catalog:
  - system: findstat
    identity: St000340
    url: https://www.findstat.org/St000340
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: NonFinalConstantRunsOfLengthAtLeastTwo(path)
    description: "Maximal runs of equal steps, at least two long, that are followed by a step of the other kind: the occurrences of two up steps then a down step, or two down steps then an up step."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
