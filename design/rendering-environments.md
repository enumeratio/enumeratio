# Design: rendering in other environments

Status: **built**. The wider exploration this grew from — the axes environments differ
along, per-environment cost, open questions — moved to speculative/rendering-environments.md.
This is what landed.

## Where it is

The first slices landed on this branch (2026-09-17); nothing needed a second renderer to
be useful:

- **`Environment`** (`notatio/src/environment.ts`): the axes as a record, the presets
  (`WEB`, `PRINT`, `TTY`, `PIPE`, `COMPACT`), and two detectors that take their signals
  as arguments -- `nodeEnvironment({ isTTY, env })` and `browserEnvironment(mediaSignals(matchMedia))`.
- **`reduce(expr, env)`** (`reduce.ts`): `declarations` reads every control and
  Manipulate parameter (`VisualSymbol.control` says what kind it is); `pinValue` /
  `sampleValues` / `caption` are the per-kind readings; the rewrite pins all but one,
  samples that one into a `Grid` (a `Row` for an `Animator`), keeps a `Dynamic` for the
  renderer to evaluate (a host that evaluates itself folds each one with
  `evaluateReadouts` -- the CLI, the environment previews), rasterizes a GPU plot, stacks a `Row` in a narrow column. The
  captions are `Labeled(…, "k = 2 (0 ≤ k ≤ 5)", Bottom)` -- a third argument the
  `Labeled` symbol now honours. Goldens: `tests/reduce.golden.json`, every corpus line
  under every preset.
- **`pin(expr, values)`**: the same rewrite for a host that drives the controls itself.
- **The terminal** (`cli/src/drive.ts`): a result with declarations in it, at a TTY, is
  driven at the keyboard -- a strip of text sliders, arrows and Shift for the gears, Tab
  for focus, Space plays -- and the body under the strip is `pin` at the current values,
  evaluated by the session. Enter leaves it where it was; `Out[n]` prints the pinned
  expression. A pipe gets the static reduction.
- **The page** (`/playground/environments`, `EnvironmentPreview.vue`): the reduced
  expression rendered by the ordinary components, with a preset to pick; and
  `matchMedia("print")` flips it to `PRINT` when the browser prints, so the print of the
  page is the reduction done for real.

The seam held: `structuralOf`, `renderingOf`, the frameworks and the components are
untouched by reduction. What the page proof did surface was that the structural spelling
of a **layout** (`<notatio-row><notatio-list>…`) had never rendered -- adoption hid the
list -- and that a built component inside a structural tree had no `expression` for its
parent to read. Both are fixed in `structure.ts` (layouts unwrap their lists; adoption
runs deepest-first and puts an `expression` on what it adopts).

Second round (same branch): `<Notatio>` in Vue and React reduces for the page's own
environment (`pageEnvironment` / `watchPageEnvironment`: printing pins or samples, a
narrow window stacks the rows) or for an `env="print"` it is given; `textPlot`
(`notatio/src/textplot.ts`) draws a `Plot` on braille cells, which the CLI uses for an
evaluated `Plot` at a terminal without an image protocol and under the control strip;
one-shot text output (a pipe) reduces for `PIPE` while `--json` keeps the expression
whole; a pinned `Locator` is `Epilog -> Point(…)` on the first `Plot` in the tree.

The terminal strip takes the mouse where the terminal reports one (SGR 1006 with
button-event tracking): click a point on the bar, drag along it, wheel to step. The
y-axis gutter is a fixed width, so a changing label cannot shift the curve. And a line
is _committed_ by Enter, Wolfram-style: what the reader left becomes `Out[n]`, which
`Out(n)` / `%n` read back, while `In(n)` re-evaluates that line's input (Wolfram gives
`In[n]` a delayed value) and `InString(n)` returns it as typed.

Ways in, for a reader: printing any page of the site (every `<Notatio>` reduces for
`print`), narrowing the window past 640px, the cards on `/playground/environments`, the
REPL's `:env <name>` and the CLI's `--env <name>`, and the demo corpus's **Environments**
group, which runs in both browser terminals.
