---
name: CarlsonRC
domain: Wolfram
signature: CarlsonRC(...)
summary: Wolfram's own CarlsonRC, mapped through for the transpiler and the oracle but not yet written up here.
names:
  wolframIdentity: true
stub: carrier
signatures:
  - call: CarlsonRC(...)
    description: Wolfram's own CarlsonRC, mapped through for the transpiler and the oracle but not yet written up here.
    library: enumeratio-analytic
    type: (number, number) -> number
bindings:
  - origin: mapped
    form: mpmath
    template: elliprc($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
---
