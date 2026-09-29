---
name: KeyValuePair
domain: Compute engine
signature: KeyValuePair(key, value)
summary: A key/value pair -- how an option is passed to a head that takes one, e.g. `FactorInteger(5, KeyValuePair(Over, GaussianIntegers))`.
signatures:
  - call: KeyValuePair(key, value)
    description: as compute-engine declares it
names:
  wolfram: Rule
bindings:
  - origin: mapped
    form: sympy
    template: ($1, $2)
    arity: 2
    checked:
      version: 1.14.0
      on: 2026-09-27
  - origin: mapped
    form: sage
    template: ($1, $2)
    arity: 2
    checked:
      version: "10.9"
      on: 2026-09-27
stub: engine
---
