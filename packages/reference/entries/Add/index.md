---
name: Add
domain: Compute engine
signature: Add(value+) -> value
summary: Sum of two or more values.
signatures:
  - call: Add(value+) -> value
    description: as compute-engine declares it
  - call: Add(value+) -> value
    description: Sum of two or more values.
    library: enumeratio-analytic
    type: (value+) -> value
    overrides: compute-engine
    on:
      - Around
      - CenteredInterval
      - Interval
  - call: Add(value+) -> value
    description: Sum of two or more values.
    library: enumeratio-hypercomplex
    type: (value+) -> value
    overrides: enumeratio-analytic
  - call: Add(value+) -> value
    description: Sum of two or more values.
    library: enumeratio-residues
    type: (value+) -> value
    overrides: enumeratio-hypercomplex
    on:
      - IntegerMod
  - call: Add(value+) -> value
    description: Sum of two or more values.
    library: enumeratio-numerals
    type: (value+) -> value
    overrides: enumeratio-residues
    on:
      - AdicNumeral
  - call: Add(value+) -> value
    description: Sum of two or more values.
    library: enumeratio-adeles
    type: (value+) -> value
    overrides: enumeratio-numerals
    on:
      - Adele
      - ProfiniteNumber
names:
  wolfram: Plus
stub: engine
bindings:
  - origin: mapped
    form: sympy
    template: ($*+)
  - origin: mapped
    form: mpmath
    template: ($*+)
  - origin: mapped
    form: sage
    template: ($*+)
  - origin: mapped
    form: oscar
    template: ($*+)
  - origin: mapped
    form: julia
    template: ($*+)
  - origin: mapped
    form: mathlib4
    template: ($*+)
  - origin: mapped
    form: rust
    template: ($*+)
attributes:
  - HoldAll
---
