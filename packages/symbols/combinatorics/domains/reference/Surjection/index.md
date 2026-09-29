---
name: Surjection
domain: Collections
signature: Surjection(list)
summary: The singular-inhabitant constructor for a surjection from positions onto 1..k, as its word.
catalogCarrier: true
signatures:
  - call: Surjection(list)
    description: The singular-inhabitant constructor for a surjection from positions onto 1..k, as its word.
    library: enumeratio-domains
    type: ((list<integer>) -> surjection) & ((set_composition) -> surjection)
---
