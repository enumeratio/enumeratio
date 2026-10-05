---
name: Shape
domain: Compute engine
signature: Shape(value) -> tuple
summary: Return the shape tuple of an expression.
signatures:
  - call: Shape(value) -> tuple
    description: as compute-engine declares it
  - call: Shape(value) -> tuple
    description: reads a nested list's own structure when its elements' type carries no dimensions, as Wolfram's Dimensions does
    library: enumeratio-analytic
    type: (value) -> tuple
    overrides: compute-engine
names:
  wolfram: Dimensions
stub: engine
catalog:
  - system: findstat
    identity: Mp00077
    url: https://www.findstat.org/Mp00077
    on: SemistandardTableau
  - system: findstat
    identity: Mp00079
    url: https://www.findstat.org/Mp00079
    on: SetPartition
  - system: findstat
    identity: Mp00083
    url: https://www.findstat.org/Mp00083
    on: StandardTableau
mapOn:
  - PlanePartition
  - SemistandardTableau
  - SetPartition
  - StandardTableau
---
