---
name: RunSort
domain: Combinatorial maps
signature: RunSort(Permutation)
summary: The permutation with its increasing runs sorted lexicographically.
catalog:
  - system: findstat
    identity: Mp00223
    url: https://www.findstat.org/Mp00223
    on: Permutation
  - system: findstat
    identity: Mp00224
    url: https://www.findstat.org/Mp00224
    on: BinaryWord
mapOn:
  - BinaryWord
  - Permutation
laws:
  - idempotent
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
  - graded:
      from: BinaryWords
      to: BinaryWords
    on: binary_word
signatures:
  - call: RunSort(Permutation)
    description: The permutation with its increasing runs sorted lexicographically.
    library: enumeratio-combinatorics
    type: ((binary_word) -> binary_word) & ((permutation) -> permutation)
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00223. Lossy: the runs' order is forgotten.
- Also takes a `BinaryWord`, returning a `BinaryWord`: The word with its weakly increasing runs sorted lexicographically.
- FindStat's Mp00224. Lossy: the runs' order is forgotten. The runs are the maximal stretches 0...01...1.
