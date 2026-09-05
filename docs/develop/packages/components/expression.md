# `<enumeratio-expression>`

Client-backed. A **per-ring calculator**: it evaluates an expression in a carrier's algebra, reusing the client's
`evaluateExpression` (the same core the explorer's `AlgebraEvaluator` uses). Type into the box, or set `expr` up
front. The grammar is small and total: integer literals, `a/b` (rationals), `ω` (ordinals), `∞` (cardinals),
`i` (Gaussian), `{…}` set literals with `∪`/`∩`, `+ − · ( )`.

Results print in the pretty Lean-style unicode form (`ω`, `ω·2`, `ω^2`, `∞`). The input is lenient — you can type the
plain-ASCII stand-ins `w` for `ω` and `oo` for `∞`, since they're hard to key otherwise; a proper notation picker
(and LaTeX/KaTeX output, which is unicode-friendly too) is a planned follow-up.

Needs a Db via `provideDb()` (the docs set it up globally).

## Attributes

| attribute | type | meaning |
|---|---|---|
| `collection` | string | a collection id; its carrier is resolved from the catalog |
| `carrier` | string | **or** a carrier directly (wins over `collection`) — e.g. `rational_number` |
| `expr` | string | the initial expression (also editable in the box) |
| `modulus` | number | the modulus `m` for `ℤ/mℤ` (`modular_residue`), or the ground `n` for a bounded `finset` |

Emits a composed **`result`** event (`{ value, error }`) and exposes **`.value`** — so
[`<enumeratio-assert>`](/develop/packages/components/assert) can check what it evaluated to.

## Usage

Address by collection (its carrier is looked up) or by carrier directly:

```html
<enumeratio-expression collection="rational_numbers" expr="1/2 + 1/3"></enumeratio-expression>
<enumeratio-expression carrier="rational_number" expr="2 * (1/2 + 1/3)"></enumeratio-expression>
```

<p>
<enumeratio-expression collection="rational_numbers" expr="1/2 + 1/3"></enumeratio-expression>
</p>

Try it — edit the expression (ordinals are non-commutative, so `2 + ω` ≠ `ω + 2`):

<p>
<enumeratio-expression carrier="omega_ordinal" expr="(ω + 1) * (ω + 1)"></enumeratio-expression>
</p>

## Storybook — one carrier per algebra

Each row is the real control wrapped in `<enumeratio-assert>`, so every demo checks itself. `reveal="always"` shows
the live value beside the `✓`.

<enumeratio-assert-summary label="expression demos"></enumeratio-assert-summary>

**ℚ — a field.** Fractions reduce; unlike denominators add.

<p>
<enumeratio-assert expect="5/6" reveal="always" label="1/2 + 1/3">
  <enumeratio-expression carrier="rational_number" expr="1/2 + 1/3"></enumeratio-expression>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="1" reveal="always" label="a number times its inverse">
  <enumeratio-expression carrier="rational_number" expr="(2/3) * (3/2)"></enumeratio-expression>
</enumeratio-assert>
</p>

**Ordinals < ω^ω — a non-commutative semiring.** Left-absorption vs right-survival:

<p>
<enumeratio-assert expect="ω" reveal="always" label="2 + ω (absorbed)">
  <enumeratio-expression carrier="omega_ordinal" expr="2 + ω"></enumeratio-expression>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="ω + 2" reveal="always" label="ω + 2 (survives)">
  <enumeratio-expression carrier="omega_ordinal" expr="ω + 2"></enumeratio-expression>
</enumeratio-assert>
</p>

**Cardinals — ℵ₀-arithmetic.** The `0` annihilator beats ℵ₀:

<p>
<enumeratio-assert expect="0" reveal="always" label="∞ · 0">
  <enumeratio-expression carrier="cardinal" expr="∞ * 0"></enumeratio-expression>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="∞" reveal="always" label="∞ + 5">
  <enumeratio-expression carrier="cardinal" expr="∞ + 5"></enumeratio-expression>
</enumeratio-assert>
</p>

**Gaussian integers ℤ[i] — a commutative ring.** `i² = −1`, and the norm `(a+bi)(a−bi)`:

<p>
<enumeratio-assert expect="-1" reveal="always" label="i * i">
  <enumeratio-expression carrier="gaussian_integer" expr="i * i"></enumeratio-expression>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="13" reveal="always" label="(3+2i)(3-2i)">
  <enumeratio-expression carrier="gaussian_integer" expr="(3 + 2i) * (3 - 2i)"></enumeratio-expression>
</enumeratio-assert>
</p>

**ℤ/5ℤ — modular.** Pass the modulus as `modulus`:

<p>
<enumeratio-assert expect="2" reveal="always" label="3 * 4 (mod 5)">
  <enumeratio-expression carrier="modular_residue" expr="3 * 4" modulus="5"></enumeratio-expression>
</enumeratio-assert>
</p>

**finset — the lattice 𝒫([n]).** `{…}` literals, `∪` (join) / `∩` (meet); `∩` binds tighter than `∪`:

<p>
<enumeratio-assert expect="{1,2,3}" reveal="always" label="union">
  <enumeratio-expression carrier="finset" expr="{1,2} ∪ {2,3}"></enumeratio-expression>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="{1,2,3}" reveal="always" label="∩ binds tighter">
  <enumeratio-expression carrier="finset" expr="{1,2} ∪ {2,3} ∩ {3,4}"></enumeratio-expression>
</enumeratio-assert>
</p>

## Parsing a singleton element

A bare element literal — no operator — is a valid expression too: the control **parses it and renders it back**, so
it doubles as a notation parser / normalizer. `2/4` reduces to `1/2`; `w + 2` is a single ordinal; `{1,2,3}` a single
set:

<p>
<enumeratio-assert expect="1/2" reveal="always" label="2/4 normalizes">
  <enumeratio-expression carrier="rational_number" expr="2/4"></enumeratio-expression>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="3+2i" reveal="always" label="a bare a+bi">
  <enumeratio-expression carrier="gaussian_integer" expr="3 + 2i"></enumeratio-expression>
</enumeratio-assert>
&nbsp;
<enumeratio-assert expect="{1,2,3}" reveal="always" label="a bare set">
  <enumeratio-expression carrier="finset" expr="{1,2,3}"></enumeratio-expression>
</enumeratio-assert>
</p>

## The whole battery

Every worked example in the db, live, is on the **[expression kitchen
sink](/develop/packages/components/expression-examples)** — a page that is itself a full-stack unit-test run.
