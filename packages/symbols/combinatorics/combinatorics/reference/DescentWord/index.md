---
name: DescentWord
domain: Combinatorial maps
signature: DescentWord(Permutation)
summary: "Letter i is 1 when the word falls between positions i and i + 1: the descent set as a binary word."
catalog:
  - system: findstat
    identity: Mp00109
    url: https://www.findstat.org/Mp00109
    on: Permutation
mapOn:
  - Permutation
signatures:
  - call: DescentWord(Permutation)
    description: "Letter i is 1 when the word falls between positions i and i + 1: the descent set as a binary word."
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
- One letter shorter than the permutation, so the empty permutation has no descent word.
