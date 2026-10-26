---
name: SortingIndex
domain: Permutation statistics
signature: SortingIndex(p)
summary: The total distance the entries move in selection sort.
catalog:
  - system: findstat
    identity: St000224
    url: https://www.findstat.org/St000224
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: SortingIndex(p)
    description: The total distance the entries move in selection sort.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Selection sort swaps n into place, then n - 1, and so on; the fold carries the total and the word.
