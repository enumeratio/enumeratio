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
  - orderIsomorphism:
      from: IntegerCompositions
      to: BinaryWords
      sizeOffset: -1
---

- Takes a `Composition` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- An order isomorphism: the k-th composition of n, as IntegerCompositions lists them, goes to the k-th binary word of length n - 1.
