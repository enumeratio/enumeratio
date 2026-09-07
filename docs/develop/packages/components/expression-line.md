# `<enumeratio-expression-line>`

Client-side only, and purely **presentational** — one row of an
[`<enumeratio-expression-set>`](/develop/packages/components/expression-set): a drag-handle + type-badge gutter, an
[`<enumeratio-math-input>`](/develop/packages/components/math-input) box, a result column (value or error), and a
gear-toggled details panel (engine + SQL). It holds no `LineGraph`/`Scope`/evaluation state of its own — the owning
set feeds it `state` and reacts to the events it re-emits. You will not normally use this element on its own; it's
documented separately because the set's own doc gets long enough without also covering the row's own surface.

## Attributes / properties

| name | kind | type | meaning |
|---|---|---|---|
| `line-id` | attribute | string | this line's id in the owning set |
| `latex` | property | string | the row's current LaTeX |
| `completer` | property only | `Completer` | passed straight through to the inner `<enumeratio-math-input>` |
| `state` | property only | `LineState` | `{ type?, value?, error?, engine?, sql?, busy? }` — what to render |

`LineState.type` is the rendered type badge text (`∈ triangular_numbers`, `ℕ`, `𝔹`, `f: (n) ↦` — see the set's doc
for the full mapping); `value`/`error` drive the result column; `engine`/`sql` fill the gear-toggled details panel;
`busy` shows a `…` placeholder while an evaluation is in flight.

## Events

Every event is composed (crosses the shadow boundary) and bubbles, carrying `lineId` (except `line-reorder`, which
carries the drag source/target instead):

| event | detail | when |
|---|---|---|
| `line-input` | `{ lineId, latex }` | re-emitted from the inner math-input's `enumeratio-input` |
| `line-commit` | `{ lineId }` | Enter in the box (re-emitted `enumeratio-commit`) |
| `line-move` | `{ lineId, direction }` | caret moved out of the box at a boundary |
| `line-remove` | `{ lineId }` | Backspace on an **empty** line, the Enter-on-empty fallback, or the row's own × button |
| `line-reorder` | `{ sourceId, targetId }` | a drag-handle drop landed on this row |

Backspace-on-empty relies on native `keydown` bubbling through the math-input's shadow root (keyboard events are
`composed`) rather than reaching into that shadow DOM — if an adapter ever swallowed the key before it bubbles, an
Enter on an already-empty line still removes it (the fallback in `onCommit`).

## Methods

`focus()` — focuses the inner math-input.

## Usage

You will not normally instantiate this directly; see
[`<enumeratio-expression-set>`](/develop/packages/components/expression-set) for a working notebook. In isolation:

```html
<enumeratio-expression-line line-id="l1" latex="x + 1"></enumeratio-expression-line>
<script>
  el.state = { type: 'ℕ', value: '2' }
</script>
```
