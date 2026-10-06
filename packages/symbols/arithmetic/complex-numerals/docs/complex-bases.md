---
order: 1
---

# Complex Bases

In base ten, the number $372$ is $3 \cdot 10^2 + 7 \cdot 10 + 2$: a sum of digits times powers of
the base. Nothing in that recipe needs the base to be real. Take a Gaussian integer for the base,
say $\beta = -1 + i$, and a set of digits, here $\{0, 1\}$. A numeral $d_{L-1} \dots d_1 d_0$ then
stands for

$$
\sum_{k=0}^{L-1} d_k \beta^k,
$$

and every one of them is a point in the plane. The plot below draws all $2^{12}$ numerals of at
most twelve places. Each tile is one numeral, colored by its digit in the twelfth place, which
splits the dragon into the two halves it is made of.

<Story title="Base −1 + i, digits 0 and 1">
<ClientOnly>
<notatio-lattice-plot id="bases" layer="radix" example="twindragon" height="520" />
</ClientOnly>
</Story>

Try the other notable systems, in the caption's menu or right here:
<a href="#bases" data-lattice-target="bases" data-lattice-control="example" data-lattice-value="twindragon">the twindragon</a>,
<a href="#bases" data-lattice-target="bases" data-lattice-control="example" data-lattice-value="quater-imaginary">Knuth's quater-imaginary base</a>,
<a href="#bases" data-lattice-target="bases" data-lattice-control="example" data-lattice-value="katai-szabo">base −2 + i</a>,
<a href="#bases" data-lattice-target="bases" data-lattice-control="example" data-lattice-value="gosper-island">the Gosper island</a>,
<a href="#bases" data-lattice-target="bases" data-lattice-control="example" data-lattice-value="eisenstein-three">base −1 + ω</a> and
<a href="#bases" data-lattice-target="bases" data-lattice-control="example" data-lattice-value="square">a plain square</a>.

## One digit per residue class

Two numerals can name the same point. Base $2i$ with digits $0$ to $3$ (Knuth's
_quater-imaginary_ system) has $2 = -i \cdot 2i$, so $2$ and $0$ leave the same remainder mod
$2i$. Its whole numerals only reach points with an even imaginary part, and Knuth writes the
rest with a radix point.

The cure is to choose the digits as a **complete residue system** mod $\beta$: one digit from
each class, with $0$ among them. There are then exactly $|N(\beta)|$ digits ($N(a + bi) = a^2 +
b^2$), and no two numerals can collide. To see why, suppose two of them name the same point, and
look at the lowest place $k$ where they differ. Their difference is a multiple of $\beta^k$. Divide
it out: what remains is $d_k - d'_k$ plus a multiple of $\beta$. That sum is $0$, so
$d_k \equiv d'_k \pmod \beta$, and two different digits from different classes can't be
congruent.

Every notable system here except the quater-imaginary one has a complete residue system. The
tests check that its numerals are all different points.

Distinct is not the same as _every_ point. Base $-1 + i$ with digits $\{0, 1\}$ reaches every
Gaussian integer, which Penney and Knuth showed. Kátai and Szabó found that $-n + i$ with digits
$0, 1, \dots, n^2$ does too. Many complete residue systems don't. Some lattice points then have no
numeral at all, and the tiles leave gaps however many places you allow.

## Tiles that are fractals

Adding a place multiplies everything by $\beta$ and adds a digit:

$$
T_{L+1} = \bigcup_{d \in D} \left(d + \beta\, T_L\right).
$$

Scaled back by $\beta^{L}$, the sets $T_L$ settle onto a single tile $T$ that is $|N(\beta)|$
copies of itself, each shrunk by $1/|\beta|$ and turned by $-\arg \beta$. For base $-1 + i$ that
is two copies, turned by $135°$: the twindragon, two Heighway dragons back to back. For the Gosper
island, base $3 + \omega$ with $0$ and the six units as digits, it is seven copies, turned by
$\arctan(\sqrt 3 / 5) \approx 19.1°$.

## Coloring by digits

Each coloring reads one thing off a numeral's digits, and gives each digit its own color from the
discrete scheme:

- **leading digit** colors a numeral by its most significant digit.
- **the k-th digit** colors by the digit in place $k$; the 1st digit is the units digit. The 1st
  digit is the residue class mod $\beta$, so it splits the plane into $|N(\beta)|$ interleaved
  sublattices. The highest place splits it into $|N(\beta)|$ copies of the tile.
- **all digits** mixes the digits' colors, the leading digit weighing most: a numeral's color is
  $0.8$ of its leading digit's color plus $0.2$ of the color of the rest. Numerals that agree on
  their leading places look alike, so the self-similar copies show at every scale.

## Off the lattice

Untick **on the lattice** and the base and digits can sit anywhere in the plane. The numerals
are no longer lattice points, residue classes no longer make sense, and nothing keeps two
numerals apart. The tiles drift, overlap, or spread into clouds. Drag the handles slowly from a
lattice system to watch a tile come apart.

## Settings and favorites

The **settings** box holds the current system as a sentence, such as
`base -1+i with digits 0, and 1 color by 1st`. Copy it to keep a system, or paste one to load it.
The sentences follow [TheGrayCuber's imaginary-bases page](https://thegraycuber.com/imaginary_bases/),
which inspired this one. The caption's menu also lists the favorites viewers sent there, each
credited as submitted. (On that page, here, and in the
[quadratic integers](https://enumeratio.dev/docs/number-theory/quadratic-integers) guide,
$\omega = e^{2\pi i/3}$, so $\omega^2 = -1 - \omega$.)

The full explorer, with every control, is on the
[complex bases](https://enumeratio.dev/explore/complex-bases/) exploration.
