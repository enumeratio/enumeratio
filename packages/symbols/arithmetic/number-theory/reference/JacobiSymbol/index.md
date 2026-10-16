---
name: JacobiSymbol
domain: Number theory
signature: JacobiSymbol(n, m)
summary: The Jacobi symbol (n/m), generalising the Legendre symbol to composite m.
signatures:
  - call: JacobiSymbol(n, m)
    description: the Jacobi symbol $\left(\frac{n}{m}\right)$.
seeAlso:
  - PowerMod
  - LegendreSymbol
  - KroneckerSymbol
references:
  - system: wikipedia
    identity: Jacobi symbol
  - system: mathworld
    identity: JacobiSymbol
  - system: rosettacode
    identity: Jacobi symbol
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: jacobi_symbol($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-12
    note: SymPy's jacobi_symbol raises unless the lower argument is odd and positive.
  - origin: mapped
    form: sage
    template: jacobi_symbol($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Generalizes the Legendre symbol from prime $m$ to any odd $m$, by multiplying the Legendre symbols of $m$'s prime factors.
- 0 whenever $n$ and $m$ share a factor.
- Completely multiplicative in the top argument: $\left(\frac{a}{m}\right)\left(\frac{b}{m}\right)=\left(\frac{ab}{m}\right)$.
- By convention $\left(\frac{n}{1}\right)=1$ for every $n$.
- Unlike the Legendre symbol, $\left(\frac{n}{m}\right)=1$ doesn't imply $n$ is a quadratic residue mod $m$ when $m$ is composite.
