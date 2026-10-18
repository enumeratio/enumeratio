---
name: PartsEqualToReversedPart
domain: Composition statistics
signature: PartsEqualToReversedPart(composition)
summary: Positions i where the part equals the part at the mirror position.
catalog:
  - system: findstat
    identity: St001675
    url: https://www.findstat.org/St001675
    on: Composition
statOn:
  - Composition
signatures:
  - call: PartsEqualToReversedPart(composition)
    description: Positions i where the part equals the part at the mirror position.
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Andrews, Just and Simay, Anti-palindromic compositions.
