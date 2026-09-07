# `<enumeratio-expression-set>`

Client-side only. A small **notebook**: a stack of
[`<enumeratio-expression-line>`](/develop/packages/components/expression-line) rows sharing one symbol `Scope` and
one `LineGraph` ([`@enumeratio/expressions`](https://github.com/enumeratio/enumeratio/tree/main/packages/expressions))
— declare a symbol into a collection, define it, reference it from a later line, drag lines around (evaluation order
follows the dependency graph, not display order). Needs a Db via `provideDb()` (the docs set this up globally).

Grammar-wise this is the same MathJSON pipeline `@enumeratio/expressions` builds: `parse → bind → lower → evaluate`
per line, with `bind`/`lower` type-checking and IR-lowering a line against the Scope every OTHER line's
already-evaluated result populates.

## Attributes / properties

| name | kind | type | meaning |
|---|---|---|---|
| `value` | attribute/property | JSON string | seeds the notebook: `{ lines: [{ id?, latex }] }`. Also readable live — see below |
| `storage-key` | attribute | string | when set, lines persist to `localStorage[storage-key]` and seed FROM it (taking precedence over `value`) if non-empty |

`value` is a **seed/serialize pair, not a mirrored attribute**: writing it seeds the initial lines (once, at
connect); reading `.value` always returns the *live* `{lines:[...]}` JSON, not an echo of whatever was last written.

## Reading results

| accessor | type | meaning |
|---|---|---|
| `.value` | string | live `{ lines: [{id, latex}] }` JSON |
| `.values` | `Record<lineId, string>` | each line's rendered value, or its error text if it errored |

## Methods

| method | meaning |
|---|---|
| `addLine(latex?, afterId?)` | append (or insert after `afterId`) a new line; returns its id |
| `removeLine(id)` | remove a line (a no-op on the last remaining line) |

## Events

| event | detail | when |
|---|---|---|
| `change` | `{ value }` | on any edit (input, add, remove, reorder) |
| `result` | `{ value }` — JSON of `.values` | after each evaluation pass — wrap the whole set in [`<enumeratio-assert>`](/develop/packages/components/assert) to check every line's value at once |

## Type badges

Each line's gutter shows its bound type: `∈ <coll>` for a located element, `ℕ`/`ℤ`/`𝔹` for `natural_number`/
`integer_number`/`boolean`, the bare pg type name for any other scalar (`numeric`, or a registered algebra type),
and `f: (n) ↦` for a user-defined function (unapplied — a `define` with parameters produces no value of its own).

## Line syntax

A line is one of three shapes (see `@enumeratio/expressions`'s `ast.ts`/`bind.ts`):

- **declare** — `x \in \operatorname{triangular\_numbers}` — binds `x` as a located element of that collection; no
  value of its own.
- **define** — `x = 10` or `f(n) = n^2 + 1` — binds a value (or, with parameters, a function). Defining a symbol
  that was already `declare`d elem keeps it elem-typed: `x = 10` after `x \in \operatorname{triangular\_numbers}`
  *locates* `10` in that collection rather than just evaluating it — if the collection doesn't contain that value,
  the line errors `not a member of <coll>` instead of showing a value.
- **expr** — anything else — a plain value-producing (or boolean, for `\in`-as-expression / comparisons) expression.

`next`/`prev`/`rank` are generic per-collection primitives on a located element; ordinary arithmetic, `\binom{}{}`,
and catalog stats/maps work the same as in
[`<enumeratio-expression>`](/develop/packages/components/expression). Autocomplete (Tab/Enter with the popover open)
suggests collection names, function names, and the current scope's own symbols.

## Usage

<ClientOnly>
<enumeratio-expression-set storage-key="docs-expression-set-demo" value='{"lines":[
  {"id":"d1","latex":"x \\in \\operatorname{triangular_numbers}"},
  {"id":"d2","latex":"x = 10"},
  {"id":"d3","latex":"\\operatorname{next}(x)"},
  {"id":"d4","latex":"x + 1"}
]}'></enumeratio-expression-set>
</ClientOnly>

Edit any line — `x`'s later re-embeddings (`next(x)`, `x + 1`) recompute automatically. Press Enter to open a new
line below the current one; Backspace on an empty line removes it; drag the `⋮⋮` handle to reorder rows (cosmetic —
evaluation still follows the dependency graph).

See [the notebook explorer page](/explore/notebook/) for a fuller worked example with a user-defined function and
self-checking asserts.
