---
name: Implies
domain: Compute engine
signature: Implies(boolean, boolean) -> boolean
summary: "Logical implication: false only when the antecedent is true and the consequent is false. Short-circuits: a `False` antecedent decides (`True`) without evaluating the consequent."
signatures:
  - call: Implies(boolean, boolean) -> boolean
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
---
