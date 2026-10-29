---
name: LegendreSymbol
domain: Number theory
signature: LegendreSymbol(n, p)
summary: "The Legendre symbol (n/p): whether n is a quadratic residue mod the odd prime p."
signatures:
  - call: LegendreSymbol(n, p)
    description: the Legendre symbol $\left(\frac{n}{p}\right)$.
seeAlso:
  - JacobiSymbol
  - KroneckerSymbol
references:
  - system: wikipedia
    identity: Legendre symbol
  - system: mathworld
    identity: LegendreSymbol
names:
  wolfram: JacobiSymbol
bindings:
  - origin: mapped
    form: sympy
    template: legendre_symbol($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-12
    note: SymPy's legendre_symbol raises unless the lower argument is an odd prime.
  - origin: mapped
    form: sage
    template: legendre_symbol($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: mathlib4
    template: (jacobiSym $1 $2)
    arity: 2
    note: Mathlib's legendreSym needs a Fact p.Prime instance a literal cannot supply, so this reads jacobiSym a p, which Mathlib proves equal to legendreSym p a at an odd prime p (jacobiSym.legendreSym.to_jacobiSym); a composite or even p is outside the Legendre domain and gives the Jacobi value or zero.
---

- 1 if $n$ is a nonzero quadratic residue mod $p$, $-1$ if it is a nonresidue, 0 if $p\mid n$.
- Defined only for an odd prime $p$; compute-engine leaves the call symbolic for any other $p$.
- The prime case of [[JacobiSymbol]] and [[KroneckerSymbol]] — all three agree wherever the domains overlap.
