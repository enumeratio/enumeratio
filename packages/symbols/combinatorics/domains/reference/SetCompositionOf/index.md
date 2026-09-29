---
name: SetCompositionOf
domain: Combinatorial maps
signature: SetCompositionOf(Surjection)
summary: "The set composition a surjection labels: block j holds the positions labelled j."
signatures:
  - call: SetCompositionOf(Surjection)
    description: "The set composition a surjection labels: block j holds the positions labelled j."
    library: enumeratio-domains
    type: (surjection) -> set_composition
---

- Takes a `Surjection` and returns a `SetComposition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
