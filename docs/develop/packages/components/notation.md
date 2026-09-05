# `<enumeratio-notation>`

Client-backed. Resolves **one element's rendered notation** from the db: `construct(collection, {size:n})` →
`.window(rank, 1, {medium})` → the element's `element` string. Address by `(collection, n, rank)`; `medium` picks the
textual form.

Needs a Db provided once via the client's `provideDb()` — the docs set that up globally, so the demos below are live.

## Attributes

| attribute | type | meaning |
|---|---|---|
| `collection` | string | the collection id, e.g. `permutations` |
| `n` | number | the size parameter (the fiber) |
| `rank` | number | the element's rank within the fiber |
| `medium` | `unicode` \| `ascii` \| `latex` | textual form (default `unicode`; `latex` shows raw markup for now) |

Emits a composed **`result`** event (`{ value, error }`) and exposes **`.value`** — so
[`<enumeratio-assert>`](/develop/packages/components/assert) can check it.

## Usage

```html
<enumeratio-notation collection="permutations" n="4" rank="5"></enumeratio-notation>
```

Live — the 6th permutation of `[4]`:
<enumeratio-notation collection="permutations" n="4" rank="5"></enumeratio-notation>

## Self-checking demos

Wrapped in `<enumeratio-assert>`, each demo is also a unit test — green when the resolved notation matches `expect`,
red (with expected-vs-actual) when it doesn't.

<enumeratio-assert-summary label="notation checks"></enumeratio-assert-summary>

Binary words of length 3 — rank 0 is all-zero, rank 7 all-one:

```html
<enumeratio-assert expect="000">
  <enumeratio-notation collection="binary_words" n="3" rank="0"></enumeratio-notation>
</enumeratio-assert>
```

<p>
<enumeratio-assert expect="000" reveal="always" label="binary_words 3·0">
  <enumeratio-notation collection="binary_words" n="3" rank="0"></enumeratio-notation>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="111" reveal="always" label="binary_words 3·7">
  <enumeratio-notation collection="binary_words" n="3" rank="7"></enumeratio-notation>
</enumeratio-assert>
</p>

Partitions of 6, and the identity permutation:

<p>
<enumeratio-assert expect="4+2" reveal="always" label="integer_partitions 6·2">
  <enumeratio-notation collection="integer_partitions" n="6" rank="2"></enumeratio-notation>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="1234" reveal="always" label="permutations 4·0">
  <enumeratio-notation collection="permutations" n="4" rank="0"></enumeratio-notation>
</enumeratio-assert>
</p>

And a deliberately wrong expectation, to show a **failing** assertion (rank 0 of `dyck_paths` is `UUUDDD`, not
`UDUDUD`):

<p>
<enumeratio-assert expect="UDUDUD" reveal="always" label="(intentionally wrong)"
  message="rank 0 is the all-up-then-all-down path">
  <enumeratio-notation collection="dyck_paths" n="3" rank="0"></enumeratio-notation>
</enumeratio-assert>
</p>
