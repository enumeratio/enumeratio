---
name: Cos
domain: Elementary functions
signature: Cos(x)
summary: The cosine of x, in radians.
signatures:
  - call: Cos(x)
    description: the cosine of x, in radians.
  - call: Cos(x)
    description: The cosine of x, in radians.
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
seeAlso:
  - Sin
  - Tan
  - Sec
  - Arccos
references:
  - system: wikipedia
    identity: Sine and cosine
  - system: mathworld
    identity: Cosine
  - system: dlmf
    identity: "4.14"
names:
  dlmf: cosine function
  wolframIdentity: true
bindings:
  - origin: mapped
    form: wolfram
    template: Cos[$1]
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sympy
    template: cos($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: mpmath
    template: cos($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sage
    template: cos($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: rust
    template: cos($1)
    arity: 1
    threadArg: 1
---

- Even function: $\cos(-x) = \cos(x)$.
- Period $2\pi$.
- Reciprocal of [[Sec]]: $\cos(x) = \frac{1}{\sec(x)}$.
- Co-function with [[Sin]]: $\cos(x) = \sin(\pi/2 - x)$.
