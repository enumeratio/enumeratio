# Quadratic Primes

The primes of every ring of quadratic integers $\mathcal{O}_d$, one field at a time. The
[guide](/docs/number-theory/quadratic-integers) explains what the colors mean.

<div>
<notatio-labeled
  position="below"
  variables='[
    _d -> Variable(Integers, -5, Where -> IsSquareFree && !IsSquare, Range -> [-400, 400]),
    _h -> [
      Labeled(Associates, "associates"),
      Labeled(IrreducibleFactors, "irreducible factors"),
      Labeled(Multiples, "multiples"),
      Labeled(None, "nothing")],
    _s -> []]'
>
<notatio-show
  height="560"
  value='Show(
    LatticeTiles(QuadraticIntegers(_d),
      ColorRules -> [
        IsPrime -> ColorData(["Dusk", [0, 10], "Reflected"])(Sqrt(Abs(Norm))),
        IsIrreducible && !IsPrime -> Teal,
        IsUnit -> White,
        _h(Selected) -> Opacity(0.35, White)],
      ColorMixing -> "Screen",
      BoundaryStyle -> [
        IsZero -> White,
        Unknown -> Gray,
        Selected -> Directive(White, AbsoluteThickness(2.5))]),
    GridLines -> [10, 10],
    Axes -> True,
    Selection -> _s)'
></notatio-show>
<notatio-string-template>Primes of $\mathbb{Q}(\sqrt{_d})$, d = {_d}, by norm; selecting an element lights its {_h}. Shift-click to select several; Esc clears.</notatio-string-template>
</notatio-labeled>
</div>

Numbers written in a complex base, on these same lattices, have their own exploration:
[complex bases](/explore/complex-bases/).
