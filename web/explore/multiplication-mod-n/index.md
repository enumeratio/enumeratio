# Multiplication mod n

The multiplication table of $\mathbb{Z}/n$, one cell per product: row $i$, column $j$, holding
$ij \bmod n$. Colored by what the product is, its structure shows at a glance: the units make a
Latin square, the idempotents mark how $n$ splits by the Chinese remainder theorem, and the
square roots of each residue sit on the diagonal. A $1$ in the cell $(x, x - k)$ says
$x(x - k) = 1$: $x$ is a root of $x^2 - kx - 1$, a metallic mean of $\mathbb{Z}/n$.

<div>
<notatio-labeled
  position="below"
  variables='[
    _n -> Variable(Integers, 24, Range -> [2, 400]),
    _o -> [Labeled(Natural, "in order"), Labeled(ChineseRemainder, "by their Chinese remainders")],
    _h -> [
      Labeled(SameValue, "cells of the same value"),
      Labeled(SquareRoots, "square roots"),
      Labeled(Associates, "associates"),
      Labeled(Multiples, "multiples")],
    _s -> []]'
>
<notatio-show
  height="600"
  value='Show(
    ArrayPlot(MultiplicationTable(QuotientRing(Integers, _n), ElementOrder -> _o),
      ColorRules -> [
        IsOne -> White,
        IsUnit -> ColorData(["Dusk", [1, 12]])(Order),
        IsIdempotent && !IsZero -> Gold,
        IsNilpotent && !IsZero -> Red,
        IsZeroDivisor -> Opacity(0.25, Teal),
        _h(Selected) -> Opacity(0.4, White)],
      ColorMixing -> "Screen",
      BoundaryStyle -> [Selected -> Directive(White, AbsoluteThickness(2))]),
    GridLines -> Automatic,
    Selection -> _s)'
></notatio-show>
<notatio-string-template>Multiplication in $\mathbb{Z}/_n$, n = {_n}, its elements listed {_o}: units by their multiplicative order, the one white, idempotents gold, nilpotents red, other zero divisors faint. Selecting a cell lights its {_h}; shift-click to select several.</notatio-string-template>
</notatio-labeled>
</div>
