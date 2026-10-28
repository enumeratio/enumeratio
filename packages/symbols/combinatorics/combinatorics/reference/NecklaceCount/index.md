---
name: NecklaceCount
domain: Partition statistics
signature: NecklaceCount(partition)
summary: "The colorings of a cycle with these color multiplicities, up to rotation: the size's divisors d of the greatest common divisor of the parts, each contributing totient(d) multinomials, over the size."
catalog:
  - system: findstat
    identity: St001605
    url: https://www.findstat.org/St001605
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: NecklaceCount(partition)
    description: "The colorings of a cycle with these color multiplicities, up to rotation: the size's divisors d of the greatest common divisor of the parts, each contributing totient(d) multinomials, over the size."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St001605 (the cyclic group); its title says colourings of a cycle.
