---
name: ConnectivityWord
domain: Combinatorial maps
signature: ConnectivityWord(Permutation)
summary: "Letter i is 1 when the first i entries are all smaller than the rest: the connectivity set as a binary word."
catalog:
  - system: findstat
    identity: Mp00114
    url: https://www.findstat.org/Mp00114
    on: Permutation
mapOn:
  - Permutation
laws:
  - surjection
  - graded:
      from: Permutations
      to: BinaryWords
      sizeOffset: -1
    on: permutation
signatures:
  - call: ConnectivityWord(Permutation)
    description: "Letter i is 1 when the first i entries are all smaller than the rest: the connectivity set as a binary word."
    library: enumeratio-combinatorics
    type: (permutation) -> binary_word
---

- Takes a `Permutation` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00114. One letter shorter than the permutation; the word is all 0 exactly when the permutation is connected.
