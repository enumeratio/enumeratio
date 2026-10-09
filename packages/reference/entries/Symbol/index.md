---
name: Symbol
domain: Compute engine
signature: Symbol(value+) -> symbol
summary: Construct a symbol named by joining the arguments
signatures:
  - call: Symbol(value+) -> symbol
    description: as compute-engine declares it
  - call: Symbol(value+) -> symbol
    description: stays unevaluated unless its argument is a string, as in Wolfram.
    library: enumeratio-combinatorics
    type: function
    overrides: compute-engine
stub: engine
names:
  wolframIdentity: true
attributes:
  - HoldAll
---
