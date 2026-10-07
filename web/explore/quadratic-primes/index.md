# Quadratic Primes

The primes of every ring of quadratic integers $\mathcal{O}_d$, one field at a time, or of its
order $\mathbb{Z}[\sqrt d]$; a real field's can be drawn at their logarithmic embedding. The
[guide](/docs/number-theory/quadratic-integers) explains what the colors mean.

<Labeled Variables='[
    _d -> Variable(Integers, -5, Where -> !IsSquare, Range -> [-400, 400]),
    _R -> [Labeled(AlgebraicIntegers, "its ring of integers"), Labeled(AlgebraicOrder, "ℤ[√d]")],
    _e -> [Labeled(Lattice, "on the lattice"), Labeled(Logarithmic, "logarithmically")],
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
      Embedding="_e"

      ColorRules='[
        IsPrime -> ColorData(["Dusk", [0, 10], "Reflected"])(Sqrt(Abs(Norm))),
        IsIrreducible && !IsPrime -> Teal,
        IsUnit -> White,
        _h(Selected) -> Opacity(0.35, White)]'
      ColorMixing='"Screen"'
      BoundaryStyle='[IsZero -> White, Unknown -> Gray, Selected -> Directive(White, AbsoluteThickness(2.5))]'
    >
      <ToExpression value="_R(Sqrt(_d))" />
    </LatticeTiles>

  </Show>
  <StringTemplate>The primes of {_R} in $\mathbb{Q}(\sqrt{_d})$, d = {_d}, by norm, drawn {_e}; selecting an element lights its {_h}. Shift-click to select several; Esc clears.</StringTemplate>
  <Bottom/>
</Labeled>

Numbers written in a complex base, on these same lattices, have their own exploration:
[complex bases](/explore/complex-bases/).
