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
mapOn:
  - BinaryWord
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
    type: (binary_word) -> binary_word
---

- Takes a `BinaryWord` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00278. A bijection that keeps the number of ones; its order is the length of the word.
