---
name: RisingFactorial
domain: Combinatorics
signature: RisingFactorial(a, n)
summary: "The rising factorial $a(a+1)\\cdots(a+n-1)$: Fungrim's name for [[Pochhammer]], which it delegates to, extended to a complex non-integer order. Provided by `@enumeratio/analytic`."
signatures:
  - call: RisingFactorial(a, n)
    description: the rising factorial $(a)_n = \Gamma(a+n)/\Gamma(a)$.
    library: "@enumeratio/analytic"
    type: (number, number) -> number
bindings:
  - origin: reference
    form: notatio
    environment: engine
    expr: [Pochhammer, _a, _n]
    note: The native head, wherever it answers.
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/rising-factorial.ts
  - origin: mapped
    form: wolfram / mpmath / sympy
    environment: external
    note: Pochhammer[a, n]; mpmath.rf(a, n); sympy.rf(a, n).
  - origin: mapped
    form: sympy
    template: rf($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: rf($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: rising_factorial($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(_rising, $1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
seeAlso:
  - Pochhammer
  - FallingFactorial
  - Gamma
references:
  - system: wikipedia
    identity: Falling and rising factorials
  - system: dlmf
    identity: "5.2"
names:
  wolfram: Pochhammer
---

- Evaluates as [[Pochhammer]] wherever that head gives an answer, exact or numeric, so the two agree on every shared input. A symbolic order comes back as `Pochhammer(a, n)`.
- Where the native head gives NaN, a complex $a$ with a non-integer order, the value is $\Gamma(a+n)/\Gamma(a)$ through [[LogGamma]]. At a pole of $\Gamma(a)$, $a = 0, -1, -2, \dots$, with $n$ off the integers, $1/\Gamma(a) = 0$ makes the value 0, as in Wolfram and mpmath.
- Unlike [[Pochhammer]], it does not thread over a list.
