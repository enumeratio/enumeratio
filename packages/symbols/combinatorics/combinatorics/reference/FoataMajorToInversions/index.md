---
name: FoataMajorToInversions
domain: Combinatorial maps
signature: FoataMajorToInversions(Permutation)
summary: "Foata's bijection: each letter is put on the end of the image so far, which is cut into blocks, and every block is rotated one place right."
catalog:
  - system: findstat
    identity: Mp00067
    url: https://www.findstat.org/Mp00067
    on: Permutation
  - system: findstat
    identity: Mp00096
    url: https://www.findstat.org/Mp00096
    on: BinaryWord
  - system: findstat
    identity: Mp00314
    url: https://www.findstat.org/Mp00314
    on: Composition
mapOn:
  - BinaryWord
  - Composition
  - Permutation
laws:
  - bijection
  - inverse: FoataInversionsToMajor
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
  - graded:
      from: BinaryWords
      to: BinaryWords
    on: binary_word
  - graded:
      from: IntegerCompositions
      to: IntegerCompositions
    on: composition
signatures:
  - call: FoataMajorToInversions(Permutation)
    description: "Foata's bijection: each letter is put on the end of the image so far, which is cut into blocks, and every block is rotated one place right."
    library: enumeratio-combinatorics
    type: ((binary_word) -> binary_word) & ((composition) -> composition)
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00067, Sage's foata_bijection. It sends the major index to the number of inversions; the inverse is FoataInversionsToMajor. Not the cycle-based Foata, which is FindStat's first fundamental transformation.
- Also takes a `Composition`, returning a `Composition`: Foata's bijection on the word of parts: each part is put on the end of the image so far, which is cut into blocks, and every block is rotated one place right.
- FindStat's Mp00314. An equal part counts as the smaller; it sends the major index to the number of inversions.
- Also takes a `BinaryWord`, returning a `BinaryWord`: Foata's bijection on words: each letter is put on the end of the image so far, which is cut into blocks, and every block is rotated one place right.
- FindStat's Mp00096. With repeated letters an equal letter counts as the smaller, so it is the permutation map through standardization; it sends the major index to the number of inversions.
