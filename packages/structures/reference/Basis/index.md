---
name: Basis
domain: Structures
signature: Basis(algebra)
summary: The basis of a finite-dimensional algebra, as a list.
signatures:
  - call: Basis(algebra)
    description: 'for a Clifford algebra, its $2^n$ blades, ordered by grade then by generator: $\mathbb{H}$ is $(1, i, j, k)$.'
    library: enumeratio-hypercomplex
  - call: Basis(algebra)
    description: "The `FiniteDimensionalAlgebra` protocol's member: the basis of any algebra whose type conforms."
    library: enumeratio-structures
    type: (any) -> unknown
details:
  - An algebra is an ordered list of generators; the families already carry the squares and the commutation rules
  - "Constructors: `CliffordAlgebra(p, q)`, `MulticomplexAlgebra(n)`, `SplitAlgebra(n)`, `DualAlgebra(n)`, `GrassmannAlgebra(n)`"
  - 'Named: [[Quaternions]] (also $\mathbb{H}$), `BicomplexNumbers`, `TricomplexNumbers`, `SplitComplexNumbers`, `DualNumbers`'
  - No element constructor is needed — `Dot` threads a tuple of scalars over the basis
seeAlso:
  - Quaternions
  - AlgebraDimension
  - AlgebraSignature
references:
  - system: wikipedia
    identity: Basis (linear algebra)
  - system: mathworld
    identity: VectorBasis
bindings:
  - origin: mapped
    form: sage
    template: list(($1).basis())
    arity: 1
---
