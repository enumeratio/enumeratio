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
- **`src/latex.ts`** — the `LatexRule` hook: a library declares how a head reads and writes
  LaTeX as a `LatexDictionaryEntry` narrowed to the parser and serializer methods libraries
  call (`LatexReader`, `LatexWriter`); `latexEntries` is where it becomes compute-engine's own.
- **`src/inputform.ts`** — `toInputForm`: an expression printed as Epsil you could retype,
  over compute-engine's `serializeEpsil`. Here so `ToString` needs no format registry;
  `@enumeratio/formats/inputform` re-exports it.
- **`src/facade.ts`** — what a library imports in place of `@cortex-js/compute-engine`: `Engine`,
  `Expr`, `Json`, `HeadDefinition`, `EvalOptions`, `Type` (aliases of compute-engine's own
  types), the `isNumber` / `isSymbol` guards, `box(ce, json)`, and the patterns libraries used
  to reach into compute-engine for (`src/probe.ts`): `isNativeHead` (is it already defined?),
  `nativeEvaluate` (the current handler, to fall back on) and `withAssumptions` (assume inside
  a scope that is dropped after). The `no-restricted-imports`
  rule in the root `vite.config.ts` keeps libraries (`packages/symbols`) to it; files still
  importing compute-engine are in `packages/utils/tests/compute-engine-imports.baseline.json`,
  which may only shrink.
- **`./testing` (`src/testing.ts`)** — `createEngine(...declares)`: a fresh engine with the
  given `declareX` steps applied in order; `bareEngine()`: one with nothing declared;
  `createLatexEngine(rules, ...declares)`: one whose LaTeX dictionary has the `LatexRule`s.
- **`./unstable` (`src/unstable.ts`)** — the full compute-engine API, outside semver. Each use
  carries an `// unstable: <reason>` comment. **`./unstable/latex-syntax`** is the same for
  compute-engine's `/latex-syntax`.
- **`./compiled` (`src/compiled.ts`)** — a separate entry so only packages that actually
  compile to JavaScript pull in compute-engine's compiler. `compileExpression` lowers an
  expression to a function of its free variables; a head's own lowering is its definition's
  `compile` field (`CompileHandler`).

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
