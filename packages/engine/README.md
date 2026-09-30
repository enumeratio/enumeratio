# @enumeratio/engine

Plumbing over `@cortex-js/compute-engine`: checked accessors for reading values out of
`BoxedExpression`, Wolfram-style options and messages, a cooperative deadline, one seeded
`Random`, and the `Power` LaTeX entry every dictionary needs. Every symbol package sits on
top of this one — it has no workspace dependencies of its own.

- **`.` (`src/index.ts`)** — `operandsOf`, `symbolNameOf`, `integerAt`, `bigIntegerAt`,
  `stringAt`: read `.ops` / `.symbol` / `.re` / `.numericValue` off a `BoxedExpression`
  through one checked accessor apiece rather than casting the union at every call site.
- **`src/options.ts`** — Wolfram-style trailing option rules (`PlotRange -> (-1, 1)`):
  `OptionsPattern` semantics, leftmost setting wins, read and written without rewriting the
  expression to hold them.
- **`src/messages.ts`** — `Head::code` messages: a head that declines to evaluate stays
  unevaluated (never `["Error", …]`) but can say why, with arguments spliced into a template.
  See also [Syntax and Formats](https://github.com/enumeratio/enumeratio/wiki/Syntax-and-Formats).
- **`src/deadline.ts`** — `withDeadline` / `checkpoint()`: a cooperative budget for loops
  (Pollard rho, baby-step giant-step) that never pass through compute-engine's own boxed
  deadline frame.
- **`src/random.ts`** — the one `Random` head, drawing from a seeded stream per engine
  ([Random](https://github.com/enumeratio/enumeratio/wiki/Random)); Wolfram's `RandomInteger` / `RandomVariate` rewrite to it.
- **`src/latex.ts`** — the `Power` LaTeX dictionary entry every host dictionary should use in
  place of compute-engine's native one (correct parenthesisation of the base).
- **`src/inputform.ts`** — `toInputForm`: an expression printed as Epsil you could retype,
  over compute-engine's `serializeEpsil`. Here so `ToString` needs no format registry;
  `@enumeratio/formats/inputform` re-exports it.
- **`./compiled` (`src/compiled.ts`)** — a separate entry so only packages that actually
  compile Epsil to JavaScript pull in compute-engine's compiler.

## Commands

```sh
vp check   # format, lint, type check
vp test    # tests/*.test.ts
vp pack    # build dist (also: vp pack --watch)
```

## Next

Reference entries and oracle goldens for heads that use this plumbing live in
[`reference`](../reference/README.md). For the `Head::code` message convention and Epsil generally, see
[Syntax and Formats](https://github.com/enumeratio/enumeratio/wiki/Syntax-and-Formats).
