# The Two-Argument Zeta

The Riemann zeta $\zeta(s) = \sum_{n\ge 1} n^{-s}$ has a two-argument cousin, the
**Hurwitz zeta**,

$$\zeta(s, a) \;=\; \sum_{n=0}^{\infty} (n + a)^{-s},$$

convergent for $\operatorname{Re}(s) > 1$ and continued analytically everywhere else. It
recovers the ordinary case at $a = 1$ ($\zeta(s, 1) = \zeta(s)$) and shifts the sum
otherwise, so $\zeta(s, 2) = \zeta(s) - 1$, and in general
$\zeta(s, m) = \zeta(s) - \sum_{k=1}^{m-1} k^{-s}$ for a positive integer $m$.

[`@enumeratio/analytic`](https://github.com/enumeratio/notatio) adds `HurwitzZeta` (and a
two-argument [`Zeta`](/reference/symbol/Zeta)) to compute-engine by Euler–Maclaurin
summation, aligned with Wolfram. Because the head is declared on the playground engine,
you can evaluate it in any cell:

<Story title="ζ(s, a) at a few values">
<notatio-cell value="HurwitzZeta(2, 1)" />
<notatio-cell value="HurwitzZeta(2, 2)" />
<notatio-cell value="HurwitzZeta(0, a)" />
</Story>

The first two reduce to closed forms — $\pi^2/6$ and $\pi^2/6 - 1$. At nonpositive integer
$s$ the values are Bernoulli polynomials in $a$, so $\zeta(0, a) = \tfrac12 - a$ (and
$\zeta(-1, a) = -\tfrac{1}{12}(6a^2 - 6a + 1)$). Write the head as
`\operatorname{HurwitzZeta}` — the bare `\zeta(s, a)` LaTeX still parses as the
one-argument Riemann zeta.

## The surface

As a bivariate function it is a smooth sheet for $\operatorname{Re}(s) > 1$, $a > 0$,
climbing steeply as $a \to 0^+$ toward the pole at $a = 0$. Drag to rotate; the surface
is sampled by compiling the expression to a native function (no per-point symbolic
evaluation), so it stays responsive.

<Story title="ζ(s, a) over s ∈ [2,5], a ∈ (0,3]">
<notatio-plot3d value="HurwitzZeta(x, y)" x-domain="2,5" y-domain="0.35,3" label="ζ(s, a)" color-legend />
</Story>

Here $x$ is $s$ and $y$ is $a$. Push $a$ toward $0$ and the sheet lifts off — the $n = 0$
term $(a)^{-s}$ blows up. The generalized [`Zeta`](/reference/symbol/Zeta) drops exactly
that term, so `Zeta(s, 0)` is finite and equals $\zeta(s)$ — the one place the two
functions genuinely disagree.

### On the GPU

The same surface with `gpu` set evaluates its grid in a WebGPU compute shader instead of
on the CPU — `HurwitzZeta` compiles to the [`zetaWGSL`](/explore/zeta/phase-portrait)
kernel via compute-engine's WGSL target. It falls back to the CPU path automatically where
WebGPU is unavailable, so the two look identical; the difference is a denser grid stays
interactive. (Look for the **GPU** badge under the figure.)

## The third argument, as a dial

A surface fixes one slice; a Manipulate hands you the rest. `LerchPhi(z, s, a)` has three
arguments, and a surface can only show two — so sweep the one it cannot, and the sheet
deforms as $z$ walks across its disk. The same works for the order of the polylogarithm,
which is the exponent every term is raised to.

<ClientOnly>
<notatio-manipulate params="{ {z, 0}, -0.95, 0.95, 0.01}" fps>
  <notatio-plot3d
    value="LerchPhi(_z, x, y)"
    x-domain="2,5"
    y-domain="0.35,3"
    gpu="120"
    label="Φ(z, s, a)"
    color-legend
  />
</notatio-manipulate>
</ClientOnly>

At $z = 0$ only the $n = 0$ term survives and the sheet is just $a^{-s}$; push $z$ toward
$1$ and the higher terms pile on until it becomes the Hurwitz zeta itself. Push it the
other way and the alternating series pulls the sheet down instead.

Turn the same surface ninety degrees — plot it over $z$ and $a$, and put the _order_ $s$
on the dial:

<ClientOnly>
<notatio-manipulate params="{ {s, 2}, 0.5, 6, 0.05}" fps>
  <notatio-plot3d
    value="LerchPhi(x, _s, y)"
    x-domain="-0.9,0.9"
    y-domain="0.5,3"
    gpu="120"
    label="Φ(z, s, a)"
    color-legend
  />
</notatio-manipulate>
</ClientOnly>

Raising $s$ flattens it: every term carries $(n+a)^{-s}$, so a larger exponent crushes the
tail and leaves the $n = 0$ term standing alone.

<Story title="ζ(s, a) evaluated on the GPU (denser grid)">
<notatio-plot3d value="HurwitzZeta(x, y)" x-domain="2,5" y-domain="0.35,3" gpu="120" label="ζ(s, a)" color-legend />
</Story>

## The parent: LerchPhi

Both of these sit inside the **Lerch transcendent**

$$\Phi(z, s, a) \;=\; \sum_{n=0}^{\infty} \frac{z^n}{(n+a)^s},$$

which is $\zeta(s, a)$ at $z = 1$ and the polylogarithm $\operatorname{Li}_s(z) = z\,\Phi(z, s, 1)$
along $a = 1$. `@enumeratio/analytic` provides [`LerchPhi`](/reference/symbol/LerchPhi); the $z^n$
factor gives geometric convergence for $|z| < 1$, so the series is summed directly.

<Story title="LerchPhi reductions">
<notatio-cell value="LerchPhi(1, 2, 1)" />
<notatio-cell value="LerchPhi(z, 0, a)" />
</Story>

The first is $\Phi(1, 2, 1) = \zeta(2) = \pi^2/6$; the second is $\Phi(z, 0, a) = 1/(1-z)$.

Its surface `Φ(z, 2, a)` — sweeping $z$ (as $x$) and $a$ (as $y$) — is a heavier per-point cost
than zeta (a full series each), which makes it a good stress test for the GPU: a 256×256 grid
takes **~4 ms on the GPU versus ~270 ms on the CPU** here (~65×), because every pixel runs its
own series in parallel.

<Story title="Φ(z, 2, a) on the GPU">
<notatio-plot3d value="LerchPhi(x, 2, y)" x-domain="-0.9,0.9" y-domain="0.5,3" gpu="120" label="Φ(z, 2, a)" color-legend />
</Story>

## Where it gets beautiful

Fix $s$ instead and let $a$ range over the whole **complex** plane, and $\zeta(s, a)$
becomes a phase portrait full of pinwheels, zeros, and poles.

→ [**ζ on the GPU: a phase portrait**](/explore/zeta/phase-portrait) — the whole
Euler–Maclaurin kernel running per pixel, in real time.
