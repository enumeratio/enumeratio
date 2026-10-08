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
- [[Min]], [[Max]], [[UnitStep]], [[Clip]], [[UnitBox]] and [[UnitTriangle]] need no assumption, as in Wolfram: they expand over any symbols. The branches, conditions and default follow Wolfram's: a condition between two unknowns is written `x - y >= 0`, one against a constant `x <= 2`, and a zero-valued branch is the default. What the assumptions decide of a condition is not written (`UnitBox(x)` on `0 < x < 2` is `x <= 1/2`), a branch they rule out goes, and when the branches cover what is left the last one is the default.
- [[Floor]], [[Ceil]], [[Round]], [[IntegerPart]], [[FractionalPart]], [[Mod]] and [[Quotient]], and [[SquareWave]], [[TriangleWave]] and [[SawtoothWave]], expand over an argument bounded on both sides by an assumption, one branch per stretch. The bound is read as an interval: `0 < x < 3`, but also `x^2 < 3`, `0 < 2 x < 5`, a constant such as `Pi`, or `x < 3 y` with `0 < y < 1`. The argument is a symbol, linear in one (`Floor(2 x)`), or over an interval where it is monotone a square or square root of one (`Floor(x^2)` is bounded by `Sqrt(2)`, `Sqrt(3)`). A modulus, or the multiple in a two-argument [[Floor]], is a positive number, a constant, or a symbol: `Mod(k, m)` with `0 <= k <= 3 m` reads the bound as `0 <= k/m <= 3` and writes its conditions on `k/m`. The values are written as Wolfram's `Together` writes them, in its order. A span of 100 stretches or more is left alone, as Wolfram leaves it.
- Rewrites recurse into subexpressions, so `PiecewiseExpand(Abs(x) + 1, …)` rewrites the `Abs` inside the sum. A sum, product or power of Piecewise values, or a [[Max]], [[Min]], [[Clip]] or step over them, is one Piecewise: a branch for each combination, values that agree sharing their conditions, a zero value (else the last in Wolfram's order) the default. Conditions that are bounds on one unknown merge into intervals (`x <= 0` with `x >= 0` is `x == 0`, and two intervals that do not touch stay apart as `x > 0 || x < 0`). A relation is not entered (Wolfram turns a Piecewise inside one into conditions).
