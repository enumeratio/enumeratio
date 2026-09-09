# `<enumeratio-notebook>`

Client-side only. A small **notebook**: a stack of
[`<enumeratio-expression-line>`](/develop/packages/components/expression-line) rows sharing one symbol `Scope` and
one `LineGraph` ([`@enumeratio/notatio`](https://github.com/enumeratio/enumeratio/tree/main/packages/notatio))
— declare a symbol into a collection, define it, reference it from a later line, drag lines around (evaluation order
follows the dependency graph, not display order). Needs a Db via `provideDb()` (the docs set this up globally).

Grammar-wise this is the same MathJSON pipeline `@enumeratio/notatio` builds: `parse → bind → lower → evaluate`
per line, with `bind`/`lower` type-checking and IR-lowering a line against the Scope every OTHER line's
already-evaluated result populates.

## Attributes / properties

| name | kind | type | meaning |
|---|---|---|---|
| `value` | attribute/property | JSON string | seeds the notebook: `{ lines: [{ id?, latex, expect? }] }`. Also readable live — see below |
| `storage-key` | attribute | string | when set, lines persist to `localStorage[storage-key]` and seed FROM it (taking precedence over `value`) if non-empty |
| `readonly` | attribute | boolean | render lines non-editable (read-only field, no per-cell chrome/drag/menu, no toolbar) and never mutate — the environment still parses, evaluates, and asserts. For embedding worked examples as live, self-checking, non-editable displays |

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

A line is one of three shapes (see `@enumeratio/notatio`'s `ast.ts`/`bind.ts`):

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
<enumeratio-notebook value='{"lines":[
  {"id":"d1","latex":"\\operatorname{bell}(4)"},
  {"id":"d2","latex":"\\binom{6}{2}"},
  {"id":"d3","latex":"f(n) = n^2 + 1"},
  {"id":"d4","latex":"f(3)"}
]}'></enumeratio-notebook>
</ClientOnly>

Edit any line — later re-embeddings (`f(3)`) recompute automatically. Press Enter to open a new line below the
current one; Backspace on an empty line removes it; drag the `⋮⋮` handle to reorder rows (cosmetic — evaluation
still follows the dependency graph).

### Read-only, self-checking examples

`readonly` renders the same engine non-editable — no field editing, no chrome, no toolbar — so a page can embed
worked examples that still evaluate live. Give a line an `expect` and it self-checks: a green ✓ means the live
result matches. For a bare, frameless embed (a reference page), use `<enumeratio-expressions>` (the notebook's
evaluation core without the surrounding chrome); `<enumeratio-notebook readonly>` adds the frame.

<ClientOnly>
<enumeratio-expressions readonly value='{"lines":[
  {"latex":"\\binom{6}{2}","expect":"15"},
  {"latex":"\\sum_{i=1}^{4} i","expect":"10"}
]}'></enumeratio-expressions>
</ClientOnly>

::: info Engine coverage
The docs wire the notebook to the **pure compute-engine stack** (`ts + ce + ce-enum`, no pglite — see
`notebookEngine()`): every result is answered by [`@enumeratio/compute-engine`](/develop/packages/components/).
That covers arithmetic, the counting sequences (`bell`, `catalan_number`, `partition_number`, …) and
`random_element`/enumeration over any collection with a certified CE twin. The located-element primitives
(`\in` + locate, `next`/`prev`/`rank`) need a scalar-valued collection the compute-engine library carries a twin
for; until more collections earn one, prefer the value-producing forms shown above.
:::

See [the notebook explorer page](/explore/notebook/) for a fuller worked example with a user-defined function, or
the [Language Reference](/reference/) for what each head in a line (`unrank`, `BellB`, `SymmetricGroup`, …)
actually means.
