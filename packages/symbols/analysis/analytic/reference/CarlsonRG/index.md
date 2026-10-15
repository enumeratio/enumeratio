---
name: CarlsonRG
domain: Wolfram
signature: CarlsonRG(...)
summary: Wolfram's own CarlsonRG, mapped through for the transpiler and the oracle but not yet written up here.
names:
  wolframIdentity: true
stub: carrier
signatures:
  - call: CarlsonRG(...)
    description: Wolfram's own CarlsonRG, mapped through for the transpiler and the oracle but not yet written up here.
    library: enumeratio-analytic
    type: (number, number, number) -> number
bindings:
  - origin: mapped
    form: mpmath
    template: elliprg($1, $2, $3)
    arity: 3
    threadArgOnly:
      - 1
      - 2
      - 3
    checked:
      version: 1.3.0
      on: 2026-10-15
---
