---
name: PiecewiseExpand
domain: Analytic
signature: PiecewiseExpand(expr, assumptions)
summary: Rewrite [[Abs]], [[Sign]], [[Min]], [[Max]], [[UnitStep]], [[Clip]], [[UnitBox]], [[UnitTriangle]] and, over a bounded variable, [[Floor]], [[Ceil]], [[Round]], [[IntegerPart]], [[FractionalPart]], [[Mod]], [[Quotient]] and the waves inside $expr$ into [[Piecewise]], recursively. Provided by `@enumeratio/analytic`.
signatures:
  - call: PiecewiseExpand(expr)
    description: rewrite using whatever is already assumed (e.g. inside an enclosing [[Assuming]]).
    library: "@enumeratio/analytic"
    type: (expression, expression?) -> expression
  - call: PiecewiseExpand(expr, assumptions)
    description: assume $assumptions$ (scoped, as in [[Assuming]]) for the rewrite, then forget it.
    library: "@enumeratio/analytic"
names:
  wolframIdentity: true
attributes:
  - HoldAll
---

- [[Abs]], [[Sign]] and [[Argument]] expand only once their argument is known real — on a genuinely complex value they are not piecewise-comparable, so (matching Wolfram's own `PiecewiseExpand`) an argument whose realness isn't established is left untouched rather than guessed at. `RealNumbers` as the assumption makes every variable real.
- [[Min]], [[Max]], [[UnitStep]], [[Clip]], [[UnitBox]] and [[UnitTriangle]] need no assumption, as in Wolfram: they expand over any symbols. The branches, conditions and default follow Wolfram's: a condition between two unknowns is written `x - y >= 0`, one against a constant `x <= 2`, and a zero-valued branch is the default.
- [[Floor]], [[Ceil]], [[Round]], [[IntegerPart]], [[FractionalPart]], [[Mod]] and [[Quotient]] by an integer, and [[SquareWave]], [[TriangleWave]] and [[SawtoothWave]], expand over a symbol bounded on both sides by an assumption (`0 < x < 3`), one branch per stretch. A span of 100 or more is left alone, as Wolfram leaves it.
- Rewrites recurse into subexpressions, so `PiecewiseExpand(Abs(x) + 1, …)` rewrites the `Abs` inside the sum. A relation is not entered (Wolfram turns a Piecewise inside one into conditions), and a [[Min]] or [[Max]] over an argument that itself expands stays as written, since there is no Piecewise composition.
