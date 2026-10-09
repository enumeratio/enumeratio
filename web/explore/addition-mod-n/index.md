# Addition mod n

The addition table of $\mathbb{Z}/n$, one cell per sum: row $i$, column $j$, holding
$i + j \bmod n$. Listed in order it is a circulant, each row the one above shifted by one place.
Colored by each sum's additive order, it shows $\mathbb{Z}/n$'s subgroups, one for each divisor
of $n$. Listed by Chinese remainders, $\mathbb{Z}/mn$'s table is $\mathbb{Z}/m$'s with a copy of
$\mathbb{Z}/n$'s in each cell. Listed by $p$-adic digits, $\mathbb{Z}/p^k$'s nests: $p \times p$
blocks of $\mathbb{Z}/p^{k-1}$'s, down to single cells.

<Labeled Variables='[
    _n -> Variable(Integers, 12, Range -> [2, 400]),
    _o -> [
      Labeled(Natural, "in order"),
      Labeled(ChineseRemainder, "by their Chinese remainders"),
      Labeled(Adic, "by their digits base p, lowest first")],
    _h -> [
      Labeled(SameValue, "cells of the same value"),
      Labeled(Multiples, "the subgroup it generates"),
      Labeled(Associates, "the other generators of that subgroup")],
    _s -> []]'>
<Show GridLines="Automatic" Selection="_s" ImageSize="[Automatic, 600]">
<ArrayPlot
      ColorRules='[
        IsZero -> White,
        True -> ColorData(["Dusk", [0, 6]])(Log(Order)),
        _h(Selected) -> Opacity(0.4, White)]'
      ColorMixing='"Screen"'
      BoundaryStyle="[Selected -> Directive(White, AbsoluteThickness(2))]"
    >
<AdditionTable ElementOrder="_o">
<QuotientRing>Integers _n</QuotientRing>
</AdditionTable>
</ArrayPlot>
</Show>
<StringTemplate>Addition in $\mathbb{Z}/_n$, n = {_n}, its elements listed {_o}, each sum colored by the log of its additive order, 0 white. Selecting a cell lights {_h}; shift-click to select several.</StringTemplate>
<Bottom/>
</Labeled>

The same ring's products are in [Multiplication mod n](/explore/multiplication-mod-n/), and the
lifts from $\mathbb{Z}/p^{k-1}$ to $\mathbb{Z}/p^k$ in [Lifts mod pᵏ](/explore/lifts-mod-pk/).
