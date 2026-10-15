---
name: CarlsonRJ
domain: Wolfram
signature: CarlsonRJ(...)
summary: Wolfram's own CarlsonRJ, mapped through for the transpiler and the oracle but not yet written up here.
names:
  wolframIdentity: true
stub: carrier
signatures:
  - call: CarlsonRJ(...)
    description: Wolfram's own CarlsonRJ, mapped through for the transpiler and the oracle but not yet written up here.
    library: enumeratio-analytic
    type: (number, number, number, number) -> number
bindings:
  - origin: mapped
    form: mpmath
    template: elliprj($1, $2, $3, $4)
    arity: 4
    threadArgOnly:
      - 1
      - 2
      - 3
      - 4
    checked:
      version: 1.3.0
      on: 2026-10-15
---
