---
name: DescentComposition
domain: Combinatorial maps
signature: DescentComposition(Permutation)
summary: The composition of n cut at the descent positions.
catalog:
  - system: findstat
    identity: Mp00071
    url: https://www.findstat.org/Mp00071
    on: Permutation
mapOn:
  - Permutation
  - StandardTableau
signatures:
  - call: DescentComposition(Permutation)
    description: The composition of n cut at the descent positions.
    library: enumeratio-combinatorics
    type: (permutation) -> composition
laws:
  - surjection
  - graded:
      from: Permutations
      to: IntegerCompositions
---

- Takes a `Permutation` and returns a `Composition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Its parts sum to n and its length is one more than Descents — another statistic readable off a map. Removed once for erroring on words with no descents; `Range(1, 0)` never evaluates, so the short case has to be stated.
