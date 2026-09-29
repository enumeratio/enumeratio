---
name: SurjectionOf
domain: Combinatorial maps
signature: SurjectionOf(SetComposition)
summary: "A set composition as a surjection: each position labelled with its block's index, from 1."
signatures:
  - call: SurjectionOf(SetComposition)
    description: "A set composition as a surjection: each position labelled with its block's index, from 1."
    library: enumeratio-domains
    type: (set_composition) -> surjection
---

- Takes a `SetComposition` and returns a `Surjection` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
