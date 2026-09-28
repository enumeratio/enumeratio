---
name: Simplify
domain: Compute engine
signature: Simplify(expr, options?)
summary: A simpler equivalent of an expression, optionally under assumptions such as $x > 0$.
signatures:
  - call: Simplify(expr, options?)
    description: Runs compute-engine's own simplifier and then folds a quotient of same-argument $\sin/\cos$ or $\sinh/\cosh$ into $\tan$/$\cot$/$\tanh$/$\coth$, and applies $\cosh^2 - \sinh^2 = 1$, identities Wolfram's `Simplify` recognizes but compute-engine's does not.
    library: enumeratio-analytic
    type: (any, any?) -> expression
    overrides: compute-engine
attributes:
  - HoldAll
---
