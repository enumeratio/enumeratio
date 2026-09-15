# Explore

Things to turn over in your hands. Each page takes one function — or one family of
functions — and wires its every constant to a dial, so the question is not "what does
this do" but "what happens when I move this".

The [guides](/guide/) explain; these pages let you poke. Where a claim here is better
made in prose, it links back.

- [**The two-argument zeta**](/explore/zeta/) — the Hurwitz zeta $\zeta(s, a)$ and its
  generalized cousin, by Euler–Maclaurin: a surface, the closed forms, and where the two
  conventions part ways.
  - [ζ on the GPU: a phase portrait](/explore/zeta/phase-portrait) — the whole kernel
    compiled to a WebGPU shader, colouring the complex $a$-plane in real time.
- [**The Lerch transcendent**](/explore/lerchphi/) — $\Phi(z, s, a)$, the one function above
  the zeta/polylog/eta family, with a GPU domain-colouring of its disk of convergence.
- [**The polylog and the polygamma**](/explore/polylog/) — $\operatorname{Li}_s(z)$ and
  $\psi^{(m)}(z)$, both of them the Lerch series or the Hurwitz kernel in disguise, and two
  GPU portraits that look nothing alike.
- [**Fractals**](/explore/fractals/) — the Mandelbrot and Julia sets of $z \mapsto z^2 + c$,
  coloured by the $n$-th iterate itself rather than an escape count, with $n$ and $c$ on
  dials.

## How these are built

Every dial on these pages is a `<notatio-manipulate>` wrapped around a plotting
component, with the swept constants written as named wildcards (`_s`, `_a`) in the
expression itself. Nothing here is bespoke: the same components are documented in the
[component reference](/reference/components/) and exercised one at a time in the
[playground](/playground/). If a page here suggests a rig you want, you can build it.
