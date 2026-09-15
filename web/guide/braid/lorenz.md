# The Lorenz Flow

In 1963 Edward Lorenz cut a weather model down to three equations:

$$
\dot x = \sigma(y - x), \qquad
\dot y = x(\rho - z) - y, \qquad
\dot z = xy - \beta z,
$$

with $\sigma = 10$, $\rho = 28$, $\beta = 8/3$. Trajectories never settle and never
repeat, winding around two lobes and swapping between them unpredictably — the first
strange attractor, and the origin of the phrase _butterfly effect_.

<Story
  title="A single trajectory, seen the way Lorenz drew it">
<template #description>
Drag to turn the attractor over — from the side it is a pair of wings, from above a pair
of spirals. <code>LorenzCurve(n)</code> integrates n steps and evaluates to the points.
</template>
<ClientOnly>
<notatio-curve-3d
  value="LorenzCurve(7000)"
  open
  azimuth="0"
  elevation="2"
  zoom="1.15"
  label="30 seconds of flow, in the x–z plane"
/>
</ClientOnly>
</Story>

Buried in that tangle are the trajectories that _do_ close up. Each one is a loop in
space — and a loop in space is a **knot**.

## The template turns a flow into a word

Birman and Williams collapsed the attractor onto a **branched surface**: two ribbons
joined along a branch line, each ribbon being one lobe. Squashing the flow onto it loses
nothing that matters topologically, and what remains is a doubling map, $x \mapsto 2x
\bmod 1$.

An orbit is then just the record of which ribbon it took each time round — a word in $L$
and $R$. Periodic orbits are periodic words, read up to rotation, because there is no
distinguished starting point on a loop.

That is the whole reduction: **a knot becomes a cyclic word**, and the braid comes out of
the word by the recipe on [the previous page](/guide/braid/) — order the rotations
lexicographically, see where the flow sends each, take the positive permutation braid of
that permutation.

<Story
  title="A closed orbit, as a knot">
<template #description>
The shortest word whose orbit is knotted: its closure is the trefoil.
</template>
<notatio-cell value='LorenzBraid("LLRLR")' />
<notatio-cell value='AlexanderPolynomial("LLRLR")' />
<notatio-cell value='SeifertGenus("LLRLR")' />
</Story>

Not every knot turns up this way. Among the 250 prime knots with ten crossings or fewer,
only eight are Lorenz knots — and the figure-eight, the second-simplest knot there is, is
not one of them. Lorenz knots are all **positive braid closures**, which is a strong
condition: it forces the genus, and it rules the figure-eight out immediately, since that
knot is amphichiral and a positive braid closure never is.

## The same knots, from lattices

Now the surprise. Take the space of lattices in the plane with unit-area fundamental
domain. Each lattice $L$ has two classical invariants,

$$ g_2(L) = 60!!\sum_{\omega \in L \setminus 0}!! \omega^{-4}, \qquad
g_3(L) = 140\!\!\sum_{\omega \in L \setminus 0}\!\! \omega^{-6},$$

and the discriminant $\Delta = g_2^3 - 27 g_3^2$ vanishes exactly where the lattice
degenerates. The set where it vanishes, inside the three-sphere of normalised lattices,
is a **trefoil** — so the space of genuine lattices is a trefoil complement, which is to
say the unit tangent bundle of [the modular surface](/guide/modular/).

Let the flow be $\varphi_t(L) = e^t L$, stretching one direction and squeezing the other.
Its closed orbits correspond to conjugacy classes of hyperbolic matrices in
$\mathrm{PSL}(2,\mathbb{Z})$ — which, as the modular page shows, are exactly cyclic words
in two letters.

**Ghys's theorem.** Those modular knots are the Lorenz knots. Every periodic orbit of the
lattice flow can be deformed to a periodic orbit of the Lorenz equations, and the word in
$L$ and $R$ is the same word either way.

<Story
  title="One word, both readings">
<template #description>
LLRLR is L²R¹L¹R¹, so its run lengths are 2, 1, 1, 1 — and those are exactly the partial
quotients of a continued fraction. Here it is as a matrix in PSL(2,ℤ), and as the braid
whose closure is its knot.
</template>
<notatio-cell value="ModularFromSTWord([2, 1, 1, 1])" />
<notatio-cell value='LorenzBraid("LLRLR")' />
<notatio-cell value='TripNumber("LLRLR")' />
</Story>

## Linking with the trefoil counts the letters

The trefoil is still sitting there, as the discriminant locus. Every modular knot links
it some number of times, and that number has a name in a much older subject: the
**Rademacher invariant**, from the theory of the Dedekind eta function.

It is computed by pushing the knot through a Seifert surface for the trefoil and counting
signed punctures — and the answer is simply

$$\operatorname{lk}(k_A, \text{trefoil}) = \#R - \#L,$$

the letters of the word, counted with sign. One ribbon of the template links the trefoil
once positively, the other once negatively, so the linking number can only be the
difference. A number theorist's invariant of a modular transformation, and a topologist's
count of how a curve winds — the same integer.

<Story
  title="Rademacher, as a letter count">
<template #description>
Dedekind sums are the arithmetic side of the same invariant; the modular page follows
them further.
</template>
<notatio-cell value="DedekindSum(1, 5)" />
<notatio-cell value="DedekindSum(2, 7)" />
</Story>

## Things worth knowing

- **Every torus knot is a Lorenz knot.** $(\sigma_1 \cdots \sigma_{p-1})^q$ is positive,
  and the template realises every positive braid of that shape — see
  [torus knots](/guide/braid/torus-knots).
- **Lorenz knots are fibred**, with genus fixed by the braid, because a positive braid
  closure always is.
- **Trip number is braid index.** The number of $LR$ corners in the cyclic word is the
  minimal number of strands, so trip number $1$ means the unknot however long the word.
- The doubling map is why the words are *all* words: any cyclic binary word occurs, so
  there are as many Lorenz knots as there are necklaces.

## What this connects to

[The modular group](/guide/modular/) supplies the words and the arithmetic;
[knots and braids](/guide/braid/) supplies the braid machinery. This page is the claim
that those are one subject, which is Ghys's theorem, and the trefoil is where all three
meet: the discriminant locus, the first torus knot, and the first Lorenz knot.
$$
