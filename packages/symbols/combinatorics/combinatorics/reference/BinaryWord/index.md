---
name: BinaryWord
catalogCarrier: true
domain: Collections
signature: BinaryWord(list)
summary: The singular-inhabitant constructor for a word over $\{0, 1\}$.
signatures:
  - call: BinaryWord(list)
    description: The singular-inhabitant constructor for a word over $\{0, 1\}$.
    library: enumeratio-combinatorics
    type: ((list<integer>) -> binary_word) & ((dyck_path) -> binary_word) & ((integer_partition) -> binary_word) & ((finset) -> binary_word)
laws:
  - inverse: Finset
    on: finset
catalog:
  - system: findstat
    identity: Mp00093
    url: https://www.findstat.org/Mp00093
    on: DyckPath
  - system: findstat
    identity: Mp00095
    url: https://www.findstat.org/Mp00095
    on: IntegerPartition
---

- A [[BinaryWords]] element.
- `BinaryWord(subset)` is a subset's characteristic word: letter $i$ is 1 when $i$ is a member. [[Composition]] reads a word as cut positions instead.
