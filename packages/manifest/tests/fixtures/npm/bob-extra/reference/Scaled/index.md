---
name: Scaled
domain: Arithmetic
summary: Its argument times factor, two unless given.
definition:
  signature: "(x: number, factor: number?) -> number"
  body: factor * x
  defaults:
    factor: "2"
---
