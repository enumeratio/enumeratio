---
name: StandardTableau
domain: Collections
signature: StandardTableau(list)
summary: The singular-inhabitant constructor for a standard Young tableau, as its rows.
references:
  - system: wikipedia
    identity: Young tableau
  - system: mathworld
    identity: YoungTableau
stub: carrier
catalogCarrier: true
signatures:
  - call: StandardTableau(list)
    description: The singular-inhabitant constructor for a standard Young tableau, as its rows.
    library: enumeratio-combinatorics
    type: (list<list<integer>>) -> standard_tableau
---
