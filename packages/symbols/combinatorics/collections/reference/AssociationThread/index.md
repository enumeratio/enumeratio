---
name: AssociationThread
domain: Collections
signature: AssociationThread(keys, values) / AssociationThread(keys -> values)
summary: An Association pairing keys with values, positionally.
signatures:
  - call: AssociationThread(keys, values)
    description: Association(Rule(keys[1], values[1]), …) — keys and values the same length
    library: enumeratio-collections
    type: (collection<any> | expression<Rule>, collection<any>?) -> any
  - call: AssociationThread(keys -> values)
    description: the same, with keys and values given as one Rule instead of two arguments
    library: enumeratio-collections
seeAlso:
  - Association
names:
  wolframIdentity: true
---

- Builds the SAME `Association` head as [[Association]] — Rule pairs, not compute-engine's string-keyed Dictionary. See that entry's own notes for why.
