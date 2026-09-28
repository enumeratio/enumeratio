---
name: DyckPath
domain: Collections
signature: DyckPath(list)
summary: The singular-inhabitant constructor for a Dyck path, as its up/down steps.
references:
  - system: wikipedia
    identity: Dyck language
  - system: mathworld
    identity: DyckPath
stub: carrier
catalogCarrier: true
signatures:
  - call: DyckPath(list)
    description: The singular-inhabitant constructor for a Dyck path, as its up/down steps.
    library: enumeratio-domains
    type: (list<integer>) -> dyck_path
---
