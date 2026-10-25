---
name: Rowmotion
domain: Combinatorial maps
signature: Rowmotion(SignedPermutation)
summary: Rowmotion of the signed permutation with respect to the sorting order, through its signed Lehmer code.
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
signatures:
  - call: Rowmotion(BinaryWord)
    description: "Rowmotion of the word as an order ideal of a product of two chains: the stretches between valleys reversed, each valley written 10."
    library: enumeratio-combinatorics
    type: ((binary_word) -> binary_word) & ((signed_permutation) -> signed_permutation)
---

- Takes a `SignedPermutation` and returns a `SignedPermutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00281, a bijection. The sorting order is Armstrong's, for the Coxeter element −n, 1, …, n − 1.
- Also takes a `BinaryWord`, returning a `BinaryWord`: Rowmotion of the word as an order ideal of a product of two chains: the stretches between valleys reversed, each valley written 10.
- FindStat's Mp00278. A bijection that keeps the number of ones; its order is the length of the word.
