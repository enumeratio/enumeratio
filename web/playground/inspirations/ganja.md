# ganja.js

[ganja.js](https://github.com/enkimute/ganja.js) is Steven De Keninck's geometric
algebra generator: `Algebra(p, q, r)` hands back a JavaScript class implementing
that Clifford algebra, with operator overloading (it rewrites the source of the
function you pass it) and a `graph()` that **draws the elements**. A point in 2D
PGA is a bivector, so ganja draws a dot; a line is a vector, so it draws a line;
join and meet are `&` and `^`, so a construction is one expression.

This page is a **survey, not a component**. We are not adding ganja as a
dependency — its renderer is a small part of what it does well, and the part we
would want is the part we already have infrastructure for. The question worth
answering is narrower: _what do its examples show that our Clifford algebras
could show too, and what would it cost to draw them ourselves?_

## What we already have

`@enumeratio/hypercomplex` is not a geometric algebra library, but it is closer
to one than it looks. An algebra there is nothing but an ordered list of
generators, and a generator is fixed by two facts — what it squares to, and
whether it anticommutes. That is a 3 × 2 grid and all six cells are occupied:

| Family          | $g^2$ | anticommutes | spans                            |
| --------------- | ----- | ------------ | -------------------------------- |
| $i_k$           | $-1$  | no           | multicomplex $\mathbb{C}_n$      |
| $j_k$           | $+1$  | no           | multi-perplex                    |
| $\varepsilon_k$ | $0$   | no           | multi-dual                       |
| $e_k$           | $+1$  | **yes**      | $\mathrm{Cl}(n,0)$               |
| $f_k$           | $-1$  | **yes**      | $\mathrm{Cl}(0,n)$               |
| $\theta_k$      | $0$   | **yes**      | exterior $\Lambda(\mathbb{R}^n)$ |

ganja's `Algebra(p, q, r)` is the anticommuting row of that table and nothing
else: `p` generators squaring to $+1$, `q` to $-1$, and `r` **degenerate** ones
squaring to $0$. We had all three — $e_k$, $f_k$ and $\theta_k$ — but
`CliffordAlgebra` took only two arguments, so the degenerate generators were not
reachable by that name. They are now: `CliffordAlgebra(2, 0, 1)` is 2-D PGA, and
`CliffordAlgebra(3, 0, 1)` is the 3-D one.

<Story
  title="Every signature, including the degenerate ones">
<template #description>
Drag any of the three. <code>Cl(0,2,0)</code> is the quaternions,
<code>Cl(3,0,0)</code> the algebra of 3-D space, and <code>Cl(2,0,1)</code> — the
one shown — is 2-D projective geometric algebra, whose degenerate generator is the
<code>θ</code> family wearing a different hat.
</template>
<notatio-tangle>
<notatio-knob name="p" value="2" min="0" max="4" step="1" /> positive,
<notatio-knob name="q" value="0" min="0" max="4" step="1" /> negative and
<notatio-knob name="r" value="1" min="0" max="2" step="1" /> degenerate generators span
<notatio-dynamic value="Basis(CliffordAlgebra(_p, _q, _r))" />, of dimension
<notatio-dynamic value="AlgebraDimension(CliffordAlgebra(_p, _q, _r))" />.
</notatio-tangle>
</Story>

There is one difference that is ours to keep rather than close: ganja's elements
are `Float32Array`s, and ours carry **BoxedExpressions** — a coefficient may be a
rational, a π, or an undetermined symbol, and it stays that way through a
product. ganja is built for a frame budget; we are built for an answer you can
read. Any renderer we write has to evaluate numerically at the last possible
moment, not the first.

## The operator layer

ganja's operator table is the honest summary of what a geometric algebra _is_
beyond a Clifford algebra. Against ours, now that most of it is built:

| ganja        | means                       | here                                                                |
| ------------ | --------------------------- | ------------------------------------------------------------------- |
| `a*b`        | geometric product           | `GeometricProduct(a, b)`                                            |
| `a^b`        | wedge (outer)               | `Wedge(a, b, …)`                                                    |
| `a<<b`       | left contraction            | `LeftContraction(a, b)`                                             |
| `a&b`        | vee (join/meet)             | `Vee(a, b, algebra)`                                                |
| `!a`         | Poincaré dual               | `Dual(x, algebra)`                                                  |
| `~a`         | Clifford conjugate          | `CliffordConjugate(x)`                                              |
| `a.Reverse`  | reversion                   | `Reversion(x)`                                                      |
| `a.Involute` | grade involution            | `GradeInvolution(x)`                                                |
| `a>>>b`      | sandwich                    | `Sandwich(a, b)`                                                    |
| —            | grade projection            | `Grade(x)`, `GradePart(x, k)`                                       |
| —            | pseudoscalar                | `Pseudoscalar(algebra)`                                             |
| `a**-1`      | inverse                     | **still missing** — ganja does it matrix-free to 5D                 |
| `describe()` | basis, metric, Cayley table | `Basis`, `AlgebraDimension`; the table is a picture we could _draw_ |

Those live in `@enumeratio/geometric`, a thin layer over the hypercomplex
representation: every one of them is the geometric product with a **grade selected
out of it**, or a sign per grade, so none of it needs a second representation of a
multivector. The `Grade`/`GradePart` pair is the primitive and the rest are one
line each.

::: tip The LaTeX operators are taken
`\wedge` parses to `And` and `\vee` to `Or` — compute-engine gave those glyphs to
boolean logic long before we wanted them. So these are reached by name,
`Wedge(a, b)` rather than `a \wedge b`. Worth revisiting as a parse rule.
:::

Two things worth saying about it.

**The dual was the one that mattered.** ganja is careful that its `!` is
**Poincaré** duality — the complement of the blade's generators — rather than
multiplication by the pseudoscalar, precisely so it survives a degenerate metric.
That is the whole reason PGA works: in $\mathrm{Cl}(2,0,1)$ the pseudoscalar
squares to zero and has no inverse, so a dual defined through it does not exist at
all. `Dual` here is the complement, signed so that $b \wedge {!b} = I$, which is
the property that pins the sign down and the one the tests check.

The dual is also why three of these heads take an **algebra argument**. A
complement is only defined once you say what it is a complement _in_: $e_1$ in
$\mathrm{Cl}(2,0)$ dualises to $e_2$, and the same $e_1$ in $\mathrm{Cl}(3,0)$
dualises to $e_2e_3$. There is nothing in the expression to read that off, so
`Dual`, `Vee` and `Pseudoscalar` are told.

::: tip Where the anticommutation sign lives
Compute-engine canonicalises `Multiply` with its own code — it sorts the operands
before any handler of ours runs, and for an anticommuting family that sort takes
the transposition sign with it. `f_1f_2f_1f_2` used to come back `f_1f_1f_2f_2`,
the quaternion $k^2$ answered as $+1$ where it is $-1$.

Juxtaposition now gets caught one step earlier, at the `InvisibleOperator` node it
parses to, whose canonical handler does see the operands as written — so
`f_1f_2f_1f_2` is $-1$ and `e_2e_1` is $-e_1e_2$. An explicit `\times` between two
distinct anticommuting units still declines rather than guessing: it never passed
through that seam, so the sign is already gone and refusing is the honest answer.
:::

## The operators, live

<Story
  title="The wedge forgets the metric">
<template #description>
In order: the blade, the same blade with the sign the swap costs, zero, and — for
contrast — the geometric product of a generator with itself, which is where the
metric lives. <code>Wedge(e_1, e_1)</code> is zero whatever <code>e_1</code>
squares to; that is what makes the outer product the half that survives a
degenerate signature.
</template>
<notatio-tangle>
<notatio-dynamic value="Wedge(e_1, e_2)" /> &middot;
<notatio-dynamic value="Wedge(e_2, e_1)" /> &middot;
<notatio-dynamic value="Wedge(e_1, e_1)" /> &middot;
<notatio-dynamic value="GeometricProduct(e_1, e_1)" />
</notatio-tangle>
</Story>

<Story
  title="A blade and its complement">
<template #description>
Drag the dimension. The <em>same</em> element <code>e_1</code> has a different dual
in each algebra, which is why <code>Dual</code> is told which one to work in rather
than guessing from the generators it can see. The identity underneath is
<code>Wedge(b, Dual(b)) = Pseudoscalar</code>, and it is what fixes the sign.
</template>
<notatio-tangle>
In dimension <notatio-knob name="n" value="3" min="2" max="5" step="1" />, the
pseudoscalar is <notatio-dynamic value="Pseudoscalar(CliffordAlgebra(_n))" />,
the dual of <notatio-tex value="e_1" /> is
<notatio-dynamic value="Dual(e_1, CliffordAlgebra(_n))" />, and wedging the two
back together gives <notatio-dynamic value="Wedge(e_1, Dual(e_1, CliffordAlgebra(_n)))" />.
</notatio-tangle>
</Story>

<Story
  title="Duality in a degenerate metric">
<template #description>
The pseudoscalar of 2-D PGA, its square — <strong>zero</strong>, so it has no
inverse and the textbook <code>x I⁻¹</code> dual does not exist — and the
complement dual of the degenerate generator, which answers anyway.
</template>
<notatio-tangle>
<notatio-dynamic value="Pseudoscalar(CliffordAlgebra(2,0,1))" /> &middot;
<notatio-dynamic value="GeometricProduct(Pseudoscalar(CliffordAlgebra(2,0,1)), Pseudoscalar(CliffordAlgebra(2,0,1)))" /> &middot;
<notatio-dynamic value="Dual(theta_1, CliffordAlgebra(2,0,1))" />
</notatio-tangle>
</Story>

<Story
  title="Grades, and the involutions that are signs on them">
<template #description>
Scrub the grade. The element is a scalar plus a vector plus a bivector; each
involution is nothing but a sign that depends on which of those a term is.
</template>
<notatio-tangle>
Grade <notatio-knob name="k" value="1" min="0" max="3" step="1" /> of
<notatio-tex value="1 + 2e_1 + 3e_1e_2" /> is
<notatio-dynamic value="GradePart(1 + 2*e_1 + 3*e_1*e_2, _k)" />. Its reversion is
<notatio-dynamic value="Reversion(1 + 2*e_1 + 3*e_1*e_2)" />, its grade involution
<notatio-dynamic value="GradeInvolution(1 + 2*e_1 + 3*e_1*e_2)" />.
</notatio-tangle>
</Story>

## What is worth drawing

Sorting ganja's example gallery by what it would take us:

**Already ours.** The complex, dual and quaternion examples — the Mandelbrot
set, hue over the quaternions, automatic differentiation through dual numbers —
are plots of a function over a two-real-dimensional algebra. That is exactly what
`<notatio-complex-plot>` and the GPU phase portrait already do; what is missing
is only that they take `z` rather than an arbitrary algebra's element.
The 1-D and 2-D _function_ graphs ganja offers are `<notatio-plot>` and
`<notatio-densityplot>`.

**A near thing.** 2-D PGA in SVG — points, lines, join and meet, distances and
angles, projections, rotors and translators. Every one of those is a line, a dot
or a label, we already emit SVG for plots, and the projection code in
`project3d.ts` is more machinery than this needs. The blocking item is not the
renderer, it is the operator list above. This is the milestone to aim at.

**A real project.** 3-D PGA and conformal 3-D, which ganja does in WebGL. We
have GPU evaluation (`gpu-eval.ts`) and a 3-D pipeline (`polytope3d.ts`,
`project3d.ts`), so the pieces exist, but rounding up a scene of spheres, circles
and motors is a package's worth of work, not an afternoon's.

**Deferred.** ganja's WebGL2 **OPNS renderer**, which draws any element of any
algebra by raymarching the set where the outer product with a probe point
vanishes. It is the most interesting thing in the library — it needs no
per-algebra drawing code at all, which is why it works for algebras nobody has
named. It is also the hardest, and it should not be first.

## Should we lift the notation?

Partly.

**The literals, no.** ganja's `1e12` for a basis bivector is a clever abuse of
JavaScript's scientific notation — it exists because JavaScript has no way to
write an algebraic literal. We have `e_1e_2`, which is what the literature
writes, parsed by compute-engine with no dictionary entry at all. There is
nothing to gain.

**The operators, yes.** `Wedge` and `Vee` are real Wolfram symbols, so they name
themselves, as anything with a symbol to take does. The rest — `Dual`, `Reversion`, `GradeInvolution`, the contractions —
have no symbol to take and are named for what the literature calls them. Every one
of those names turned out to be free on a compute-engine that already has `Cross`,
`Dot` and `Conjugate`.

**Grade, yes.** Nothing in the operator table is usable without a way to say
"the grade-k part of this", and everything above is written in terms of it. It
went in first.

## What is left

The operator layer is built; the **renderer** is not, and it is the half of ganja
this page was really about. A point in 2-D PGA is a bivector, a line is a vector,
and the constructions — join, meet, project, reflect — are each one expression. All
that is missing is the part that turns those back into a dot and a line on a frame.

Two smaller things go with it: a general Clifford **inverse**, which ganja does
matrix-free up to five dimensions and we decline outright for anticommuting
elements, and a **Cayley table** view, which `describe()` prints as text and which
is a much better picture than it is a paragraph.

## Reading

Worth rewriting with our tools, roughly in order of how well they would survive
the translation:

- **Charles Gunn**, _Geometric Algebra for Computer Graphics_ (SIGGRAPH course)
  and _Geometric Algebras for Euclidean Geometry_ — the source of the PGA
  identity table ganja's 3-D starter kit implements. A table of one-line
  constructions is the ideal shape for an interactive page.
- **Dorst, Fontijne & Mann**, _Geometric Algebra for Computer Science_ — the
  standard applied treatment, and the one that is most explicit about which
  product to reach for.
- **bivector.net** — the community's cheat sheets for 2-D and 3-D PGA, and the
  forum where ganja itself is discussed.
- **Macdonald**, _Linear and Geometric Algebra_ — the gentlest entry, and the one
  whose exercises would become knobs most directly.
- **Winitzki**, _Linear Algebra via Exterior Products_ (free) — exterior algebra
  without the geometry, which is the `θ_k` family on its own and therefore the
  piece we can already compute with today.
- **Hestenes & Sobczyk**, _Clifford Algebra to Geometric Calculus_, and
  **Lounesto**, _Clifford Algebras and Spinors_ — the deep end, for when the
  classification of the algebras matters rather than the drawing of them.
