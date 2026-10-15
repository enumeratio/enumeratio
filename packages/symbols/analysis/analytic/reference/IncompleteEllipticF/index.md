---
name: IncompleteEllipticF
domain: Wolfram
signature: IncompleteEllipticF(...)
summary: Wolfram's own EllipticF, mapped through for the transpiler and the oracle but not yet written up here.
names:
  wolfram: EllipticF
bindings:
  - origin: mapped
    form: sympy
    template: elliptic_f($1, $2)
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
    template: ellipf($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
stub: carrier
signatures:
  - call: IncompleteEllipticF(...)
    description: Wolfram's own EllipticF, mapped through for the transpiler and the oracle but not yet written up here.
    library: enumeratio-analytic
    type: (number, number) -> number
---
