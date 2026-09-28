---
name: AlgebraDimension
domain: Structures
signature: AlgebraDimension(algebra)
summary: "The dimension of a finite-dimensional algebra: the length of its basis."
signatures:
  - call: AlgebraDimension(algebra)
    description: for a Clifford algebra, $2^n$ for $n$ generators
    library: enumeratio-hypercomplex
  - call: AlgebraDimension(algebra)
    description: "The `FiniteDimensionalAlgebra` protocol's member: the dimension of any algebra whose type conforms (Mathlib's `Module.finrank`)."
    library: enumeratio-structures
    type: (any) -> unknown
details:
  - Every subset of the generators is one basis blade, so the dimension doubles per generator
  - A separate head from compute-engine's `Dimension`, which is defined for lists and matrices and is deliberately left alone
seeAlso:
  - Basis
  - AlgebraSignature
references:
  - system: wikipedia
    identity: Dimension (vector space)
bindings:
  - origin: mapped
    form: wolfram
    counterpart: false
    note: "No built-in algebra-object type to take a dimension of: `Quaternions` is a domain symbol with no generic dimension function, and `CliffordAlgebra`/`MulticomplexAlgebra` aren't Wolfram heads at all. There is a Wolfram/GeometricAlgebra paclet (resources.wolframcloud.com/PacletRepository) but it's a separate installable paclet, not a ResourceFunction, and this environment has no Wolfram Cloud connection to install or check it against our examples -- also its generator-count convention is unconfirmed against ours. Left unmapped."
    checked:
      version: 15.0.0
      on: 2026-09-28
  - origin: mapped
    form: sage
    template: ($1).dimension()
    arity: 1
  - origin: mapped
    form: oscar
    template: dim($1)
    arity: 1
---
