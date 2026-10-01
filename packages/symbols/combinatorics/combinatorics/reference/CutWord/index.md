---
name: CutWord
domain: Combinatorial maps
signature: CutWord(Composition)
summary: A composition of n as the binary word of length n - 1 marking where it is cut.
signatures:
  - call: CutWord(Composition)
    description: A composition of n as the binary word of length n - 1 marking where it is cut.
    library: enumeratio-combinatorics
    type: (composition) -> binary_word
laws:
  - inverse: Composition
---

- Takes a `Composition` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Not order-preserving: IntegerCompositions lists compositions lex on their parts, while BinaryWords(n - 1) through Composition(word) gives them in their cut words' order.
