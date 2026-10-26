---
name: TwelveTimesMajorIndexVarianceOfStandardTableaux
domain: Partition statistics
signature: TwelveTimesMajorIndexVarianceOfStandardTableaux(partition)
summary: "Twelve times the variance of the major index over the standard tableaux: the sum of the first n squares, less the sum of the squared hook lengths."
catalog:
  - system: findstat
    identity: St001178
    url: https://www.findstat.org/St001178
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: TwelveTimesMajorIndexVarianceOfStandardTableaux(partition)
    description: "Twelve times the variance of the major index of the standard tableaux: the sum of the first n squares, less the sum of the squares of the hook lengths."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Follows FindStat's description, whose Sage code does not parse; the values agree with it.
