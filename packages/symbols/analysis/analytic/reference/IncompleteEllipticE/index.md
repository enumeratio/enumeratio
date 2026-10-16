---
name: IncompleteEllipticE
domain: Wolfram
signature: IncompleteEllipticE(...)
summary: Wolfram's own EllipticE, mapped through for the transpiler and the oracle but not yet written up here.
names:
  wolfram: EllipticE
bindings:
  - origin: mapped
    form: sympy
    template: elliptic_e($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: The second argument is the parameter m = k^2 in both, not the modulus k.
  - origin: mapped
    form: mpmath
    template: ellipe($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: elliptic_e($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: "10.9"
      on: 2026-10-16
stub: carrier
signatures:
  - call: IncompleteEllipticE(...)
    description: Wolfram's own EllipticE, mapped through for the transpiler and the oracle but not yet written up here.
    library: enumeratio-analytic
    type: (number, number) -> number
---
