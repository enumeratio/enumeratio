---
name: RskInsertion
domain: Combinatorial maps
signature: RskInsertion(Permutation)
summary: The insertion tableau of the RSK correspondence.
references:
  - system: wikipedia
    identity: Robinson–Schensted correspondence
catalog:
  - system: findstat
    identity: Mp00059
    url: https://www.findstat.org/Mp00059
    on: Permutation
mapOn:
  - Permutation
signatures:
  - call: RskInsertion(Permutation)
    description: The insertion tableau of the RSK correspondence.
    library: enumeratio-combinatorics
    type: (permutation) -> standard_tableau
laws:
  - surjection
  - graded:
      from: Permutations
      to: StandardTableaux
---

- Takes a `Permutation` and returns a `StandardTableau` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Row insertion with bumping, as a fold over the word whose accumulator is the growing tableau, emitted as its rows. See tableau.ts for the indexing rule that makes it evaluate at all.
