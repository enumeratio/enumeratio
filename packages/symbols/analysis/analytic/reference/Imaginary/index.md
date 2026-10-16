---
name: Imaginary
domain: Compute engine
signature: Imaginary(complex | infinity) -> number
summary: Imaginary part of a complex number.
signatures:
  - call: Imaginary(complex | infinity) -> number
    description: as compute-engine declares it
  - call: Imaginary(complex | infinity) -> number
    description: the imaginary part; of a directed infinity, the infinity of its sign, or 0 when it has none.
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
names:
  fungrim: Im
  wolfram: Im
bindings:
  - origin: mapped
    form: mpmath
    template: im($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: imag_part($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- A Gaussian integer is a complex number with integer parts, so `Im` and [[Re]] read its two coordinates; there is no separate head for them.
