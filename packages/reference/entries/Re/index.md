---
name: Re
domain: Compute engine
signature: Re(complex | infinity) -> number
summary: The real part of a complex number. An alias for `Real`, the preferred name.
signatures:
  - call: Re(complex | infinity) -> number
    description: the real part of $z$; distributes over a symbolic real value unchanged.
    type: (complex | infinity) -> number
seeAlso:
  - Imaginary
  - Conjugate
  - Argument
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: re($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: re($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: real_part($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- A Gaussian integer is a complex number with integer parts, so `Re` and [[Imaginary]] read its two coordinates; there is no separate head for them.
