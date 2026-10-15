---
name: Boole
domain: Compute engine
signature: Boole(boolean) -> integer
summary: Return 1 if the argument is true, 0 otherwise. Also known as the Iverson bracket
signatures:
  - call: Boole(boolean) -> integer
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: Piecewise((1, $1), (0, True))
    arity: 1
    checked:
      version: 1.14.0
      on: 2026-10-15
    note: Piecewise over the condition, which is a SymPy relational or And/Or/Not.
---
