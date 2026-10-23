---
name: DescentBottomWord
domain: Combinatorial maps
signature: DescentBottomWord(Permutation)
summary: "Letter v is 1 when value v is a descent bottom: some larger value immediately precedes it."
catalog:
  - system: findstat
    identity: Mp00131
    url: https://www.findstat.org/Mp00131
    on: Permutation
mapOn:
  - Permutation
signatures:
  - call: DescentBottomWord(Permutation)
    description: "Letter v is 1 when value v is a descent bottom: some larger value immediately precedes it."
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
- Value n is never a descent bottom, so the last letter stands for n - 1.
