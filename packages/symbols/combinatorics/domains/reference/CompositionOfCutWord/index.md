---
name: CompositionOfCutWord
domain: Combinatorial maps
signature: CompositionOfCutWord(BinaryWord)
summary: The composition of m + 1 a binary word of length m cuts out.
signatures:
  - call: CompositionOfCutWord(BinaryWord)
    description: The composition of m + 1 a binary word of length m cuts out.
    library: enumeratio-domains
    type: (binary_word) -> composition
---

- Takes a `BinaryWord` and returns a `Composition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- The inverse of CutWord, and order-preserving in the same way.
