# Complex numerals

Numbers written in a complex base. Choose a base $\beta$ among the Gaussian integers
$\mathbb{Z}[i]$ or the Eisenstein integers $\mathbb{Z}[\omega]$ ($\omega = e^{2\pi i/3}$), and a
set of digits. Every sum $\sum_k d_k \beta^k$ with at most $L$ places is then a point of the
lattice. When the digits hold one number from each residue class mod $\beta$, those points are
all different, and together they tile a fractal: base $-1 + i$ with digits $0$ and $1$ draws the
twindragon.

A page draws these systems as a `Show` layer, `LatticeTiles(RadixExpansions(ring, base, digits,
places))`. Its `./lattice` entry is plain TypeScript with no engine. It holds the arithmetic, the
layer, a handful of notable systems with their sources, and the favorites viewers sent to
[TheGrayCuber's imaginary-bases page](https://thegraycuber.com/imaginary_bases/). No heads are
declared yet.

- [Complex bases](docs/complex-bases.md): the guide.
