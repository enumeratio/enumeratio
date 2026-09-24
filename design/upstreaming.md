# Design: upstreaming to compute-engine

Status: **draft / thinking**. What we have built on top of compute-engine, which parts
could plausibly become compute-engine, what stands in the way, and how to shape the rest
so the question stays cheap to ask later.

Pinned against `@cortex-js/compute-engine` `^0.128.0`.

## 1. Why bother

Roughly seventy heads across a dozen packages, and a good fraction of them are not
enumeratio-specific at all — they are things a general CAS is expected to have and
compute-engine does not yet. `HurwitzZeta`, `LerchPhi`, `ContinuedFraction`,
`IntegerDigits` over a numeral system: none of those are about combinatorics, and carrying
them in a sibling repo is a cost with no upside beyond our own convenience.

The parts that genuinely are ours — the enumeratio catalogue, the diagram-algebra zoo, the
modular flow, Lorenz knots — should stay ours. The point of this document is to keep the
line between the two visible while the code is being written, rather than discovering it
during a port.

## 2. How we extend compute-engine today

Three mechanisms, in increasing order of how much they presume.

**New heads.** `ce.declare(name, { signature, evaluate })`. No friction; most of the
catalogue is this. ~65 heads.

**Replacing a built-in, capturing the native handler.** Probe for the existing definition,
keep a reference, declare a replacement that falls back to it:

```ts
const nativeZeta = ce.box(["Zeta", 2]).operatorDefinition?.evaluate;
```

We do this to `Zeta`, `PolyLog`, `PolyGamma` (widening the domain), `IntegerDigits` and
`FromDigits` (widening the base slot), `Element` (containment against our structures), and
to `Add` / `Multiply` / `Negate` / `Power` / `Divide` / `Conjugate` (the hypercomplex
units). It works, but it is a replacement rather than an extension, and §3 is mostly about
the consequences.

**A provider registry of our own.** `@enumeratio/algebra` exists only because two of our
packages both wanted to answer `Basis`, `AlgebraDimension` and `NonCommutativeMultiply`.
It declares those heads once and lets packages register handlers. It is a workaround for
§3.2, not a design we chose.

## 3. Concerns — what makes this hard today

These are the things worth raising upstream regardless of whether anything is ever ported.

### 3.1 There is no number-type extension point

The hypercomplex units cannot be a number type. The only available seam is to replace every
arithmetic head and recognise subscripted symbols inside it. Two consequences:

- **Canonicalisation happens before evaluation, and it is commutative.** `Multiply` sorts
  its operands, so an anticommuting product has lost its sign before any handler is
  reached. We had to move the ordered product to its own head (`NonCommutativeMultiply`)
  and make native `×` _decline_ a product of two or more distinct anticommuting generators
  rather than answer it wrongly.
- Every arithmetic head has to be wrapped in lockstep, because a multivector that survives
  `Multiply` and then meets an unwrapped `Divide` is an error message.

What would fix it: a way to declare a set of symbols as the generators of an algebra with a
given multiplication rule, and have canonicalisation respect a declared non-commutativity.

### 3.2 `ce.declare` treats extensions and built-ins asymmetrically

Redeclaring a **built-in** head is fine. Redeclaring a head that another **extension**
already declared throws `already declared in this scope`. So two independent libraries can
each extend `Element`, but they cannot both contribute to `Basis`.

That asymmetry is the whole reason `@enumeratio/algebra` exists. What would fix it: a
composable "contribute a handler to this head" API, where handlers are tried in turn and
may decline — which is the shape our registry already has, so the design is not
speculative.

### 3.3 Replacing a definition silently drops the handlers you forget to copy

Redeclaring `Add` lost its `type` handler. Sums widened from `number` to `value`, and
`Conjugate(1 + x)` broke — nowhere near the change. Our `wrap()` now carries `signature`,
`type`, `sgn`, `complexity`, `commutative`, `commutativeOrder`, `associative`,
`idempotent`, `involution` and `broadcastable` across, and that list is empirical: it grew
each time something broke.

What would fix it: an `extend`/`override` API that starts from the existing definition, so
the default is "keep everything" rather than "lose everything".

Related: `signature` must be passed as the definition **object**. Stringifying it loses
generic `where` clauses.

### 3.4 Smaller sharp edges

- **A head's returned expression is not re-evaluated.** A handler that builds
  `["Add", …]` hands back something still needing `.evaluate()`; substitution into a
  returned polynomial needed `.evaluate().evaluate()`.
- **`.symbol`, `.ops` and `.string` live on narrowed interfaces**, not on `Expression`, so
  every reader casts structurally (`(expr as { symbol?: unknown }).symbol`). Three packages
  carry the same helper.
- **String literals do not round-trip predictably.** `["String", "s0"]` canonicalises to
  `'"s0"'` — single quotes for the literal, inner double quotes because it is non-numeric —
  while `["String", "2"]` becomes `'2'`. A naive reader works on numeric labels and fails
  silently on every other one. That cost a real debugging cycle in the group algebras.
- **Canonical `Add` ordering** is not the order anyone writes, which makes pinned
  expectations in tests and reference entries fragile unless they are dumped rather than
  hand-written.

### 3.5 Naming is already incoherent upstream, and there is no stated rule

Verified against 0.128.0 rather than assumed:

| Call              | compute-engine               | Wolfram      |
| ----------------- | ---------------------------- | ------------ |
| `Stirling(6, 3)`  | **90** — native, second kind | `StirlingS2` |
| `StirlingS1(6,3)` | **−225** — native, signed    | `StirlingS1` |
| `StirlingS2(6,3)` | **does not resolve**         | second kind  |

So compute-engine carries one half of Wolfram's pair under Wolfram's name and the
same convention, and the other half under a different name — leaving the obvious
spelling for the missing one free. `StirlingS1` therefore needs no upstreaming: it is
already there. It is useful here as the clearest evidence that the naming question needs
answering before any of §4 is offered.

The narrow fix is `StirlingS2` for the second kind, keeping `Stirling` as an alias since it
is public surface. The general question is the one worth asking: **when does
compute-engine use a Wolfram name?** We hit it on every head we add and currently answer it
by taste — `PowerModList` was chosen over a bespoke `SplitUnits` on exactly this reasoning,
and it made the head more flexible as well as more portable, but that was a judgement call,
not a rule. A stated policy would settle Tier 1 and Tier 2 almost entirely, since both are
mostly "the Wolfram function compute-engine does not have yet".

### 3.6 `LibraryDefinition` exists, but nothing can register one

compute-engine has the concept. `types-definitions.d.ts` declares

```ts
interface LibraryDefinition {
  name: string;
  requires?: string[];
  definitions?: SymbolDefinitions | SymbolDefinitions[];
}
```

with `assertLibraryDefinitionContract` next to it and `bootstrapLibraries` on the startup
coordinator. Everything needed to say "these forty heads are one library, and it depends on
that one" is already modelled.

What is missing is a door. In 0.128.0's exported surface there is no method on
`ComputeEngine` to register a `LibraryDefinition`, so every one of our ~70 heads goes in
through `ce.declare`, one at a time, with no library identity attached. The consequence is
not cosmetic:

- **Provenance has to be reconstructed by experiment.** `packages/reference/scripts/` builds
  a bare engine and a declared one and diffs them, because there is no way to ask an engine
  which library a head came from. If heads carried a library, the ledger would be a lookup.
- **Epsil spellings stop at the standard library.** `epsilLibraryNames()` is documented as
  excluding "caller-authored libraries and names declared later with `ce.declare`". So a
  head we add is second-class in the surface language by construction — `sin` has a
  spelling, `hurwitzZeta` cannot.
- **It is the same wound as §3.2.** Two extensions cannot contribute to one head, and no
  extension can name itself. Both are the absence of a composition story, and a public
  library API would likely close both.

This is the piece to raise first, because it costs us the most and appears to be the least
work upstream: the type is written, the contract assertion is written, the bootstrap path
exists. What is missing is the public call.

### 3.7 Traditional notation works both ways — but only at construction time

Verified against 0.128.0, not assumed:

```ts
const ce = new ComputeEngine({
  latexSyntax: new LatexSyntax({
    dictionary: [
      ...LATEX_DICTIONARY,
      { kind: "function", name: "HurwitzZeta", latexTrigger: "\\zeta_H" },
    ],
  }),
});
ce.parse("\\zeta_H(2, 1)") // ["HurwitzZeta", 2, 1]
  .evaluate(); // π²/6
ce.box(["HurwitzZeta", 2, 1]).latex; // "\\zeta_H(2, 1)"
```

Parse, evaluate and serialize, all three. So conventional notation for our heads — $\zeta_H$,
$\left\{{n\atop k}\right\}$, $\varphi(n)$ — is not a missing capability and needs no fork.

What is wrong is WHERE it has to happen. The dictionary is a **constructor option** that
**replaces** the default, so:

- **A library cannot contribute notation.** By the time `declareAnalytic(ce)` runs the
  engine exists and its dictionary is fixed. Notation has to be assembled centrally, by
  whoever calls `new ComputeEngine`, from knowledge that belongs to the libraries.
- **Two libraries cannot both add entries.** Each would have to know about the other's, or
  a third party composes `[...LATEX_DICTIONARY, ...a, ...b]` by hand.

That is why `packages/notatio/src/traditional.ts` exists at all: an output-only side table
of fifteen heads, walked by hand, because the input direction is closed off by the
architecture rather than absent from the API. It is also the same wound as §3.2 and §3.6 —
extensions cannot share a head, cannot name themselves, and cannot contribute notation.
Three symptoms, one missing composition story.

**The ask**: notation contributable per library at declare time, merged rather than
replacing. Concretely, `LibraryDefinition` gaining a `latex?: LatexDictionaryEntry[]`
alongside its `definitions`, so that registering a library brings its notation with it.
That single change would close §3.6 and §3.7 together, and it is the one most worth
prototyping on a fork to put a PR behind.

Since writing that, this has stopped being cosmetic. `@enumeratio/catalog` needs the `ƒ`
trigger for its resource resolver, and cannot contribute it — so the namespace strategy for
the whole enumeratio catalog is gated on exactly this gap, not on a nicety about $\zeta_H$.
See [namespaces.md](./namespaces.md) §3.2.

### 3.8 An imaginary part is a double, and nothing can carry a wider one

`NumericValue` is `{ decimal: BigNum, im: number }`. The real part is arbitrary precision;
the imaginary part is a JavaScript double. This is not "complex is two doubles" — it is
worse, because it is asymmetric and silent:

```
ce.precision = 40
ce.box(['Complex', ['Rational', 1, 3], ['Rational', 1, 7]]).N()
// → ["Complex", {num: "0.3333333333333333333333333333333333333333"}, 0.14285714285714285]
//                ^ 40 digits                                          ^ 17, truncated on the way in
```

The truncation happens at construction, before any evaluation, so there is no precision to
recover downstream. Every complex-valued result in the engine is capped at ~17 digits in its
imaginary part regardless of `ce.precision`, and `Zeta`, `Gamma`, `PolyGamma` and the rest
simply decline rather than return a complex bignum.

The arithmetic underneath is not the problem. Carrying a complex value as a **pair of real
expressions** and writing the algebra in real operations keeps full precision throughout —
we ran Euler–Maclaurin for $\zeta(s, a)$ that way at complex $s$ and got 37–40 correct
digits against mpmath at `precision = 40`, in under 200 ms:

```
ζ(2+3i, 1)  re 0.798021985146275720622294500724812686025…   (mpmath agrees to 39 digits)
            im −0.113744308052938500215913365857315075570…  (agrees to 38)
ζ(½+14i, 1) re 0.0222411426099935892462131992039686263…     (agrees to 37)
```

An unevaluated symbolic carrier also survives — `Add(a, I·b)` held unevaluated, a `List` of
two bignums, or a head declared with no `evaluate` handler all keep both parts at full
width. So the capability exists; what is missing is a **number type** to put it in. The
moment the pair becomes a `Complex`, the imaginary half is gone.

**The ask**: `NumericValue.im` widened to `BigNum`, so a complex literal is symmetric in its
two parts. Failing that, any public constructor that accepts two bignums and a reader that
returns them. Without it, arbitrary-precision complex analysis is reachable only by refusing
to use the engine's own complex type — which is the same shape of problem as §3.1, where the
fix is also "let a number be something the engine does not already know how to be".

### 3.9 `N` does not take a precision, and a symbol cannot own its own numeric algorithm

An `evaluate` handler is told _whether_ a number is wanted (`options.numericApproximation`,
a boolean) but not _how many digits_. The requested precision is ambient engine state, so a
handler that wants to answer at 200 digits has to read `ce.precision` off the engine it was
handed and hope nothing changed it. That is workable for us, because we own the engine — it
is not workable for a library author who wants their symbol to answer `N[f[x], 200]`
correctly wherever it is used.

Wolfram settled this a long time ago and the shape is worth copying. There, a symbol owns
every facet of itself, and each facet is a rule attached to the symbol in the same language:

| Wolfram                   | What it carries                              | compute-engine 0.128                                                                                      |
| ------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DownValues`              | the defining rewrite, `f[x_] := …`           | `evaluate` — but an expression body ALWAYS unfolds, so a head cannot both define itself and hold its form |
| `NValues`                 | `N[f[x_], p_] := …` — **`p` is a parameter** | nothing; precision is ambient                                                                             |
| `Derivative[1][f] ^= …`   | the derivative                               | nothing public; the table is a private const                                                              |
| `UpValues` (`f /: …`)     | a rule attached to a symbol you do NOT own   | nothing — this is §3.2 again                                                                              |
| `Attributes`              | `Listable`, `NumericFunction`, `Orderless`   | partly (`broadcastable`, `lazy`)                                                                          |
| `FunctionCompile` + types | compiled targets                             | `compile` ✓ (the one facet CE does well)                                                                  |
| contexts / paclets        | packaging a set of symbols with their rules  | nothing — §3.6                                                                                            |

`NumericFunction` plus `NValues` is precisely the missing pair: it is how a third party makes
their own function participate in arbitrary-precision numerics, and `UpValues` is how they
contribute a derivative or a simplification for a head someone else declared.

The absence shows up directly in our own tree. `@enumeratio/analytic` has to scatter one
symbol across four files — `definitions.ts` (the formal definition), `precise.ts` (the
finite precision-parameterized evaluator), `derivatives.ts` (the derivative table, attached
by mutating `Derivative`'s definition in place), and `hurwitz-zeta.ts` (declare + evaluate +
compile) — not because those are four different concerns worth separating, but because CE
offers four different mechanisms and none of them is "here is everything this symbol is".

**The ask**, in order of usefulness:

1. `evaluate` handlers receive the requested precision, not just a boolean.
2. A `definition` facet that is an expression but does NOT auto-unfold under `evaluate` — so
   a head can say what it is and still hold its form (see namespaces.md §6).
3. A public derivative facet on `OperatorDefinition`.
4. `UpValues`-equivalent: contribute a facet to a head you did not declare. This subsumes
   §3.2 and would let the derivative and the definition arrive from separate packages.

## 4. The drop-in menu

Tiered by how much compute-engine would have to change, not by how much we like them.

### Tier 1 — pure additions, with a Wolfram spelling already

Nothing structural; these are functions compute-engine lacks. Each already ships with an
independent oracle, which is the thing a maintainer actually needs.

| What                                         | Shape                                                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HurwitzZeta(s, a)`, and `Zeta(s, a)`        | the two-argument `Zeta` is Wolfram's spelling; we currently _replace_ `Zeta` to add the second slot, which upstream would just be a wider signature |
| `LerchPhi(z, s, a)`                          | pure addition                                                                                                                                       |
| `PolyLog`, `PolyGamma` past the native range | we replace both and fall back to the native handler; upstream this is an extension of the existing implementation, not a new head                   |
| `PowerModList(a, b, m)`                      | Wolfram name; we added it _instead of_ a bespoke head, on the same reasoning as this document                                                       |

Check before offering: some of what we document is already upstream, and the audit is now
automated — see §6.1. It has found two so far. `StirlingS1` is native (§3.5) and our entry
documents compute-engine's head. `ContinuedFraction` and `FromContinuedFraction` are native
too, and worse: compute-engine's two-argument form is Wolfram's `ContinuedFraction[x, n]`
("the first n terms"), while ours meant `(numerator, denominator)`. We had silently given
an existing signature a different meaning — `ContinuedFraction(355, 113)` returned our
expansion of 355/113 instead of 113 terms of the integer 355. Both redeclarations are gone;
compute-engine's are complete, covering rationals, floats and a term count.

### Tier 2 — widening an argument slot on a head that already exists

The cleanest case, because it adds no head at all and there is Wolfram precedent
(`IntegerDigits[n, MixedRadix[…]]`).

`IntegerDigits(n, system)` and `FromDigits(digits, system)` where the base slot takes a
whole numeral **system**: `MixedRadix`, `Factoradic`, `PrimorialRadix`, `BalancedRadix(b)`,
`NegativeRadix(b)`, `BijectiveRadix(k)`, `Zeckendorf`, `Ostrowski([…])`,
`CombinatorialSystem(k)`, `ResidueSystem([…])`. An integer base still goes to the native
handler untouched — `IntegerDigits(10, 2)` means exactly what it meant.

Of these, three are not "base-b with a twist" and are the argument for the widening:
Zeckendorf and Ostrowski constrain digits by a _forbidden pattern_ instead of a per-place
bound, the residue system has _no place values at all_, and two of them represent negative
integers with _no sign_.

### Tier 3 — wants a real extension point (Hypercomplex / Clifford)

This is the one worth designing towards rather than writing off. What it needs:

1. **Generators as data.** A family declared by `(square, commutation)` per generator — one
   representation already covers multicomplex, split-complex, dual, Clifford and Grassmann.
   That table is the whole mathematical content and it is small.
2. **A product that canonicalisation will not reorder.** See §3.1.
3. **Type integration**, so `Element(z, CliffordAlgebra(3))` and assumptions work.

Our side of the bargain is to keep (1) separable from (2) and (3) — see §6, where
hypercomplex currently fails that test.

### Tier 4 — stays ours

The enumeratio catalogue, the diagram-algebra zoo, Hecke, incidence, quiver, Hopf, group
algebras, the modular group, Lorenz knots. Domain libraries, correctly shaped as
extensions. The only thing we want from upstream for these is §3.2, so they can share heads
without a private registry.

## 5. What we would be asking compute-engine for

In rough priority order, and each one is independently useful:

1. A composable way for two extensions to contribute to one head (§3.2).
2. `extend` rather than `declare`-and-replace, so handlers are not silently lost (§3.3).
3. A precision argument on `evaluate`, and a per-symbol numeric facet (§3.9).
4. A `BigNum` imaginary part, so complex values can be arbitrary precision at all (§3.8).
5. Declared non-commutativity that canonicalisation respects (§3.1).
6. `.symbol` / `.ops` / `.string` on the public expression type (§3.4).

## 6. How to keep things drop-in-able

One structural rule, and it is already the house pattern for most packages: **the
mathematics lives in a pure-TS module that does not import compute-engine, and `declare.ts`
is the only file that knows compute-engine exists.** A port is then "rewrite one adapter
file", not "disentangle a library".

Where that holds today:

| Package                                                                           | Files importing CE |
| --------------------------------------------------------------------------------- | ------------------ |
| `modular`, `braid`, `numerals`, `hopf`, `diagram`, and the other algebra packages | 1 (`declare.ts`)   |
| `hypercomplex`                                                                    | **4 of 7**         |
| `analytic`                                                                        | **4 of 9**         |

The two packages with the strongest case for upstreaming are exactly the two that fail the
rule. `analytic` computes on `BoxedExpression` directly inside `hurwitz-zeta.ts`,
`polylog.ts` and `polygamma.ts`; `hypercomplex` spreads it across `algebra.ts`,
`boxed.ts` and `multivector.ts`. Neither is hard to fix and neither is urgent, but if
either is ever offered upstream, this is the prerequisite, so it is worth doing while the
reasoning is fresh rather than under time pressure.

### 6.1 The provenance ledger

`packages/reference/src/provenance.ts` computes, rather than declares, where each head came
from: build a **bare** engine and one with our libraries declared, and see what the two do.

- **`compute-engine`** — the bare engine resolves it and we change nothing (99 heads).
- **`extension`** — the bare engine has never heard of it (34).
- **`override`** — native, and we change some result (6: `Element`, `FromDigits`,
  `IntegerDigits`, `Norm`, `PolyLog`, `Zeta`).

Four tests hold it (`packages/reference/tests/provenance.test.ts`):

1. Every entry's declared `library` agrees with the computed answer. This is the
   `StirlingS1` check, run over the whole catalogue.
2. The overridden set is pinned in **both** directions — a new name means an override
   nobody decided on, a missing one means an override that has silently stopped working.
3. A hand-written corpus of **plain** compute-engine expressions over every head we replace
   — arithmetic, `Element`, the special functions, digits, `Expand`/`Simplify`/`Solve`/`D`
   — must evaluate identically on both engines. This is the net under the overrides: `Add`
   once lost its `type` handler to a redeclaration and broke `Conjugate(1 + x)` nowhere near
   the change.
4. Nothing in the catalogue's own examples diverges except on a head in that pinned set.

### 6.2 What the other systems already have

`scripts/collect-coverage.ts` asks them, rather than guessing from our own tables. Of 143
documented heads: **88 exist in Wolfram, 52 in SymPy, 34 in mpmath**, and 47 in none.

The first attempt read the answer off the transpiler's `HEADS` map and got it backwards on
exactly the heads that matter. `HEADS` lists **renames** — `Stirling` → `StirlingS2`.
`HurwitzZeta`, `LerchPhi` and `PowerModList` are absent from it because the name is already
right and `toWolfram` passes it through, not because Wolfram lacks them. So the data now
keeps the two apart: `wolframAlias` is the rename, `elsewhere` is what a kernel says.

That splits our 34 extension heads cleanly, and the split is now derived rather than
argued:

| Our head                 | Exists in              |
| ------------------------ | ---------------------- |
| `LerchPhi`               | Wolfram, SymPy, mpmath |
| `HurwitzZeta`            | Wolfram                |
| `PowerModList`           | Wolfram                |
| `NonCommutativeMultiply` | Wolfram                |
| `Coproduct`              | Wolfram                |

The other 29 are domain objects no general system carries — Tier 4, confirmed. And
`NonCommutativeMultiply` appearing there is a small vindication: we picked that name for
the ordered product on our own reasoning, and it is Wolfram's name for the same thing.

A test pins the novel list, so adding a head fails until someone has asked whether one of
these systems already has it — which is the habit this is really for, more than the table.

On the systems themselves, since the question keeps coming up:

- **numpy** is a compile target for numeric evaluation, not an oracle. It has no zeta;
  `scipy.special.zeta` is the Hurwitz function restricted to real $s > 1$.
- **mpmath** is the arbitrary-precision numeric oracle, already wired in
  `analytic/scripts/validate-mpmath.ts`, and it is _better_ than Wolfram on some branches —
  it is correct at negative-integer $s$ where `N[HurwitzZeta[-n, a]]` is not.
- **SymPy** is the symbolic/exact lane, and is a different question from mpmath rather than
  a superset of it.
- **Sage** bundles both, so a Sage lane would subsume them at the cost of a much heavier
  dependency for no extra coverage. We call mpmath and SymPy directly.

Still not automated: comparing **values** head-by-head against SymPy and mpmath the way
`wolfram/scripts/validate-reference.ts` already does for Wolfram. That validator works —
542 examples compared, 393 agree, 57 disagree, 92 Wolfram-unsupported — but its
"unsupported" detection is leaky, counting our own heads as disagreements when Wolfram
simply leaves them symbolic, so the 57 needs triage before the number means anything.

### 6.3 Rules

Three lesser rules:

- **Use the Wolfram spelling when one exists.** `PowerModList` replaced a bespoke
  `SplitUnits` head for exactly this reason, and the result was more flexible as well as
  more portable.
- **Never invent a head where widening an argument slot would do.** Tier 2 is the model.
- **Every candidate ships with an independent oracle.** Not a regression test — a second
  computation of the same number by different means: Dedekind sums against reciprocity,
  Burau against the closed-form torus polynomial, Ostrowski against Zeckendorf. That is
  what makes a contribution reviewable by someone who did not write it.

## 7. Sequencing, and what is still open

**Upstreaming is wanted from our side** — for much of §4, not all of it. What is not yet
known is whether it is wanted by compute-engine, and that question is deliberately not being
asked yet.

The reason is that it is a much better conversation to have from a position of
demonstration than description. Before approaching upstream:

1. **The repo goes to GitHub**, so there is something to link to and read.
2. **The docs are hosted on enumeratio.dev**, so every head in §4 has a page where it runs.

Then the pitch is a working implementation rather than a proposal. That matters most for
the analytic functions, where the value is visual and prose does not carry it: the GPU
phase portraits for ζ, PolyLog and LerchPhi are the argument for those heads in a way no
signature ever will be. And the GPU path is not a parallel universe — `gpu-eval.ts`
compiles through **compute-engine's own WGSL target**
(`@cortex-js/compute-engine/compile`), with our special-function heads emitting calls into
`zetaWGSL`. So the ask there is to extend something compute-engine already has, which is a
far easier case to make with a running portrait than with a paragraph.

Still genuinely open:

- **Extension library or upstream?** If the answer is a published extension library with a
  documented seam, §5 becomes a request for stable surface rather than for features. Either
  way §5 items 1–3 are needed.
- **Granularity.** One package (`@enumeratio/compute-engine-extras`) or several? Tier 1 and
  Tier 2 share no dependency.
- **Numeric policy.** Our Tier 1 functions deliberately go past compute-engine's native
  range. Do they keep that on a port, or match whatever the house policy is?
- **The naming rule** (§3.5) — the one question that would unblock the most at once.
- **Version policy.** We pin `^0.128.0` and replace definitions by probing
  `operatorDefinition`. Any upstream conversation should establish which of those probes
  are supported surface and which are us reaching through a window.

## 8. Ready to send

Three findings that need no design, only a pull request — kept here until they go, so the
evidence is in one place.

**The `wikidata` field is mostly wrong.** `packages/reference/scripts/audit-wikidata.ts`
fetches every id the engine declares and compares the item's label with the symbol. Of 101
ids, 3 do not resolve and 38 resolve to something unrelated: `PlanckConstant` is Q524
(Mount Vesuvius), `AiryAi` is Q403629 (Mustafa al-Nahhas), `EllipticK` is Q1080993 (a
Donna Summer album), `Beta` is Q189062 (states with nuclear weapons). The corrected ids,
each looked up by name and confirmed against the item, are `WIKIDATA_FIXES` in
`packages/reference/src/crosswalk/curated.ts` — forty-one `name: "Q…"` pairs, which is the
whole patch. The ids that look wrong to the heuristic but are right (`Divide` → "division",
`Nand` → "Sheffer stroke") are `WIKIDATA_CONFIRMED`, and are not part of it.

**`EllipticE` is four digits accurate at complex modulus.** At m = 0.57 + 0.23i the engine
gives 1.3249212925969696 − 0.11971669991852416i; mpmath gives 1.32480777269705 −
0.119729445459512i, as does the engine's own `Hypergeometric2F1` on E(m) = (π/2)·₂F₁(−½, ½;
1; m). The two-argument `EllipticE(π/2, m)` is right, so only the one-argument reduction is
wrong — and native `EllipticE(φ, m)` for φ outside [−π/2, π/2] inherits it through its
quasi-periodic reduction (DLMF 19.2.10). Patched in place locally
(`packages/analytic/src/elliptic.ts`); `verify-fungrim.ts` reproduces it.

**`Hypergeometric2F1` is off by 5.2e-6 relative at complex argument** — Fungrim 16d2e1 at
m = 1.17 + 0.45i, against mpmath's `hyp2f1`.

**Three compiled Fungrim rules in `identities` are wrong** (checked against mpmath):

- `42eb01`: Fungrim's `1 − x²` became `x² − 1`, so the rule asserts
  `(x²−1)U_{n−1}² + T_n² = 1`; at n = 1, x = 2 the left side is 7.
- `4c7aeb`: off by one — `sin(x)·U_n(cos x) = sin((n+1)x)`, not `sin(n·x)`.
- `5f09f4`: the replace side `ChebyshevU(2n, x)` does not equal
  `U_{n−1}(2x²−1) + T_n(2x²−1)`; another index error.

**`Zeta` serializes as `\Zeta`.** `ce.box(["Zeta", 3]).latex` is `\Zeta(3)` — an uppercase
command that is not LaTeX's (the Riemann zeta is `\zeta`; there is no `\Zeta`, since
capital zeta is a Z). MathLive renders it as a roman **Z**, so a cell whose notatio is
`Zeta(s)` shows `Z(s)` in its field. The parser accepts both `\zeta(3)` and `\Zeta(3)` as
`["Zeta", 3]`, so the fix is one character in the serializer's LaTeX dictionary entry, and
round-trips. Seen once the editable components started handing the engine's own LaTeX to
the field (`packages/notatio/src/source.ts`); `Gamma` → `\Gamma` is right, this one is
not.
