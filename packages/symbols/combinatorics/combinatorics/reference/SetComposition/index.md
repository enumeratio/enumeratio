---
name: SetComposition
domain: Collections
signature: SetComposition(list)
summary: The singular-inhabitant constructor for a composition of a set, as its ordered blocks.
references:
  - system: wikipedia
    identity: Weak ordering
catalogCarrier: true
signatures:
  - call: SetComposition(list)
    description: The singular-inhabitant constructor for a composition of a set, as its ordered blocks.
    library: enumeratio-combinatorics
    type: ((list<list<integer>>) -> set_composition) & ((surjection) -> set_composition)
laws:
  - inverse: Surjection
---
