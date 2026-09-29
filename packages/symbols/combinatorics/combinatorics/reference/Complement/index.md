---
name: Complement
domain: Combinatorial maps
signature: Complement(Permutation)
summary: Each entry replaced by n + 1 minus itself.
catalog:
  - system: findstat
    identity: Mp00039
    url: https://www.findstat.org/Mp00039
    on: Composition
  - system: findstat
    identity: Mp00069
    url: https://www.findstat.org/Mp00069
    on: Permutation
mapOn:
  - BinaryWord
  - Composition
  - Permutation
signatures:
  - call: Complement(Permutation)
    description: Each entry replaced by n + 1 minus itself.
    library: enumeratio-combinatorics
    type: ((set<any>+) -> set) & ((permutation) -> permutation)
    overrides: compute-engine
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
