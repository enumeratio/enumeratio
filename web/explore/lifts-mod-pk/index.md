# Lifts mod pᵏ

$\mathbb{Z}/p^k$'s multiplication table, its elements listed by their base-$p$ digits, the
lowest first: by residue mod $p$, then mod $p^2$, and so on. The table nests: $p \times p$
blocks, each a copy of $\mathbb{Z}/p^{k-1}$'s table, whose cells are the $p^2$ products of the
lifts of one pair of residues. Reducing mod $p^{k-1}$ collapses each block back to one cell.

Colored by $p$-adic valuation, the zero divisors gather in the blocks of multiples of $p$, then
of $p^2$, a self-similar pattern. Select a cell to light its value's lifts: the $p$ values
congruent to it mod $p^{k-1}$, or all those congruent to it mod $p$. On the diagonal, light the
square roots: for odd $p$, each square root of a unit mod $p$ lifts to exactly one mod $p^k$
(Hensel's lemma), so a unit square has two roots at every level.

<Labeled Variables='[
    _n -> Variable(Integers, 27, Where -> IsPrimePower, Range -> [2, 729]),
    _h -> [
      Labeled(Lifts, "lifts from one level down"),
      Labeled(SameResidue, "lifts of its residue mod p"),
      Labeled(SquareRoots, "square roots"),
      Labeled(SameValue, "cells of the same value")],
    _s -> []]'>
<Show GridLines="Automatic" Selection="_s" ImageSize="[Automatic, 600]">
<ArrayPlot
      ColorRules='[
        IsOne -> White,
        True -> ColorData(["Dusk", [0, 6]])(Valuation),
        _h(Selected) -> Opacity(0.4, White)]'
      ColorMixing='"Screen"'
      BoundaryStyle="[Selected -> Directive(White, AbsoluteThickness(2))]"
    >
<MultiplicationTable ElementOrder="Adic">
<QuotientRing>Integers _n</QuotientRing>
</MultiplicationTable>
</ArrayPlot>
</Show>
<StringTemplate>Multiplication in $\mathbb{Z}/_n$, n = {_n}, listed by p-adic digits, each product colored by its p-adic valuation, 1 white. Selecting a cell lights its {_h}; shift-click to select several.</StringTemplate>
<Bottom/>
</Labeled>

The additive side, and the other ways of listing, are in [Addition mod n](/explore/addition-mod-n/).
