---
name: BraceletCount
domain: Partition statistics
signature: BraceletCount(partition)
summary: "The colorings of a polygon with these color multiplicities, up to rotation and reflection: the necklaces and the colorings fixed by the reflections, over twice the size."
catalog:
  - system: findstat
    identity: St001603
    url: https://www.findstat.org/St001603
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: BraceletCount(partition)
    description: "The colorings of a polygon with these color multiplicities, up to rotation and reflection: the necklaces and the colorings fixed by the reflections, over twice the size."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St001603 (the dihedral group); its title says colourings of a polygon. It is only defined there for sizes of at least 3.
