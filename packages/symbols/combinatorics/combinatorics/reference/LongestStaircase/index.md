---
name: LongestStaircase
domain: Composition statistics
signature: LongestStaircase(composition)
summary: The greatest l with parts at positions i_1 < ... < i_l such that part i_m is at least m.
catalog:
  - system: findstat
    identity: St000758
    url: https://www.findstat.org/St000758
    on: Composition
statOn:
  - Composition
signatures:
  - call: LongestStaircase(composition)
    description: The greatest l with parts at positions i_1 < ... < i_l such that part i_m is at least m.
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Skandera, An Eulerian partner for inversions (Definition 3.1): taking each part that exceeds the staircase so far is optimal.
