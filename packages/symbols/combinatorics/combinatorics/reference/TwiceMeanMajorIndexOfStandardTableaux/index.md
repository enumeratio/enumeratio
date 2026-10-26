---
name: TwiceMeanMajorIndexOfStandardTableaux
domain: Partition statistics
signature: TwiceMeanMajorIndexOfStandardTableaux(partition)
summary: "Twice the mean major index over the standard tableaux: n choose 2, less the sum of the row lengths choose 2, plus the sum of the column lengths choose 2."
catalog:
  - system: findstat
    identity: St001177
    url: https://www.findstat.org/St001177
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: TwiceMeanMajorIndexOfStandardTableaux(partition)
    description: "Twice the mean major index of the standard tableaux: n choose 2, less the sum over the rows of the row length choose 2, plus the sum over the columns of the column length choose 2."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
