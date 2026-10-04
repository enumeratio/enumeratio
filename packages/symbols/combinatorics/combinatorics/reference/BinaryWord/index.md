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
    type: ((list<integer>) -> binary_word) & ((finset) -> binary_word)
laws:
  - inverse: Finset
---

- A [[BinaryWords]] element.
- `BinaryWord(subset)` is a subset's characteristic word: letter $i$ is 1 when $i$ is a member. [[Composition]] reads a word as cut positions instead.
