---
order: 1
---

# Quadratic Integers

The Gaussian integers $a + bi$ are one ring in an infinite family. Pick any integer $d$ that
is not a square. The field $\mathbb{Q}(\sqrt d)$ has a ring of integers $\mathcal{O}_d$: the
numbers $x + y\omega$ with $x, y \in \mathbb{Z}$, where

$$
\omega = \begin{cases} \dfrac{-1 + \sqrt d}{2} & d \equiv 1 \pmod 4, \\[1ex] \sqrt d & \text{otherwise.} \end{cases}
$$

For $d = -1$ this is $\mathbb{Z}[i]$. For $d = -3$ it is the Eisenstein integers, whose
$\omega = e^{2\pi i/3}$ is a cube root of unity. A $d$ with square factors names the same field as its
squarefree part, so $\mathbb{Q}(\sqrt 8) = \mathbb{Q}(\sqrt 2)$.

Each element is a point of a lattice, and the lattice is where the arithmetic is easiest to
see. Every plot on this page is a `Show` of one `LatticeTiles` layer, its tiles colored by
`ColorRules`. Drag to pan; click the plot, then scroll to zoom (or ⌘/Ctrl-scroll); hover a tile to
read its factorization.

## The norm

Multiplying by the conjugate gives the **norm**:

$$
N(x + y\omega) = (x + y\omega)(x + y\bar\omega) = x^2 + sxy - ry^2, \qquad \omega^2 = s\omega + r.
$$

The norm is a rational integer, and it is multiplicative: $N(\alpha\beta) = N(\alpha)N(\beta)$.
A factorization of $\alpha$ therefore gives a factorization of $N(\alpha)$. So an element
whose norm is a rational prime cannot factor. The units are the elements of norm $\pm 1$.

<Story title="Gaussian primes, colored by norm">
<Show GridLines="[10, 10]" Axes ImageSize="[Automatic, 440]">
  <LatticeTiles
    ColorRules='[IsPrime -> ColorData(["Dusk", [0, 10], "Reflected"])(Sqrt(Abs(Norm))), IsUnit -> White]'
    BoundaryStyle="[IsZero -> White]"
  >GaussianIntegers</LatticeTiles>
</Show>
</Story>

A prime's color comes from its norm, through a band. The gradient runs from its first color at
$\sqrt{|N|} = 0$ to its last at $\sqrt{|N|} = 10$, back to its first at $20$, and so on. The band
is the grid step, so the colors turn at the grid's own spacing; the legend says where. A band is
a choice of presentation, not of mathematics: pick another scheme from the legend's bar, or have
it wrap or stop (↺) instead of reflecting back. For $\mathbb{Z}[i]$, $\sqrt{|N|}$ is the
distance from 0, so the bands are rings. True scale (`AspectRatio -> Automatic`) makes no
difference here, because $\mathbb{Z}[i]$ is already square.

## Square and hexagonal

When $d \equiv 1 \pmod 4$, $\omega$ sits halfway along. The lattice is then centered, and
each element owns a hexagon. The Eisenstein integers tile the plane with regular hexagons,
and their primes have six-fold symmetry because there are six units.

<Story title="Eisenstein primes">
<Show GridLines="[10, 10]" Axes ImageSize="[Automatic, 440]">
  <LatticeTiles
    ColorRules='[IsPrime -> ColorData(["Viridis", [0, 10], "Reflected"])(Sqrt(Abs(Norm))), IsUnit -> White]'
    BoundaryStyle="[IsZero -> White]"
  >EisensteinIntegers</LatticeTiles>
</Show>
</Story>

By default the plot measures the non-real axis in units of $\omega$'s own height. Every ring
then gets square or regular-hexagonal tiles, and fields can be compared side by side.
True scale, `AspectRatio -> Automatic`, draws $x + y\sqrt d$ at $(x, y\sqrt{|d|})$ instead. For $d < 0$ that is the
complex plane itself, so the lattice lines up with a complex plot of the same view.

## When factorization is not unique

In $\mathbb{Z}[\sqrt{-5}]$,

$$
6 = 2 \cdot 3 = (1 + \sqrt{-5})(1 - \sqrt{-5}),
$$

and none of the four factors splits any further. They are **irreducible**, but none of
them is **prime**: $2$ divides the product $(1 + \sqrt{-5})(1 - \sqrt{-5})$ without
dividing either factor.

Ideals repair this. The ideal $(\alpha)$ always factors uniquely into prime ideals; here

$$
(6) = \mathfrak{p}_2^2\, \mathfrak{p}_3\, \mathfrak{p}_3', \qquad
\mathfrak{p}_2 = (2, 1 + \sqrt{-5}),\ \mathfrak{p}_3 = (3, 1 + \sqrt{-5}),\ \mathfrak{p}_3' = (3, -1 + \sqrt{-5}).
$$

None of these is principal. The elements $2$, $3$ and $1 \pm \sqrt{-5}$ are four different
ways of grouping them into principal products.

The plot paints irreducibles that are not prime teal, a color that sits apart from every color
of the gradient, so an irreducible never reads as a prime of some norm. $6$ is selected, and every
irreducible divisor of the selection lights up, from both factorizations at once; hover it to
read both factorizations and its ideals. Shift-click to select more.

<Story title="ℤ[√−5]: primes by norm, and irreducibles that are not prime">
<Show Variables="[_s -> Variable(Automatic, [(6, 0)])]" Selection="_s" GridLines="[10, 10]" Axes ImageSize="[Automatic, 440]">
  <LatticeTiles
    ColorRules='[
      IsPrime -> ColorData(["Dusk", [0, 10], "Reflected"])(Sqrt(Abs(Norm))),
      IsIrreducible && !IsPrime -> Teal,
      IsUnit -> White,
      IrreducibleFactors(Selected) -> Opacity(0.4, White)]'
    ColorMixing='"Screen"'
    BoundaryStyle="[IsZero -> White, Selected -> Directive(White, AbsoluteThickness(2.5))]"
  >
    <QuadraticIntegers>-5</QuadraticIntegers>
  </LatticeTiles>
</Show>
</Story>

How badly unique factorization fails is measured by the **class group**, the ideals modulo
the principal ones. Its order $h$ is the class number. An element is irreducible exactly
when no proper sub-product of its prime ideals is principal. That is how the plot decides,
with ideal classes computed as reduced binary quadratic forms. When $h = 1$ (for $d < 0$,
only $d = -1, -2, -3, -7, -11, -19, -43, -67, -163$), irreducible and prime coincide and that
color disappears.

## Real fields

For $d > 0$ the norm $x^2 - dy^2$ takes both signs, and the units form an infinite group
$\pm\varepsilon^k$ around a fundamental unit $\varepsilon$, from the continued fraction of
$\omega$. A prime's associates run off along the hyperbolas $N = \pm p$, so the primes
arrange themselves along those curves.

<Story title="ℚ(√229): a real field with class number 3">
<Show GridLines="[10, 10]" Axes ImageSize="[Automatic, 440]">
  <LatticeTiles
    ColorRules="[Splits -> Teal, Inert -> Gold, Ramified -> Red, IsIrreducible && !IsPrime -> Purple, IsUnit -> White]"
    BoundaryStyle="[IsZero -> White]"
  >
    <QuadraticIntegers>229</QuadraticIntegers>
  </LatticeTiles>
</Show>
</Story>

Each prime is colored by how the rational prime $p$ below it splits: teal when it splits,
gold when it stays inert, red when it ramifies. A prime $p$ either splits into two conjugate ideals (norm $\pm p$), stays inert (the prime is
$p$ itself, norm $p^2$) or ramifies (it divides the discriminant). The Kronecker symbol
$\left(\frac{D}{p}\right)$ decides which.

## The logarithmic embedding

A real field has two real embeddings, $\sigma_1$ and $\sigma_2$, sending $\sqrt d$ to
$\pm\sqrt d$. Plot each element at $(\log|\sigma_1(\alpha)|, \log|\sigma_2(\alpha)|)$ and the
multiplicative structure turns additive. The norm is $\sigma_1\sigma_2$, so the elements of norm
$\pm n$ lie on the line $x + y = \log n$, and the units lie on the antidiagonal. Multiplying by
the fundamental unit $\varepsilon$ is a translation along it, by $(\log\varepsilon, -\log\varepsilon)$:
every norm line repeats with period the **regulator** $\log\varepsilon$.

<Story title="ℚ(√5), logarithmically">
<Show GridLines="[1, 1]" Axes ImageSize="[Automatic, 440]">
  <LatticeTiles
    Embedding="Logarithmic"
    ColorRules='[IsUnit -> White, IsPrime -> ColorData(["Dusk", [0, 4], "Reflected"])(Log(Abs(Norm))), IsZero -> White]'
  >
    <QuadraticIntegers>5</QuadraticIntegers>
  </LatticeTiles>
</Show>
</Story>

The units march down the antidiagonal at steps of $\log\varphi \approx 0.48$, $\varphi$ the
golden ratio. Each prime's associates do the same on its own line. Only the elements of norm up
to 200 are drawn, from a finite box of the lattice, so the lines thin out toward their ends.

## Orders

$\mathcal{O}_d$ is the largest of the rings in $\mathbb{Q}(\sqrt d)$. The others are its
**orders** $\mathbb{Z} + f\mathcal{O}_d$, named by their discriminant $f^2 D_K$:
`QuadraticOrder(-12)` is $\mathbb{Z}[\sqrt{-3}]$, of conductor 2 in the Eisenstein integers.
It has the square lattice of $\sqrt{-3}$, and loses unique factorization at 2: the purple
tiles are irreducible but not prime.

<Story title="ℤ[√−3], the order of conductor 2">
<Show GridLines="[10, 10]" Axes ImageSize="[Automatic, 440]">
  <LatticeTiles
    ColorRules="[IsIrreducible && !IsPrime -> Purple, Splits -> Teal, Inert -> Gold, Ramified -> Red, IsUnit -> White]"
    BoundaryStyle="[IsZero -> White]"
  >
    <QuadraticOrder>-12</QuadraticOrder>
  </LatticeTiles>
</Show>
</Story>

Higher degrees, and orders in general, are in
[Orders and Algebraic Integers](algebraic-integers.md).

## Sweeping fields

The [quadratic primes explorer](https://enumeratio.dev/explore/quadratic-primes/) has the
same component, with a stepper and a random button to move through fields; any figure here goes
full-window from its corner button.

The same lattices carry numbers written in a complex base: base $-1 + i$ with digits $0$ and
$1$ writes every Gaussian integer and tiles a fractal. That is the
[Complex bases](../../complex-numerals/docs/complex-bases.md) guide.
