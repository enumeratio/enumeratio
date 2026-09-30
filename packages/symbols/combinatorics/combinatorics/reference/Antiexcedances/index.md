---
name: Antiexcedances
domain: Permutation statistics
signature: Antiexcedances(p)
summary: "The number of antiexcedances of $p$: positions $i$ with $p_i < i$."
signatures:
  - call: Antiexcedances(p)
    description: the antiexcedance count of a one-line permutation $p$
    library: enumeratio-combinatorics
    type: (permutation) -> integer
seeAlso:
  - Excedances
  - Descents
  - SymmetricGroup
---

- Equidistributed with [[Excedances]] over $S_n$: inverting a permutation swaps its excedance and antiexcedance counts
- Never counts a fixed point, same as [[Excedances]]
- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
