---
name: Rsk
domain: Combinatorial maps
signature: Rsk(Permutation)
summary: "The RSK correspondence: the insertion and recording tableaux, as a pair."
references:
  - system: wikipedia
    identity: Robinson–Schensted correspondence
mapOn:
  - Permutation
signatures:
  - call: Rsk(Permutation)
    description: "The RSK correspondence: the insertion and recording tableaux, as a pair."
    library: enumeratio-combinatorics
    type: (permutation) -> standard_tableau_pair
---

- Takes a `Permutation` and returns a `StandardTableauPair` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Both tableaux share a shape (RskShape reads it off either), and each carries its own rows, so the pair alone determines them. A standard_tableau_pair is a tuple of two carriers — the first composite carrier anything here constructs.
