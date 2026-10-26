---
name: Rowmotion
domain: Combinatorial maps
signature: Rowmotion(BinaryWord)
summary: "Rowmotion of the word as an order ideal of a product of two chains: the stretches between valleys reversed, each valley written 10."
catalog:
  - system: findstat
    identity: Mp00278
    url: https://www.findstat.org/Mp00278
    on: BinaryWord
  - system: findstat
    identity: Mp00281
    url: https://www.findstat.org/Mp00281
    on: SignedPermutation
mapOn:
  - BinaryWord
  - SignedPermutation
laws:
  - bijection
  - graded:
      from: BinaryWords
      to: BinaryWords
    on: binary_word
  - graded:
      from: SignedPermutations
      to: SignedPermutations
    on: signed_permutation
signatures:
  - call: Rowmotion(BinaryWord)
    description: "Rowmotion of the word as an order ideal of a product of two chains: the stretches between valleys reversed, each valley written 10."
    library: enumeratio-combinatorics
    type: ((binary_word) -> binary_word) & ((signed_permutation) -> signed_permutation)
---

- Takes a `BinaryWord` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00278. A bijection that keeps the number of ones; its order is the length of the word.
- Also takes a `SignedPermutation`, returning a `SignedPermutation`: Rowmotion of the signed permutation with respect to the sorting order, through its signed Lehmer code.
- FindStat's Mp00281, a bijection. The sorting order is Armstrong's, for the Coxeter element −n, 1, …, n − 1.
