# Design: rendering in other environments

Status: **thinking, not a plan**. Companion to [vdom.md](./vdom.md) (the AST as a
component tree; options as Wolfram rules) and
[graphics-and-space.md](./graphics-and-space.md) (graphics as values).
Those two settle what a rendering _is_ on the web. This note asks what it is anywhere else
-- a PDF, a printed page, a terminal, a phone -- and, more usefully, what the _axes_ are
along which those differ, so that the capabilities can be separated even if no second
renderer is ever built.

The short version: **an environment is a record of capabilities; the gap between what an
expression asks for and what the environment has is closed by rewriting the expression,
not by teaching each renderer to degrade.** Everything below is that sentence unpacked.

## 1. What already exists, seen as a pipeline

Today's path from a value to pixels has five stages, and they are already separable --
that is the finding this note is built on:

| stage         | where                                                                                               | in                 | out                                       |
| ------------- | --------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------- |
| **evaluate**  | compute-engine                                                                                      | notatio / MathJSON | MathJSON                                  |
| **structure** | `notatio/src/vdom.ts` `structuralOf`                                                                | MathJSON           | `Rendering` (`tag, attributes, children`) |
| **lower**     | `symbols.ts` (`renderingOf`, `lowerOptions`) or the element itself (`notatio-lit/src/structure.ts`) | `Rendering`        | a component's own attributes              |
| **mount**     | `notatio-lit`, `notatio/vue`, `notatio/react`, `markupOf`                                           | `Rendering`        | DOM / vnodes / HTML string                |
| **draw**      | `plot.ts`, `glyphs.ts`, … (pure), `@enumeratio/raster`                                              | geometry           | SVG, PNG                                  |

Lowering happens in two places by design (vdom.md, "Where the lowering lives"): a
framework mounts the structural tree and the _element_ lowers when it adopts its
children; a host with no elements -- the CLI, a terminal, a typst serializer -- lowers
through the base's table. Both read the same `VisualSymbol` map, and options reach both
as trailing rules (`optionsOf` in `formats`). That is what makes a non-DOM backend
possible at all: the table is in the base, not in the components.

The CLI already runs the evaluate, lower and draw stages in Node with no DOM, and mounts to a terminal
through the kitty/iTerm image protocols (`cli/src/node-graphics.ts`). So "a terminal
renderer" is not hypothetical; it is a mount stage with a very narrow surface. What it
lacks is any account of _what to do when the tree asks for something the surface cannot
give_ -- a `Slider` in a piped stdout, a `ComplexPlot` (WebGPU) on paper.

Everything a renderer might be asked to show is, after structuring, one of five kinds of node:

1. **typeset mathematics** -- a `notatio-out` (or a generic element) over an expression;
2. **a graphic** -- `Plot`, `Histogram`, `ComplexPlot`, `Image`, a glyph;
3. **a control** -- `Slider`, `Toggler`, `Animator`, a knob in prose;
4. **a readout** -- `Dynamic`, `When`, a `Manipulate` body: something re-evaluated when a
   control moves;
5. **layout** -- `Row`, `Column`, `Grid`, `Panel`, `Labeled`, and a document's `Cell`s.

Each environment differs in what it can do with each of those five. That is the whole
design space.

## 2. The axes

The environments named in the question -- interactive PDF, print, terminal, mobile --
are points; the axes are what generalise. Seven of them matter; the first is the one
that decides everything else.

**Engine at view time.** Is there a compute engine when the reader looks? The web, a
REPL, a phone app: yes. A PDF, a printed page, a PNG, a piped stdout: no. Without an
engine there is no re-evaluation, so a control cannot _do_ anything and a readout
cannot change. This is not a matter of degree: a control in a no-engine environment is
either a picture of a control or it is gone, and either way its variable must be given
a value _before_ rendering. (Wolfram's CDF -- ship the engine inside the document -- is
the counter-example, and it is dead. Precompute instead.)

**Interaction.** None (paper); links only (PDF, HTML export); keys (a TTY: arrows,
hjkl, type-in); pointer (hover, drag, precise position); touch (drag, no hover, second
finger, competes with scroll). These are not ordered -- a phone has touch and no hover; a
terminal has keys and no pointer -- so the rendering of a control is a table over this
axis, not a fallback chain.

**Time.** Static (one frame); frames (a filmstrip, a GIF, a set of PDF layers); live
(a frame loop with an engine behind it). `Animator`, playback, `Clock` and every `play`
attribute sit on this axis. Note frames-without-engine is a real point: a GIF of a
sweep is an honest export of an `Animator`.

**Surface.** What can be drawn: DOM; vector (SVG, PDF paths, typst); raster (PNG, a
terminal image protocol); text cells (a grid of characters, with or without colour,
with or without Unicode). A terminal is the interesting one because it can be any of
the last three depending on `$TERM`, and the same session can be piped, at which point
it is text-only and static.

**Typesetting.** MathLive / KaTeX (DOM); real TeX (typst, LaTeX -- the one place a PDF
is _better_ than the web); 2-D Unicode layout (a terminal: Wolfram calls this
`OutputForm`, and the kernel prints it by default); one-line ASCII (`InputForm` /
`AsciiMathForm`, both of which already exist on `notatio-out`). So the typesetting
axis is already spelled as `*Form` symbols, and an environment chooses a default form.

**Layout.** Flow (a web page); paged (print, PDF: page breaks, margins, In/Out labels
in the gutter); a fixed cell grid (terminal: width in columns, wrapping is a decision);
compact (a phone: one column, a `Row` reflows, a `Manipulate` strip becomes a sheet).

**Colour.** Light / dark; mono (print, a dumb terminal); 16 / 256 / truecolor.
`raster.flattenCss` already does the theme-to-literal collapse for one case (resvg has
no custom properties); it is the seed of a general "resolve the theme for a surface
that cannot" step.

The named environments, on those axes:

| axis        | web            | print / PDF       | terminal (TTY)         | terminal (pipe) | mobile (native) |
| ----------- | -------------- | ----------------- | ---------------------- | --------------- | --------------- |
| engine      | yes            | **no**            | yes                    | no              | yes             |
| interaction | pointer, touch | none (PDF: links) | keys                   | none            | touch           |
| time        | live           | static            | live                   | static          | live            |
| surface     | DOM            | vector (+raster)  | text / raster (kitty)  | text            | native + raster |
| typesetting | MathLive       | TeX               | OutputForm / AsciiMath | AsciiMath       | KaTeX or native |
| layout      | flow           | paged             | cell grid              | cell grid       | compact         |
| colour      | light/dark     | light, mono       | 16..truecolor, dark    | mono            | light/dark      |

Two things fall out of the table. Print and PDF are the same column: an "interactive PDF"
differs from paper by links, and at a stretch by layers (§4), never by an engine. And a
terminal is two columns, chosen at runtime by `isTTY` -- the same signal Wolfram exposes as
`$FrontEnd`.

## 3. Reduce, then render

Given an environment record, the proposal is one pure pass:

```
reduce(expr, env) : MathJSON -> MathJSON
```

that rewrites whatever `env` cannot honour into something it can, _in the expression_,
before `renderingOf` ever sees it. It is expression-to-expression, so it is golden-testable
with no backend, and the reduced expression is a legitimate value: it can be printed,
stored, and rendered by the existing web stack to show what a print would look like.

`reduce` sits upstream of `structuralOf`, so it is invisible to every backend: the
frameworks still mount the structural tree, the elements still lower their own
children. A control that survives reduction is one the environment can drive.

What it rewrites, by node kind:

- **Controls without an engine** -- a control is a declaration (`k` ranges over `[0, 5]`,
  initially `2`), and a declaration has two static readings:
  - **pin**: substitute the initial (or a chosen) value and drop the control, keeping the
    declaration as a caption so the reader knows what was variable:
    `Manipulate(Plot(Sin(k x), …), (k, 2, 0, 5))` becomes `Labeled(Plot(Sin(2x), …), "k = 2 (0 ≤ k ≤ 5)")`;
  - **sample**: replace the control by a layout of its values -- the print-native answer to
    a slider is small multiples: `Grid` of `Plot(Sin(k x))` for `k ∈ {0, 1, …, 5}`, each
    labelled. Discrete controls enumerate; continuous ones sample on the `step` grid or
    at `n` points; `Slider2D` samples a small grid; an `Animator` becomes a filmstrip.

  Which reading applies is policy in `env` (print: sample up to `n`, then pin), and an
  author can force one as a trailing option, Wolfram's way and ours
  (`Manipulate(…, Static -> "Pin")` -- the name is open, the mechanism is `optionsOf`).
  The pin value is the control's initial value by default, which is what Wolfram does
  on export. A pinned `Locator` is the same rewrite: the point becomes
  `Epilog -> Point((x, y))` on the plot it sat over.

- **Readouts without an engine** -- `Dynamic(e)` becomes `e` evaluated under the pins;
  `When(test, …)` chooses its branch; a knob in prose becomes its number, and the prose
  reads as a sentence about that one case.

- **Time without a loop** -- `Animator` / `play` under `time: static` pins (or samples to
  a filmstrip); under `time: frames` produces a `List` of frames for the exporter (GIF,
  PDF layers, a sprite strip). The pure `iterate` / `advancePlayback` in `playback.ts`
  already compute the frame values.

- **Graphics the surface cannot draw** -- `ComplexPlot` (WebGPU) on a vector or raster
  surface becomes `Image(Rasterize(…))` (`Rasterize` exists; the GPU eval has a CPU path
  in `gpu-eval.ts`'s fallback); on a text surface a `Plot` becomes a braille/block chart
  or an ASCII one. This is the [graphics-and-space §3](./graphics-and-space.md) "how does
  a projection decline" question, answered: it declines by rewriting to a graphic the
  surface has.

- **Layout under a narrower layout model** -- `Row` on a phone reflows to `Column` past a
  width; `Grid` on a cell grid gets column widths in characters; `Cell` in a paged
  layout gets a break policy (keep In and Out together).

- **Typesetting** -- not a rewrite but a choice of default `*Form` per environment, applied
  at the leaves: TeX for print, `OutputForm` for a TTY, `AsciiMathForm` for a pipe.

After `reduce`, the tree contains only nodes the environment claims to support, so a
backend never needs a fallback branch. That is the point: five backends times five node
kinds times seven axes is not a matrix anyone maintains; one reduction pass over an
`env` record is.

## 4. The environments, one at a time

Reading each named environment through §3, with the honest cost of each.

### Print, and PDF as print

Nearly free, because the web backend already renders everything: print is `reduce(expr,
print)` mounted by the existing components under `@media print` styles, and a browser (or
Playwright) writes the PDF. Controls sample or pin; the caption carries the declaration;
`ComplexPlot` rasterizes; dark theme resolves to light. This is the environment to build
first _if any is built_, because its cost is a stylesheet and the reduction pass, and it
is testable by rendering the reduced expression on the ordinary site.

A second, better-typeset route exists: `Rendering → typst` (a sibling of `markupOf`), with
SVG graphics embedded and mathematics set by a real typesetter. Worth it only when the
output is a document rather than a page; the reduction is the same.

**What "interactive PDF" can mean.** Without an engine, three things: hyperlinks
(free); form fields (a text field whose value nothing computes -- useless here); and
**optional content groups** -- a sampled control's frames as layers, switched by link
actions (`SetOCGState`). The last is real PDF, viewer support is uneven (Acrobat yes,
pdf.js partly, Preview no), and typst cannot emit it -- it needs a post-pass with
`pdf-lib`. It is the `time: frames` point of §2 wearing a PDF suit. Possible; niche;
defer, and say so in the caption when a document was made without it.

### Terminal

Three tiers, chosen at runtime from the environment: **text** (AsciiMath output, ASCII
plots, the pipe case); **text with Unicode and colour** (2-D `OutputForm` layout,
braille/block-character plots, a truecolor chart -- what `plotext` and `ratatui` do);
**inline images** (kitty / iTerm / sixel -- already done for glyphs and plots). The tier
is `surface`; everything else is unchanged.

The interesting part is that a TTY _has_ an engine, so controls are real, only keyed
rather than pointed. The tangle knob maps almost exactly: a number in a sentence that the
arrows scrub, with the same gear concept (Shift = coarse, Alt = fine, digits = type-in),
and a slider draws as `k = 2  ◂━━━●━━━━▸ [0, 5]` with a focus ring moving between
controls on Tab. Playback is a timer that redraws. The scrub and playback arithmetic
(`tangle.ts`, `playback.ts`) is already in the base with no DOM in it; the terminal
backend would be a fifth mount over `Rendering` -- `notatio-terminal` has the host side
of this already. Piped output is the static column: `reduce` with no engine, `InputForm`
at the leaves, and a plot as text or omitted with a note.

### Mobile

Two routes, and they are not exclusive. A **WebView** gets everything the web has today
(touch is handled: axis-locked drag, second-finger gear, long-press menus) and needs only
the `layout: compact` reductions -- `Row` reflows, the `Manipulate` strip becomes a
bottom sheet, hover affordances (the knob's flanking arrows, plot hover readouts) become
tap and long-press. A **native** app is a fifth component set behind the same symbols --
SwiftUI / RN views named for the heads -- mounted from the same `Rendering` tree the vue
and react packages mount; the argument for it is feel and battery (WebGPU in a WebView
is the weak point; `ComplexPlot` would rasterize or go Metal). Either way the reduction
and realization are shared; only the mount differs.

### Export, which is not an environment

`Export(expr, "png" | "svg" | "gif" | "pdf")` -- Wolfram's word -- is `reduce` to the
matching static environment followed by a serializer, and it is what the REPL's "give me
a file" and the site's "download this figure" both are. Naming it makes the no-engine
column of §2 the _common_ case rather than an edge: every export is a print.

## 5. What each control does, per environment

The table the question asked for. "pin" and "sample" are §3; "keys" is the TTY reading;
web and touch are what ships.

| control                                                                | web / touch              | keys (TTY)                      | static (print, pipe, export)           |
| ---------------------------------------------------------------------- | ------------------------ | ------------------------------- | -------------------------------------- |
| `Slider`, `VerticalSlider`                                             | drag, arrows, gears      | arrows on focus, gears, type-in | pin, or sample on the step grid        |
| `IntervalSlider`                                                       | drag either end          | Tab between ends, arrows        | pin both ends                          |
| `Slider2D`                                                             | drag in the plane        | arrows on both axes             | pin, or a small grid of samples        |
| `ColorSlider`                                                          | pick                     | arrows over hue                 | pin, swatch in caption                 |
| `Animator`, `play`, `Clock`                                            | frame loop               | timer redraw, Space toggles     | pin; or filmstrip / GIF / layers       |
| `SetterBar`, `RadioButtonBar`, `TogglerBar`, `PopupMenu`, `ListPicker` | click                    | arrows / digit selects          | pin, or enumerate all choices          |
| `Toggler`, `Checkbox`                                                  | click cycles             | Space cycles                    | pin; or both states side by side       |
| `Locator`                                                              | drag a point on the plot | arrows nudge the point          | pin, drawn as a marked point           |
| `InputField`                                                           | type                     | type                            | pin, value shown as text               |
| knob in prose                                                          | scrub, gears, menu       | scrub with arrows on focus      | the number, inline; caption says range |
| `Dynamic`, `When`                                                      | re-evaluated             | re-evaluated                    | evaluated once under the pins          |

The right-hand column is the one that generalises: every control has a pin and most have
a sample, and those two operations are all the no-engine world ever needs.

## 6. Where it is

The first slices landed on this branch (2026-09-17); nothing needed a second renderer to
be useful:

- **`Environment`** (`notatio/src/environment.ts`): the axes as a record, the presets
  (`WEB`, `PRINT`, `TTY`, `PIPE`, `COMPACT`), and two detectors that take their signals
  as arguments -- `nodeEnvironment({ isTTY, env })` and `browserEnvironment(mediaSignals(matchMedia))`.
- **`reduce(expr, env)`** (`reduce.ts`): `declarations` reads every control and
  Manipulate parameter (`VisualSymbol.control` says what kind it is); `pinValue` /
  `sampleValues` / `caption` are the per-kind readings; the rewrite pins all but one,
  samples that one into a `Grid` (a `Row` for an `Animator`), keeps a `Dynamic` for the
  renderer to evaluate, rasterizes a GPU plot, stacks a `Row` in a narrow column. The
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

Ways in, for a reader: printing any page of the site (every `<Notatio>` reduces for
`print`), narrowing the window past 640px, the cards on `/playground/environments`, the
REPL's `:env <name>` and the CLI's `--env <name>`, and the demo corpus's **Environments**
group, which runs in both browser terminals.

Still to do, in the order it pays: the static-policy option's name (§7); a text layout
for `Grid` / `Row` / `Labeled` on the text surface (the pipe prints them as notatio); a
typst serializer; `OutputForm`.

## 7. Open questions

- **Naming the static policy option.** The convention is settled -- a trailing rule,
  read by `optionsOf` -- but the name is not: Wolfram has nothing to borrow (its export
  snapshots silently). `Static -> "Pin" | "Sample" | n` is a placeholder.
- **Sampling budget.** Small multiples explode on two or three controls (product of
  samples). A policy of "sample the first, pin the rest" is simple and probably right;
  a page budget in figures is the alternative.
- **Is the reduced expression the document?** If `Cell` becomes a value
  ([graphics-and-space §4](./graphics-and-space.md)), a reduced notebook is a notebook
  with its controls pinned -- storable, diffable, re-renderable. That is attractive and
  is also the point where a document format starts to exist.
- **Terminal typesetting.** `OutputForm` (2-D layout in cells) is a real piece of work
  -- fraction bars, radicals, matrices -- and the only part of the terminal column with
  no existing code behind it. The REPL prints notatio (InputForm) meanwhile.
- **Where the terminal mount lives.** `notatio-lit` is the DOM mount (Lit elements,
  MathLive for the field, xterm for the browser REPL surface); a TUI is not lit and not
  the DOM -- it is a third mount over the same base, and today it lives in `cli` because
  that is where the Node host is. If it grows past a strip, it wants a package of its own
  beside lit, not inside it.
- **Whether the environment is one record or a negotiation.** A page can host a print
  preview of itself; a terminal can lose its image protocol mid-session (ssh). The record
  is a snapshot; whether `reduce` runs once or on change is the reactive-core question in
  another shape.
