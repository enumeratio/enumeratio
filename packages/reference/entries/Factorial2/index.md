---
name: Factorial2
domain: Combinatorics
signature: Factorial2(n)
summary: The double factorial $n!!$, the product of every second integer from n down to 1 or 2.
signatures:
  - call: Factorial2(n)
    description: the double factorial $n!!$.
  - call: Factorial2(n)
    description: The double factorial $n!!$, the product of every second integer from n down to 1 or 2.
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
  - call: Factorial2(n)
    description: The double factorial $n!!$, the product of every second integer from n down to 1 or 2.
    library: enumeratio-number-theory
    type: (any) -> any
    overrides: enumeratio-analytic
seeAlso:
  - Factorial
references:
  - system: wikipedia
    identity: Double factorial
  - system: mathworld
    identity: DoubleFactorial
names:
  fungrim: DoubleFactorial
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: factorial2($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: fac2($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: Integer($1).multifactorial(2)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Skips every other factor: $n!! = n(n-2)(n-4)\cdots$, stopping at 1 (n odd) or 2 (n even).
- Recurrence: $n!! = n\,(n-2)!!$, with $0!! = 1$.
- Splits an ordinary factorial into its even and odd parts: $n! = n!!\,(n-1)!!$.
- $(2n-1)!!$ counts the perfect matchings of $2n$ objects into pairs.
- The recurrence run downwards extends it to negative odd integers, $(-2k-1)!! = \dfrac{(-1)^k}{(2k-1)!!}$; at negative even integers it hits a pole (a division by the $0!!$ term) and returns NaN.
