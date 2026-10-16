---
name: Transpose
domain: Compute engine
signature: "Transpose(value, axis1: integer?, axis2: integer?) -> value"
summary: Transpose a matrix or swap two tensor axes.
signatures:
  - call: "Transpose(value, axis1: integer?, axis2: integer?) -> value"
    description: as compute-engine declares it
names:
  wolframIdentity: true
stub: engine
catalog:
  - system: findstat
    identity: Mp00084
    url: https://www.findstat.org/Mp00084
    on: StandardTableau
mapOn:
  - PlanePartition
  - StandardTableau
bindings:
  - origin: mapped
    form: sage
    template: "[list(r) for r in matrix($1).transpose().rows()]"
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---
