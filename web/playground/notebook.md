# Notebook

`<notatio-notebook>` — a session that sits on top of the input/output components
and owns evaluation. It holds a compute-engine **scope** of its own (a child of
the shared engine, so its bindings never leak to other notebooks or the reference
pages), evaluates every cell in that scope, tracks dependencies between cells, and
re-evaluates live as you edit.

- **Bind a variable** with `:=` — e.g. `a := 5` or `f(x) := x^2`. Later cells use
  the name; change the definition and everything downstream updates.
- `=` stays an ordinary equation — only `:=` binds.

Everything runs client-side.

Variable-centric, like Desmos: named definitions lead each result. Because cells
can be reordered freely, references are **by name only** — there are no cell-number
references (a `Out[n]` / `In[n]` draws a diagnostic pointing you at a variable).
Drag a cell by its number (left) to reorder it; the numbering follows automatically.

<notatio-notebook seed='["a := 5", "b := a ^ 2 + 1", "Sqrt(b)", "10b"]'></notatio-notebook>

## Roadmap

- Grouping into folders; convert a cell into full-width block markup (a comment,
  prose, …), lifted out of the numbering, double-click to edit.
- This element is the [worksheet](/playground/worksheet) without its screen, and is set to
  fold into it: `Notebook` is the Wolfram symbol for a transcript, and that is what the
  [notebook](/notebook/) route will hold. See `design/notebooks.md`.
- A real terminal REPL running the `@enumeratio/cli` logic lives separately, under
  the [CLI docs](/docs/cli/repl) — not here.
