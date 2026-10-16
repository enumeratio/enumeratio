---
name: CarlsonRD
domain: Wolfram
signature: CarlsonRD(...)
summary: Wolfram's own CarlsonRD, mapped through for the transpiler and the oracle but not yet written up here.
names:
  wolframIdentity: true
stub: carrier
signatures:
  - call: CarlsonRD(...)
    description: Wolfram's own CarlsonRD, mapped through for the transpiler and the oracle but not yet written up here.
    library: enumeratio-analytic
    type: (number, number, number) -> number
bindings:
  - origin: mapped
    form: mpmath
    template: elliprd($1, $2, $3)
    arity: 3
    threadArgOnly:
      - 1
      - 2
      - 3
    checked:
      version: 1.3.0
      on: 2026-10-15
---
