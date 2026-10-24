---
name: DescentTopWord
domain: Combinatorial maps
signature: DescentTopWord(Permutation)
summary: "Letter v - 1 is 1 when value v is a descent top: some smaller value immediately follows it."
catalog:
  - system: findstat
    identity: Mp00130
    url: https://www.findstat.org/Mp00130
    on: Permutation
mapOn:
  - Permutation
signatures:
  - call: DescentTopWord(Permutation)
    description: "Letter v - 1 is 1 when value v is a descent top: some smaller value immediately follows it."
    library: enumeratio-combinatorics
    type: (permutation) -> binary_word
laws:
  - surjection
  - graded:
      from: Permutations
      to: BinaryWords
      sizeOffset: -1
    on: permutation
---

- Takes a `Permutation` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Value 1 is never a descent top, so the first letter stands for 2.
