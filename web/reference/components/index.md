# Components

Every `<notatio-*>` custom element, with its attributes, types and defaults read straight
out of the source at build time — so these tables cannot drift from the code.

The components are plain custom elements built on [Lit](https://lit.dev). They need no
framework: import `@enumeratio/notatio` for the side effect and use the tags in any
HTML. The [playground](/playground/) shows each one working; this reference is for
reading the dials.

## Expression attributes take an expression

An attribute that holds an expression — `value`, `expr`, `u`/`v` — is written in
**Epsil**: `Sin(x) * Cos(y)`, with products spelled out
(`x y` is a parse error, though `3x` is not). LaTeX is read only inside a `$…$` island:
`value="$x\sin(x)$"`.

That includes the editable components: a `<notatio-notebook>`'s or `<notatio-worksheet>`'s
`seed` is Epsil, converted to LaTeX only for the MathLive field that edits it;
`in-form="latex"` hands the field LaTeX as written. A seed may bind with `:=` — a cell is
an expression plus one binding. `<notatio-cell>` is different: its `value` is written in the
syntax its `format` names (`epsil` by default, or `latex`, `mathjson`, `wolfram`), and
its `in-form` instead picks which editor shows it.

Two components keep LaTeX as their own form. `<notatio-in>` _is_ the math field, so its
`value` is the field's LaTeX. `<notatio-out>` renders an encoding it is handed rather
than input someone authored, so it keeps a `format` attribute naming the encoding —
`latex` (the default), `mathjson` or `epsil`. The [formats reference](/reference/formats/)
covers those.

A value that fails to parse renders nothing at all, silently. To find out why, name the
component's namespace and reload:

```js
localStorage["notatio:debug"] = "plot3d"; // or "plot*", or "*"
```

## The components

<ComponentIndex />
