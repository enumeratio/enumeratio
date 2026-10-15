---
name: Normal
domain: Compute engine
signature: Normal(value) -> value
summary: 'Strip Big-O remainder terms from a series, yielding the truncated polynomial. Example: Normal(Series(\sin x, x)) → x - x^3/6 + x^5/120'
signatures:
  - call: Normal(value) -> value
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: $1
    arity: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: Wolfram's Normal hands back an expression that is no series as it is, which is what SymPy has to do. A Series under it (or under Simplify) is the polynomial without its O-term, `removeO()`, emitted by the emitter.
---
