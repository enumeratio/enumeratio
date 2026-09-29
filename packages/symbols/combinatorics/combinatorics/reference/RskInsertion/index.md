---
name: RskInsertion
domain: Combinatorial maps
signature: RskInsertion(Permutation)
summary: The insertion tableau of the RSK correspondence.
references:
  - system: wikipedia
    identity: Robinson–Schensted correspondence
mapOn:
  - Permutation
signatures:
  - call: RskInsertion(Permutation)
    description: The insertion tableau of the RSK correspondence.
    library: enumeratio-combinatorics
    type: (permutation) -> standard_tableau
---

- Takes a `Permutation` and returns a `StandardTableau` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Row insertion with bumping, as a fold over the word whose accumulator is the growing tableau. Emitted as a ROW WORD because that is what the carrier is; with RskShape it determines the tableau. See tableau.ts for the indexing rule that makes it evaluate at all.
