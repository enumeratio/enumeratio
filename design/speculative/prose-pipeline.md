# Prose through the engine

Status: **speculative**. This proposal takes over BL-8 and implements step 4 of design/boxes.md ("Prose and Markdown").

## What's wrong today

Record prose (summaries, details, captions, oracle notes, and now `index.md` bodies) is raw text. `prose-math.ts` recognises only `$…$`, which it hands to `<notatio-out>`, and MathLive's static renderer typesets that. As a result:

- `${}_pF_q(a;b;z)$` isn't math: `${` is refused so that Manipulate's `${name}` placeholders survive, and every `$` after it pairs with the wrong partner.
- Some spans render empty.
- Backticks, emphasis and links show as literal text.
- Example cells show StandardForm (`HypergeometricPFQ([1,1],[2],0.5)`), not the notation.
- MathLive's static markup isn't selectable the way text is.

## The model

A piece of prose is markdown, and it reads into a box tree (design/boxes.md): prose boxes (`Cell`, `TextData`, `StyleBox`, `ButtonBox`) with formula boxes inside them. It renders from that tree. There are two kinds of hole.

- **`$…$` / `$$…$$` is notation, held.** The LaTeX parses to MathJSON under `HoldForm`: an expression written down and never evaluated, so `$2+2$` stays 2 + 2. It typesets as TraditionalForm (`makeBoxes` → `toLatex` → KaTeX). LaTeX our parse can't represent falls back to KaTeX on the raw TeX, flagged in dev. An explicit Epsil island may evaluate later; it isn't part of this.
- **`<Head …>` is an expression, evaluated.** A tag reads through the vdom reader (design/vdom.md: children are the arguments, as one Epsil list; attributes are named arguments or options) into MathJSON. The page's engine evaluates it, and `ToBoxes` of the result decides what it becomes:
  - **math** (the result's boxes are formula boxes) typesets as TraditionalForm, in KaTeX, inline in the run;
  - **boxes** (`Manipulate`, `DynamicModule`, a table, a plot, anything whose boxes are layout or a component) are inlined as themselves, and each renderer draws them (DOM on a page, text in a pipe);
  - **a free variable with a type or range** (`<Symbol name="k" type="integer" range="1..9" />`) becomes a tangle control, as in prose-mode Manipulate (`prose.ts`), and the readouts that use it are `DynamicBox`es.

## One function, two times

`renderProse(markdown, engine, env)` returns prose boxes, with realisers for each environment (design/rendering-environments.md):

- **build (SSR):** boxes → HTML. KaTeX's `renderToString` for formulas, plain HTML for the prose, and a placeholder the client hydrates for anything live. Selectable text, no MathLive.
- **runtime** (live pages, notebooks, the worksheet): the same function in the browser. A live hole re-renders from its `DynamicBox`.
- **text** (outline, slug, local search, `<title>`, copy, no-JS readers): boxes → Unicode text (`2⁵³`, `₂F₁(a,b;c;z)`), with InputForm where no glyph exists. This settles BL-8's heading case.

Markdown is also a target: `toMarkdown(boxes)` writes CommonMark with `$…$` islands, for GitHub and for docs as data.

## Example cells

An example's Out is its value, so it goes the same way as a tag: TraditionalForm in KaTeX when its boxes are math, and the component or boxes otherwise. The In cell shows the example's expression held, in TraditionalForm, with the menu still switching forms (Epsil, FullForm, …). MathLive loads only when a cell is edited.

## Answers to BL-8's questions

1. **Delimiter.** `$…$` stays LaTeX (held notation). `${}` (an empty group) is accepted, since placeholders are never empty. Expressions are `<Head>` tags, not a new delimiter.
2. **Inline renderer.** KaTeX for formulas; DOM for boxes.
3. **Copy.** text/plain gets InputForm (Epsil); text/html gets the rendered HTML with the LaTeX in a KaTeX annotation.
4. **Scope.** The mechanism first on reference pages (records' prose and example cells), then guides and components, then the Unicode-superscript sweep.

## Order

1. The prose reader and renderer in `@enumeratio/boxes`: the `Cell`/`TextData`/`StyleBox`/`ButtonBox` heads, the markdown subset reader, `toMarkdown`, `toText`, and the KaTeX realiser in the web layer. `$…$` held; `${}` fixed.
2. Reference pages render records' prose through it, at build, and example cells as TraditionalForm in KaTeX.
3. `<Head>` tags in prose: vdom reader → evaluate → `ToBoxes`, math or boxes.
4. Controls: free typed variables as tangle knobs, `DynamicBox` readouts; the prose-mode Manipulate moves onto this.
5. Guides and component pages; the BL-8 sweep.

## Open

- **The `Cell` name collision.** notatio's `Cell` (a notebook cell) versus Wolfram's prose `Cell`. The proposal is to name the prose block `TextCell` and keep `Cell`.
- **Where the KaTeX realiser lives.** `@enumeratio/boxes` has no runtime dependencies. The proposal puts `toKatex` in `components` (or `frontend`) and keeps boxes → LaTeX in `boxes`.
- **TraditionalForm coverage.** An In cell falls back to StandardForm where `makeBoxes` has no notation for a head yet. The notation-as-data step (boxes.md §2) closes those gaps.
