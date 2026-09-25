# notatio

_notatio_: a marking, a note, a designation. The interface — how mathematics is **written**
and **shown**. The [kernel](/nucleus/) and the [core](/aestimatio/) say what an expression
means; notatio is how a person types one, reads one, and moves it by hand.

## Writing: the syntax

notatio is also the name of the syntax: the single-expression subset of Epsil, with
capitalized heads and ordinary parentheses — `Binomial(10, 3)`, `Sin(a * x)` — and LaTeX in
`$…$` islands where it reads better. What you type is what prints back. A worksheet cell is
notatio plus one `:=` binding.

Expressions arrive and leave in many formats — MathJSON, LaTeX, Wolfram, MathML, code — all
through one [format registry](/reference/formats/).

## Showing: the components

Every head that draws is a component named for it: `Plot` is `<notatio-plot>`, `Manipulate`
is `<notatio-manipulate>`, and so on through contour, density, vector, polar and complex
plots, charts, graphs, polytopes, glyphs and the reactive prose controls. The same pieces
work at three levels:

- **plain HTML** — Lit web components, `<notatio-plot value="Sin(x)">`, in any page with
  no framework at all;
- **Vue and React** — each symbol as a typed component, `<Plot>`, `<Histogram>`,
  `<Manipulate>`, generated from the element sources, so they drop straight into Vue
  Markdown (this site) or MDX;
- **an expression** — a head that draws _is_ its picture, so `Plot(Sin(x), (x, 0, 10))` in a
  cell evaluates to the plot. The expression tree is the vdom, and back.

The [component reference](/reference/components/) lists every attribute; the
[playground](/playground/) has one page of demos per component.

## Using it

- The [**worksheet**](/worksheet/) — named expressions, sliders and views that fall out of
  the cells.
- The [**notebook**](/notebook/) — the transcript, `In[n]` and `Out[n]` (on its way).
- The [**command line**](/docs/cli/) — the same evaluation in a terminal, a REPL or a
  pipe.

---

Built on [the kernel](/nucleus/) and [the core](/aestimatio/); the face of
[enumeratio](/enumeratio/).
