---
name: Cancel
domain: Compute engine
signature: Cancel(value, symbol?) -> value
summary: "Cancel common polynomial factors in the numerator and denominator of a rational expression. Example: Cancel((x² - 1)/(x - 1), x) → x + 1"
signatures:
  - call: Cancel(value, symbol?) -> value
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
---
