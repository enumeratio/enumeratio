---
name: CyclicSievingPolynomialDegree
domain: Partition statistics
signature: CyclicSievingPolynomialDegree(partition)
summary: "(1 - 1/largest part) times the least common multiple of the parts: the degree of the cyclic sieving polynomial of a permutation with these cycle lengths."
signatures:
  - call: CyclicSievingPolynomialDegree(partition)
    description: "(1 - 1/largest part) times the least common multiple of the parts: the degree of the cyclic sieving polynomial of a permutation with these cycle lengths."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St001918
    url: https://www.findstat.org/St001918
    on: IntegerPartition
statOn:
  - IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat leaves the empty partition undefined; it is 0 here.
