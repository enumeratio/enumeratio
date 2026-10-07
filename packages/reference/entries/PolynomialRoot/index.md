---
name: PolynomialRoot
domain: Number theory
signature: PolynomialRoot(p, k)
primitive: kernel
summary: "The $k$-th root of the polynomial $p$ in its one unknown, in Wolfram's order: real roots first, increasing, then complex roots by real part and imaginary part. Wolfram's `Root`; compute-engine's `Root` is the $n$-th root."
signatures:
  - call: PolynomialRoot(p, k)
    description: "the $k$-th root of $p$, exact: rational and quadratic roots are written as radicals, others stay a name for the root"
    library: enumeratio-number-theory
    type: (any, integer) -> number
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/ce-patches/src/compute-engine/library/algebraic-numbers.ts
  - origin: mapped
    form: wolfram
    template: Root[$1, $2]
    arity: 2
    note: Wolfram's Root, which compute-engine's nth-root Root would shadow.
seeAlso:
  - MinimalPolynomial
  - NumberFieldIntegralBasis
  - Root
---

- A root of degree 3 or more stays `PolynomialRoot(p, k)`, an exact algebraic number that [[MinimalPolynomial]], [[NumberFieldDiscriminant]] and the other number-field heads read
- Roots of a reducible $p$ are left unevaluated rather than reduced to a factor's
