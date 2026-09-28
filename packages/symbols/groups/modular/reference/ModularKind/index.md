---
name: ModularKind
domain: The modular group
signature: ModularKind(matrix)
summary: 'The trichotomy of an element by $|\mathrm{tr}|$ against 2: Identity, Elliptic, Parabolic or Hyperbolic.'
signatures:
  - call: ModularKind(matrix)
    description: Identity, Elliptic, Parabolic or Hyperbolic
    library: enumeratio-modular
    type: (expression<ModularMatrix> | list | string) -> string
seeAlso:
  - ModularMatrix
  - ModularTrace
---
