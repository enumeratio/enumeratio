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
see. Every plot on this page is the same component, `<notatio-lattice-plot>`. Drag to pan,
scroll to zoom, and click a tile to read its factorization.

## The norm

Multiplying by the conjugate gives the **norm**:

$$
N(x + y\omega) = (x + y\omega)(x + y\bar\omega) = x^2 + sxy - ry^2, \qquad \omega^2 = s\omega + r.
$$

The norm is a rational integer, and it is multiplicative: $N(\alpha\beta) = N(\alpha)N(\beta)$.
A factorization of $\alpha$ therefore gives a factorization of $N(\alpha)$. So an element
whose norm is a rational prime cannot factor. The units are the elements of norm $\pm 1$.

<Story title="Gaussian primes, colored by norm">
<ClientOnly>
<notatio-lattice-plot ring="GaussianIntegers" palette="dusk" grid="10" height="440" />
</ClientOnly>
</Story>

A prime's color comes from its norm, through a band. The gradient runs from its first color at
$\sqrt{|N|} = 0$ to its last at $\sqrt{|N|} = 10$, back to its first at $20$, and so on. The band
is the grid step, so the colors turn at the grid's own spacing; the legend says where. A band is
a choice of presentation, not of mathematics: open the gradient control to change it, or have the
gradient wrap or stop instead of reflecting back. For $\mathbb{Z}[i]$, $\sqrt{|N|}$ is the
distance from 0, so the bands are rings. Toggling **true scale** makes no difference here,
because $\mathbb{Z}[i]$ is already square.

## Square and hexagonal

When $d \equiv 1 \pmod 4$, $\omega$ sits halfway along. The lattice is then centered, and
each element owns a hexagon. The Eisenstein integers tile the plane with regular hexagons,
and their primes have six-fold symmetry because there are six units.

<Story title="Eisenstein primes">
<ClientOnly>
<notatio-lattice-plot ring="EisensteinIntegers" palette="viridis" grid="10" height="440" />
</ClientOnly>
</Story>

By default the plot measures the non-real axis in units of $\omega$'s own height. Every ring
then gets square or regular-hexagonal tiles, and fields can be compared side by side.
**True scale** draws $x + y\sqrt d$ at $(x, y\sqrt{|d|})$ instead. For $d < 0$ that is the
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

The plot paints irreducibles that are not prime in a color of their own, taken from the
discrete scheme. The default scheme is generated to sit far from every color of the gradient,
so an irreducible never reads as a prime of some norm. Click $6$ to see both
factorizations and its ideals. With **highlight** set to _irreducible factors_, every
irreducible divisor of the selection lights up, from both factorizations at once.

<Story title="ℤ[√−5]: primes by norm, and irreducibles that are not prime">
<ClientOnly>
<notatio-lattice-plot ring="QuadraticIntegers(-5)" palette="dusk" grid="10" height="440" selected="6,0" />
</ClientOnly>
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
<ClientOnly>
<notatio-lattice-plot ring="229" palette="magma" grid="10" height="440" color-by="splitting" />
</ClientOnly>
</Story>

Colored **by how p splits**, each prime takes the color of the rational prime $p$ below it.
A prime $p$ either splits into two conjugate ideals (norm $\pm p$), stays inert (the prime is
$p$ itself, norm $p^2$) or ramifies (it divides the discriminant). The Kronecker symbol
$\left(\frac{D}{p}\right)$ decides which.

## Sweeping fields

The [quadratic primes explorer](https://enumeratio.dev/explore/quadratic-primes/) has the
same component, with a stepper and a random button to move through fields; any figure here goes
full-window from its corner button.

The same lattices carry numbers written in a complex base: base $-1 + i$ with digits $0$ and
$1$ writes every Gaussian integer and tiles a fractal. That is the
[Complex bases](../../complex-numerals/docs/complex-bases.md) guide.
