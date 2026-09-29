---
name: Assuming
domain: Analytic
signature: Assuming(cond, expr)
summary: Evaluate $expr$ with $cond$ assumed for the duration of the call, then forget it. Provided by `@enumeratio/analytic`.
signatures:
  - call: Assuming(cond, expr)
    description: evaluate $expr$ under a single assumed condition, a `List` of them (an implicit conjunction), or an `And` of them.
    library: "@enumeratio/analytic"
    type: (expression, expression) -> expression
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: wolfram
    template: Assuming[$1, FullSimplify[$2]]
    arity: 2
    note: Wolfram's own Assuming only affects functions that consult $Assumptions (Simplify, FullSimplify, Refine) — a bare Abs(x) inside it stays symbolic, unlike compute-engine's own eager assumption-aware evaluate(). Wrapping the body in FullSimplify is what makes the oracle check the same claim we do.
attributes:
  - HoldAll
---

- Built on compute-engine's own assumption store: the condition is pushed in a fresh scope (`ce.pushScope`/`ce.assume`), $expr$ is evaluated, and the scope is popped — compute-engine documents assumptions as scoped, so popping restores exactly what was in force before, even nested and even mid-evaluation (unlike `ce.checkpoint`, which refuses there).
- No leakage: an assumption made here is gone once the call returns, whatever $expr$ does — verified by asking about the assumed symbol immediately after.
- What resolves under the assumption is whatever compute-engine's own `evaluate()` already consults assumptions for — [[Abs]], [[Sign]], and $\ln \circ \exp$ among them. This is more eager than bare Wolfram evaluation for those heads (Wolfram leaves `Abs(x)` alone until `Refine`/`Simplify` names it explicitly); it is not a general Simplify.
