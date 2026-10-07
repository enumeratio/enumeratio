# Quadratic Primes

The primes of every ring of quadratic integers $\mathcal{O}_d$, one field at a time. The
[guide](/docs/number-theory/quadratic-integers) explains what the colors mean.

<Labeled Variables='[
    _d -> Variable(Integers, -5, Where -> IsSquareFree && !IsSquare, Range -> [-400, 400]),
    _h -> [
      Labeled(Associates, "associates"),
      Labeled(IrreducibleFactors, "irreducible factors"),
      Labeled(Multiples, "multiples"),
      Labeled(None, "nothing")],
    _s -> []]'>
<Show
GridLines="[10, 10]"
Axes
Selection="_s"
ImageSize="[Automatic, 560]"

>

    <LatticeTiles

      ColorRules='[
        IsPrime -> ColorData(["Dusk", [0, 10], "Reflected"])(Sqrt(Abs(Norm))),
        IsIrreducible && !IsPrime -> Teal,
        IsUnit -> White,
        _h(Selected) -> Opacity(0.35, White)]'
      ColorMixing='"Screen"'
      BoundaryStyle='[IsZero -> White, Unknown -> Gray, Selected -> Directive(White, AbsoluteThickness(2.5))]'
    >
      <QuadraticIntegers>_d</QuadraticIntegers>
    </LatticeTiles>

  </Show>
  <StringTemplate>Primes of $\mathbb{Q}(\sqrt{_d})$, d = {_d}, by norm; selecting an element lights its {_h}. Shift-click to select several; Esc clears.</StringTemplate>
  <Bottom/>
</Labeled>

Numbers written in a complex base, on these same lattices, have their own exploration:
[complex bases](/explore/complex-bases/).
