---
name: Element
domain: Compute engine
signature: Element(any, any, boolean?) -> boolean
summary: |-
  Test whether a value is an element of a collection. Optional third argument is a boolean expression (condition) for filtered iteration in Sum/Product.

  Element supports two modes of operation:
  1. Set membership: Element(3, [List, 1, 2, 3]) checks if 3 is in the list
  2. Type-style membership: Element(x, integer) checks if x has type integer

  Type-style membership works with:
  - Mathematical sets: Integers, RealNumbers, ComplexNumbers, etc.
  - Type names: integer, rational, real, number, positive_integer, etc.
  - Invalid type names remain unevaluated (e.g., Element(2, "Booleans"))
signatures:
  - call: Element(any, any, boolean?) -> boolean
    description: as compute-engine declares it
  - call: Element(any, any, boolean?) -> boolean
    description: |-
      Test whether a value is an element of a collection. Optional third argument is a boolean expression (condition) for filtered iteration in Sum/Product.

      Element supports two modes of operation:
      1. Set membership: Element(3, [List, 1, 2, 3]) checks if 3 is in the list
      2. Type-style membership: Element(x, integer) checks if x has type integer

      Type-style membership works with:
      - Mathematical sets: Integers, RealNumbers, ComplexNumbers, etc.
      - Type names: integer, rational, real, number, positive_integer, etc.
      - Invalid type names remain unevaluated (e.g., Element(2, "Booleans"))
    library: enumeratio-domains
    type: (any, any, boolean?) -> boolean
    overrides: enumeratio-structures
  - call: Element(any, any, boolean?) -> boolean
    description: |-
      Test whether a value is an element of a collection. Optional third argument is a boolean expression (condition) for filtered iteration in Sum/Product.

      Element supports two modes of operation:
      1. Set membership: Element(3, [List, 1, 2, 3]) checks if 3 is in the list
      2. Type-style membership: Element(x, integer) checks if x has type integer

      Type-style membership works with:
      - Mathematical sets: Integers, RealNumbers, ComplexNumbers, etc.
      - Type names: integer, rational, real, number, positive_integer, etc.
      - Invalid type names remain unevaluated (e.g., Element(2, "Booleans"))
    library: enumeratio-structures
    type: (any, any, boolean?) -> boolean
    overrides: compute-engine
bindings:
  - origin: mapped
    form: wolfram
    template: Element[$1, $2]
    arity: 2
    note: Only a real match for a Wolfram domain symbol as the second operand (`Element[7, Primes]`, kernel-verified True); against a literal list or one of our own collections (a diagram algebra's basis, PolygonalNumbers(k), …) real Element stays unevaluated instead of erroring, so the scan will record those as disagreements rather than a wrong-but-silent answer.
    checked:
      version: 15.0.0
      on: 2026-09-27
  - origin: mapped
    form: sage
    template: enumeratio_element($1, $2)
    arity: 2
stub: engine
---
