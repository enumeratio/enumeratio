---
name: Composition
domain: Collections
signature: Composition(list)
summary: The singular-inhabitant constructor for a composition of an integer, as its parts.
references:
  - system: wikipedia
    identity: Composition (combinatorics)
  - system: mathworld
    identity: Composition
catalogCarrier: true
signatures:
  - call: Composition(list)
    description: The singular-inhabitant constructor for a composition of an integer, as its parts.
    library: enumeratio-combinatorics
    type: ((list<integer>) -> composition) & ((binary_word) -> composition)
---
