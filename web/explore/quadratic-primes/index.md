# Quadratic Primes

The primes of every ring of quadratic integers $\mathcal{O}_d$, one field at a time. The
[guide](/docs/number-theory/quadratic-integers) explains what the colors mean.

<div>
<notatio-show
  height="560"
  parameters="[d -> -5, highlight -> Associates]"
  selection="s"
  caption="Primes of $\mathbb{Q}(\sqrt{d})$, d = {d | stepper skip=squarefree random=400}, by norm; selecting an element lights its {highlight | choices='Associates -> associates|IrreducibleFactors -> irreducible factors|Multiples -> multiples|None -> nothing'}. Shift-click to select several; Esc clears."
  value='Show(
    LatticeTiles(QuadraticIntegers(_d),
      ColorRules -> [
        IsPrime -> ColorData("dusk", Sqrt(Abs(Norm)), Band -> 10),
        IsIrreducible && !IsPrime -> Teal,
        IsUnit -> White,
        _highlight(Selected) -> Opacity(0.35, White)],
      ColorMixing -> "Screen",
      BoundaryStyle -> [
        IsZero -> White,
        Unknown -> Gray,
        Selected -> Directive(White, AbsoluteThickness(2.5))]),
    GridLines -> 10,
    Axes -> True)'
></notatio-show>
</div>

Numbers written in a complex base, on these same lattices, have their own exploration:
[complex bases](/explore/complex-bases/).
