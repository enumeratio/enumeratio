---
name: Dot
domain: Compute engine
signature: Dot(list<tuple> | matrix | tuple | vector, list<tuple> | matrix | tuple | vector) -> value
summary: Dot product (vector inner product) or matrix product.
signatures:
  - call: Dot(list<tuple> | matrix | tuple | vector, list<tuple> | matrix | tuple | vector) -> value
    description: as compute-engine declares it
  - call: Dot(list<tuple> | matrix | tuple | vector, list<tuple> | matrix | tuple | vector) -> value
    description: Dot product (vector inner product) or matrix product.
    library: enumeratio-modular
    type: (expression<ModularMatrix> | list<tuple> | matrix | matrix | string | tuple | tuple | vector | vector, expression<ModularMatrix> | list<tuple> | matrix | matrix | string | tuple | tuple | vector | vector) -> expression<ModularMatrix> | matrix | number | value | vector
    overrides: compute-engine
names:
  wolframIdentity: true
stub: engine
---
