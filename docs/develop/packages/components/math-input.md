# `<enumeratio-math-input>`

Client-side only. A **LaTeX math box** with catalog-aware autocomplete, backed by [MathLive](https://cortexjs.io/mathlive/)
(a swappable [`MathInputAdapter`](https://github.com/enumeratio/enumeratio/tree/main/packages/components/src/math-input-adapter.ts)
— MathLive is the only implementation today). Unlike [`<enumeratio-expression>`](/develop/packages/components/expression),
this component has **no built-in evaluator** — it is a pure editing surface. Wire up the `completer` property to
offer completions (collection names, function names, whatever the host wants to suggest), and listen for
`enumeratio-commit`/`enumeratio-input` to do something with what was typed.

## Attributes / properties

| name | kind | type | meaning |
|---|---|---|---|
| `latex` | attribute (reflects) | string | the field's LaTeX content |
| `placeholder` | attribute | string | LaTeX shown (grayed out) when the field is empty |
| `readonly` | attribute (reflects) | boolean | disables editing |
| `adapter` | property only | `AdapterFactory` | which widget renders the box (default `mathliveAdapter`) |
| `completer` | property only | `(before: string) => {replaceLen, candidates} \| null` | completion source; `null`/omitted disables the popover |

`adapter` and `completer` take functions/objects, so they can only be set as **properties** (`el.completer = …`), not
as HTML attributes.

## Events

| event | detail | when |
|---|---|---|
| `enumeratio-input` | `{ latex }` | on every edit |
| `enumeratio-commit` | `{ latex }` | Enter pressed **and no completion popover was open** |
| `enumeratio-move` | `{ direction: 'up' \| 'down' }` | the caret was moved out of the field (arrow key at a boundary) |
| `result` | `{ value, error }` | same shape as [`<enumeratio-expression>`](/develop/packages/components/expression) — so [`<enumeratio-assert>`](/develop/packages/components/assert) works unmodified |

## Keyboard

Typing runs the `completer` (debounced ~120ms) against the LaTeX before the caret. With the popover open: **↑/↓**
cycles candidates, **Enter**/**Tab** accepts the active one, **Escape** closes it — none of these reach MathLive
while the popover has focus, so the field's own caret doesn't move. With the popover closed, Enter fires
`enumeratio-commit` and arrow keys behave normally (including MathLive's own `move-out` at a field boundary).

## Usage

```html
<enumeratio-math-input latex="x \in \operatorname{triangular\_numbers}"></enumeratio-math-input>
```

<p>
<enumeratio-math-input latex="x \in \operatorname{triangular\_numbers}"></enumeratio-math-input>
</p>

## With a completer

A minimal completer matching a trailing identifier against a static list — set as a property once the element has
mounted (it's plain custom-element JS underneath, so this works the same outside Vue/VitePress):

```html
<enumeratio-math-input placeholder="\text{type a collection name}"></enumeratio-math-input>
<script>
  const CANDIDATES = [
    { label: 'triangular_numbers', insert: '\\operatorname{triangular\\_numbers}', kind: 'collection' },
    { label: 'prime_numbers', insert: '\\operatorname{prime\\_numbers}', kind: 'collection' },
    { label: 'permutations', insert: '\\operatorname{permutations}', kind: 'collection' },
  ]
  el.completer = (before) => {
    const m = /[a-zA-Z_]+$/.exec(before)
    const prefix = m ? m[0] : ''
    if (!prefix) return null
    const candidates = CANDIDATES.filter((c) => c.label.startsWith(prefix))
    return candidates.length ? { replaceLen: prefix.length, candidates } : null
  }
</script>
```

Try it — type `tri` (or `prime`, `perm`):

<ClientOnly>
  <enumeratio-math-input ref="mi" placeholder="\text{type tri, prime, or perm}"></enumeratio-math-input>
</ClientOnly>

<script setup>
import { ref, watch } from 'vue'

const mi = ref(null)
const CANDIDATES = [
  { label: 'triangular_numbers', insert: '\\operatorname{triangular\\_numbers}', kind: 'collection' },
  { label: 'prime_numbers', insert: '\\operatorname{prime\\_numbers}', kind: 'collection' },
  { label: 'permutations', insert: '\\operatorname{permutations}', kind: 'collection' },
]

// `mi` becomes non-null once ClientOnly mounts its slot (asynchronously, after this component's own mount) —
// `watch` with `immediate` catches it whenever that happens, rather than racing a fixed onMounted/nextTick.
watch(
  mi,
  (el) => {
    if (!el) return
    el.completer = (before) => {
      const m = /[a-zA-Z_]+$/.exec(before)
      const prefix = m ? m[0] : ''
      if (!prefix) return null
      const candidates = CANDIDATES.filter((c) => c.label.startsWith(prefix))
      return candidates.length ? { replaceLen: prefix.length, candidates } : null
    }
  },
  { immediate: true },
)
</script>

## Self-checking

<enumeratio-assert expect="x \in \operatorname{triangular\_numbers}" reveal="always" label="reflects its own latex">
  <enumeratio-math-input latex="x \in \operatorname{triangular\_numbers}"></enumeratio-math-input>
</enumeratio-assert>
