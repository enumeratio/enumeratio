---
name: SignWord
domain: Combinatorial maps
signature: SignWord(SignedPermutation)
summary: "The signs as a binary word: letter i is 1 when entry i is negative."
laws:
  - surjection
  - graded:
      from: SignedPermutations
      to: BinaryWords
    on: signed_permutation
catalog:
  - system: findstat
    identity: Mp00267
    url: https://www.findstat.org/Mp00267
    on: SignedPermutation
mapOn:
  - SignedPermutation
signatures:
  - call: SignWord(SignedPermutation)
    description: "The signs as a binary word: letter i is 1 when entry i is negative."
    library: enumeratio-combinatorics
    type: (signed_permutation) -> binary_word
---

- Takes a `SignedPermutation` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00267. Lossy: the absolute values are forgotten.
