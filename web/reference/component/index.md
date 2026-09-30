# Components

Every symbol that draws — a plot, a chart, a control, a layout — as a custom element, named
for its symbol (`BarChart3D` is `<notatio-bar-chart-3d>`), its attributes read straight out
of the element source, so these tables cannot drift from the code. Import
`@enumeratio/components` for the registration. The [playground](/playground/) shows
each one working; this reference is for reading the dials.

## Expressions are written in Epsil

A prop that holds an expression — `value`, `expr`, `u`/`v` — is written in **Epsil**:
`Sin(x) * Cos(y)`, with products spelled out (`x y` is a parse error, though `3x` is not).
LaTeX is read only inside a `$…$` island: `value="$x\sin(x)$"`.

That includes the editable components: a `<Notebook>`'s or `<Worksheet>`'s `seed` is Epsil,
converted to LaTeX only for the MathLive field that edits it; `inForm="latex"` hands the field
LaTeX as written. A seed may bind with `:=` — a cell is an expression plus one binding.
`<Cell>` is different: its `value` is written in the syntax its `format` names (`epsil` by
default, or `latex`, `mathjson`, `wolfram`), and its `inForm` instead picks which editor shows
it.

Two components keep LaTeX as their own form. `<In>` _is_ the math field, so its `value` is the
field's LaTeX. `<Out>` renders an encoding it is handed rather than input someone authored, so
it keeps a `format` prop naming the encoding — `latex` (the default), `mathjson` or `epsil`.
The [formats reference](/reference/formats/) covers those.

A value that fails to parse renders nothing at all, silently. To find out why, name the
component's namespace and reload:

```js
localStorage["notatio:debug"] = "plot3d"; // or "plot*", or "*"
```

## The components

<ComponentIndex />
