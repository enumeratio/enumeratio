---
name: Simplify
domain: Compute engine
signature: Simplify(expr, options?)
summary: A simpler equivalent of an expression, optionally under assumptions such as $x > 0$.
signatures:
  - call: Simplify(expr, options?)
    description: Runs compute-engine's own simplifier and then folds a quotient of same-argument $\sin/\cos$ or $\sinh/\cosh$ into $\tan$/$\cot$/$\tanh$/$\coth$, and applies $\cosh^2 - \sinh^2 = 1$, identities Wolfram's `Simplify` recognizes but compute-engine's does not. An expression in `GoldenRatio` and rationals that is rational folds to it ($1 + 1/\varphi - \varphi = 0$).
    library: enumeratio-analytic
    type: (any, any?) -> expression
    overrides: compute-engine
  - call: Simplify(expr, options?)
    description: After the passes above, folds the `IntegerMod` classes among a sum's or product's operands into one class in their common ring.
    library: enumeratio-residues
    type: (any, any?) -> expression
    overrides: enumeratio-analytic
bindings:
  - origin: mapped
    form: sympy
    template: simplify($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: SymPy has one simplifier, so FullSimplify maps to it too. The scan compares what each answers by value (the difference simplifies to zero, or agrees at sample points), not by form; an answer ours leaves as written is no agreement unless SymPy leaves it too. Assumptions (a second operand) are not mapped.
  - origin: mapped
    form: sage
    template: SR($1).simplify_full()
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
attributes:
  - HoldAll
names:
  wolfram: Simplify
---
