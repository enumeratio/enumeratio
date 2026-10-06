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
---
