# Design: namespaces, resources, and the shape of a 1500-name catalog

Status: **§1–§5 are the argument, §6 is history plus what stands, §8 is current.** Open
questions moved to design/speculative/namespaces.md. Counts in this file are as of the day they
were written; anything a test pins is cited by the test rather than repeated (see
[roadmap.md](./roadmap.md) §1 for the rule).

Companion to [upstreaming.md](./upstreaming.md). That document asks what compute-engine
would have to change for our heads to be droppable upstream. This one asks the question
that comes first: **which of our names should be heads at all.**

The forcing problem is enumeratio. Subsuming it means bringing across collections, carrier
domains, stats, maps and aggregates — and the naive reading of that is "declare a symbol for
each", which is somewhere between implausible and hostile. It is also, on the measurements
below, the wrong reading.

## 1. What is actually there

Measured against the live catalog (`bootCore('all')`, every pack loaded), not estimated:

|              |   count |                                                                                   |
| ------------ | ------: | --------------------------------------------------------------------------------- |
| collections  | **282** | `integer_partitions`, `weak_compositions_into_k_parts`, `carlitz_compositions`, … |
| carriers     |  **87** | `integer_partition`, `permutation`, `dyck_path`, `set_partition`, …               |
| stat _rows_  |    1053 | one per (collection, stat)                                                        |
| stat _names_ | **242** | `major_index`, `big_omega`, `binary_weight`, …                                    |
| map _rows_   |     115 | 98 carrier-scoped, 17 collection-scoped                                           |
| map _names_  |  **85** | `to_permutation`, `rsk`, …                                                        |

The gap between rows and names is the whole story, so it is worth making concrete:

```
big_omega       90 collections, but only 2 carriers  (IntegerFactorization, Numeric)
divisor_count   90 collections
binary_weight   89 collections
major_index      3 collections, 3 carriers  — dyck_paths, permutations, standard_tableaux
                                              (title "Major index" on all three)
```

**A stat is not 1051 names. It is 242 names.** Two distinct things collapse those rows, and
they want different mechanisms:

- **Carrier scoping does most of the work.** `big_omega` is one function on a numeric carrier;
  the ninety rows are ninety _collections over that carrier_ inheriting it, not ninety
  definitions. 189 of the 242 stat names live on exactly one carrier — for these the row
  count is pure inheritance, and scoping the definition to the carrier removes it entirely.
- **Genuine overloading covers the rest.** 53 stat names are defined on more than one carrier
  (`major_index` on three; the widest on eleven). These are one identity with several
  implementations resolved by argument type — the Postgres model, and the case that actually
  needs a domain-keyed signature.

So the pressure is much smaller than 1051, and most of what remains is inheritance rather
than overload resolution.

## 2. The decomposition

So the catalog is not one undifferentiated pile of ~1500 names. It is three populations with
genuinely different shapes, and they want three different mechanisms.

### 2.1 Carriers — declare them, all 86

Carriers are the small closed vocabulary that everything else is typed _by_. Collections
return them; stats and maps are defined on them; restricted collections return
domain-restricted versions of them.

They must be real declared symbols, not resolved strings. If `IntegerComposition` is only
reachable as `ƒ("IntegerComposition")`, then every type annotation, every assumption, every
membership test routes through a string literal — which stringly-types the type system, the
exact opposite of the nominal-vs-structural machinery that makes the domain worth having.
The point of `SetPartitions` returning an actual set-partition domain value is that
assumptions fire and a constructed set partition is distinguishable from something merely
structurally identical to one. A string can't carry that.

86 is comfortable. It is smaller than the ~150 compute-engine heads already tracked in the
provenance ledger.

### 2.2 Stats and maps — overloads, not namespace pressure

242 + 84 = 326 heads, defined on carriers rather than on collections. These do not need
namespacing. They need two things neither of which is a namespace:

1. **Definitions scoped to the carrier**, so a collection over that carrier inherits them.
   This alone accounts for 189 of the 242 stat names.
2. **A domain-keyed signature** for the 53 that are genuinely multi-carrier — already on the
   upstream question pile (§3.5 of upstreaming.md, and the `Equal/2`-is-not-a-signature
   objection): arity cannot distinguish `major_index(permutation)` from
   `major_index(dyck_path)`, and it should not have to.

Note `base_map.scope` already carries `'carrier' | 'collection'` — 96 of the 113 map rows are
carrier-scoped. enumeratio has been modelling this distinction the whole time; we would be
importing a model, not inventing one.

### 2.3 Collections — the genuinely open tail

280, growing, individually low-notation, and mechanically derived. This is the population
that wants a resolver rather than a declaration, and it is the _only_ one.

### 2.4 What actually computes today

Resolving a name and being able to evaluate it are different things. The numbers here go
stale within weeks, so this section says where each one lives rather than restating it;
a test pins each, and `design/roadmap.md` §1 is the index of the lists.

- **Carriers**: all 86 declared as domains (`packages/symbols/combinatorics/domains/src/domain-data.ts`).
- **Statistics**: every catalog statistic on the four covered carriers (Permutation,
  IntegerPartition, DyckPath, SetPartition) is defined, native, or a cardinality —
  `packages/symbols/combinatorics/statistics/tests/coverage.test.ts` refuses anything else, and the frontier
  (`src/frontier.ts`) is **empty** as of September 2026. The other carriers are not claimed.
- **Maps**: `packages/symbols/combinatorics/domains/src/map.ts` defines them; `src/frontier-maps.ts` lists the two
  the catalog has that are not built, with the reason.
- **Collections**: the tail — a few dozen of the catalog's 280 have kernels
  (`packages/symbols/combinatorics/collections`). This is the number that matters for sequencing.

A resolver that resolves 280 collection names and can evaluate a fraction of them is still
worth having, because resolution carries the carrier, the grade axes, the title and the
overload set — enough to document, search, type-check and cross-link a name whose kernel
does not exist yet. So **the namespace question and the kernel question are independent**,
and the namespace one is nearly free while the kernel one is most of the collections.

A resource that resolves without a kernel stays symbolic rather than erroring. That is
deliberate: it is a real name with real metadata that this engine cannot evaluate, and
holding is the honest report.

## 3. The resolver

Wolfram's shape, near enough:

```wl
ResourceFunction["HadamardGamma"][x]
```

One head, a string identifier, resolved through a registry into a function value that then
applies. One head covers every arity and kind, because the resolution is data.

### 3.1 What compute-engine can already do

Verified against 0.128.0, not assumed:

```ts
ce.box([["Resource", "'Perms'"], 3])
// ["Apply", ["Resource", "'Perms'"], 3]      — nested head canonicalises to Apply

ce.declare("Resource", { signature: "(string) -> function", evaluate: … })
ce.box([["Resource", "'x'"], 21]).evaluate()
// 42                                         — resolve-then-apply evaluates today
```

So the curried shape works at the MathJSON layer with no machinery at all. It does **not**
parse from LaTeX (`ce.parse("f(x)(3)")` gives `["Multiply", 3, "f", "x"]`), so the typed
spelling stays flat: `ƒ("WeakCompositions", 5)`.

### 3.2 Late declaration, and why the parse tree is repairable

The first version of this document claimed static analysis could not work for LaTeX input,
because an unknown name is demoted to a multiplication operand at parse time and declaring
it afterwards cannot repair the tree. **That was wrong, and the way it is wrong is the most
useful thing in this document.**

Three separate facts, all measured:

```ts
// 1. A boxed expression DOES pick up a later declaration.
const b = ce.box(["LateHead", 3]);        // LateHead undeclared
ce.declare("LateHead", …);
b.evaluate();                              // 30

// 2. Multi-argument application already parses undeclared — the comma defeats Multiply.
ce.parse("\\operatorname{Foo}(3,4)");       // ["Foo", 3, 4]

// 3. The ambiguous unary case keeps its structure BEFORE canonicalisation.
ce.parse("\\operatorname{Foo}(3)", { canonical: false });
// ["InvisibleOperator", "Foo", ["Delimiter", 3]]
ce.parse("\\operatorname{Foo}(3)");         // ["Multiply", 3, "Foo"]  — canonical form commits
```

Only the **unary** application of an **unknown** name is ambiguous at all, and even there
the information survives: `InvisibleOperator` is exactly the repairable juxtaposition node,
and it is _canonicalisation_, not parsing, that throws the alternative away.

That makes the whole pipeline work on the AST, with no source-text lexer:

```ts
const raw = ce.parse(src, { canonical: false });
// walk for ["InvisibleOperator", <symbol>, ["Delimiter", …]]
// declare the candidates the registry knows
ce.box(raw.json); // re-canonicalises the SAME tree, now correctly
```

End to end on `\operatorname{LateHead}(3) + \operatorname{Other}(2) + a(b+c)`, with only
`LateHead` and `Other` in the registry:

```
raw        ["Add",["InvisibleOperator","LateHead",["Delimiter",3]],
                  ["InvisibleOperator","Other",["Delimiter",2]],
                  ["InvisibleOperator","a",["Delimiter",["Add","b","c"]]]]
candidates LateHead, Other, a
repaired   ["Add",["Multiply","a",["Add","b","c"]],["Other",2],["LateHead",3]]
evaluate   a * (b + c) + 50
```

`a(b+c)` correctly stays a multiplication, because `a` is not a name we claim. The registry
is what disambiguates, which is the right place for that decision to live.

**This is what lets the `Resource(…)` wrapper go away.** §3 introduced it as one head
standing in for a whole catalog, and it is still the right fallback for a name you want to
address without installing. But if unknown names can be discovered in the tree and declared
before canonicalisation, then the ordinary spelling is just the name — `CarlitzCompositions(4)`
— and the resolver becomes an implementation detail of the loading step rather than something
a reader has to type. Direct injection into the global namespace, on demand. `Resource` then
survives only for the case it is actually good at: naming something explicitly, from a
context you have not blessed.

**Why Wolfram never has this problem**: `f[x]` is application by syntax, unconditionally, so
its parser never needs to know whether `f` is defined. LaTeX has no such luxury — `a(b+c)`
genuinely _is_ multiplication in ordinary notation — so some signal has to break the tie,
and "is this a name we know" is the only one available. The ambiguity is inherited from the
notation, not invented by compute-engine. What compute-engine could do better is simply not
discard `InvisibleOperator` so eagerly; it already builds the node.

### 3.3 On spelling — the glyph and the separator

`ƒ` (U+0192, Option+f on a Mac) is deliberately ugly, and the ugliness is the argument for
it: it is never chosen as a variable on purpose, it renders visibly curly rather than as an
italic _f_, and so it can squat a namespace marker without ever colliding with a user's
symbol. That holds up.

It is also not the only option, and need not be the stored one. The dictionary mechanism
verified in §3.7 of upstreaming.md means the head can be named honestly in MathJSON —
`Resource`, say — and carry `ƒ` as its LaTeX trigger. Typed short, stored legible,
serialised back short.

This is worth noting as the first _load-bearing_ use of library-contributed notation. Until
now the case for `latex?: LatexDictionaryEntry[]` on `LibraryDefinition` was ζ_H — real but
cosmetic. Here it gates the ergonomics of an entire namespace strategy. That strengthens the
ask considerably.

The **separator** is harder, and is not settled. Measured: of `~`, `$`, `::`, and the unicode
lookalikes `ー` and `․`, only `_` is legal in a compute-engine symbol name — everything else
falls back to a string literal. `_` round-trips (`\mathrm{Notatio_{Carlitz}}(3)` parses back
to `["Notatio_Carlitz", 3]`) but renders as a subscript, colliding with the existing
subscripted-symbol convention (`i_k`, `j_m`, ζ_H). `__` is also legal and renders as a
_superscript_, colliding with powers.

`~` is unavailable today because LaTeX binds it to a non-breaking space — but that is a
better argument _for_ it than against it. A qualified name is precisely one unbreakable run:
the separator is a space that must never break. If a character has to be chosen, the one
whose existing meaning is "this is all one unit" is the semantically right one, and the
conflict is an implementation detail of the LaTeX dictionary rather than a clash of meaning.
Wolfram's backtick has no such justification, and has the additional property that a
qualified name cannot be written inside Markdown code spans — which is a real cost for a
project whose documentation is Markdown.

This stays open. What is settled is the shape: whatever the character, it separates a
context from a name, and it is only _needed_ when disambiguating.

## 4. Contexts — the part that is actually the good idea

A resolver alone gives lazy loading. It does not give a _place_ to put things, and that is
the more valuable half.

The proposal: a lazily-populated context namespace, filled as needed, with a search path —
so that resolution can find a name without it living in the global symbol table, and so that
names can be _promoted_ toward the global table as they earn it.

```
enumeratio~WeakCompositions        namespaced, resolved on demand
ada~WeakCompositions               by curator
WeakCompositions                   promoted — on the search path, or global
```

(`~` throughout this document stands in for whatever separator is chosen — see §3.3. The
registry's `SEPARATOR` constant holds a backtick today only because it was implemented
first; it is one line to change while nothing has been written down.)

The ladder has three rungs: **namespaced** (exists, addressable, off main), **blessed**
(curated set, on the default search path), **promoted** (global, earns a real head and
conventional notation). Only the top rung costs global namespace, and it is reached by
evidence rather than by being declared first.

Contexts are the piece compute-engine has no equivalent of. Scopes exist, but they are
lexical evaluation scopes, not a _namespace_ mechanism: there is no way to hold a body of
names off to one side, opt into a subset, and refer to them in short form without accepting
all of them globally. That is what Wolfram's `Context` plus `$ContextPath` provide, and the
absence is what forces the choice between "declare everything" and "declare nothing". It
belongs on the upstream pile beside the notation ask, though it is a much larger request and
one we can prototype entirely on our side first.

Two observations on prior art:

- Wolfram keeps `Context` and `ResourceFunction` as **separate mechanisms**, and the reason
  is that contexts are local and eager while resources are remote and lazy. A _lazy_ context
  — the thing proposed here — is the synthesis of the two, and is genuinely not what Wolfram
  built. That is a point in its favour, not against it, but it does mean there is no
  reference implementation to copy.
- Once the identifier carries a curator (`ada/WeakCompositions`, ``ada`WeakCompositions``),
  the string _is_ a namespace. The choice between encoding it in a string argument and
  encoding it in a context path is not cosmetic: with a string, promotion is a **rename**
  (every existing reference breaks); with a context path plus a search path, promotion is a
  **path change** (existing fully-qualified references keep working). That argues for the
  context form, and it argues for deciding early, because the migration is much cheaper
  before anything is written down.

## 5. Lazy resolution — the mechanism

This is the part that actually matters, and §3.2 makes it tractable.

### 5.1 The loop

```
parse non-canonically
  -> walk the AST for application candidates and unknown heads
  -> resolve those names against the registry          (async: fetch, import, whatever)
  -> declare what resolved
  -> canonicalise the same tree
  -> evaluate
```

Evaluation itself is **synchronous** — that is not negotiable and should not be fought. But
nothing above requires it to be async: the resolution happens _before_ evaluation, in a
phase that is allowed to await. The sync boundary is respected by moving the work outside
it, not by suspending inside it.

### 5.2 Completeness, and the residual case

Static analysis over the source AST cannot see a head that is synthesised _during_
evaluation — and handlers can do that (verified: a handler boxing `["Carrier", n]` evaluates
fine, provided `Carrier` is declared). So the pipeline is complete exactly when:

> every head that can appear at runtime but not in the source is already loaded.

Two things make that condition hold rather than hope:

- **Carriers are loaded eagerly.** They are the dominant category of runtime-synthesised
  head — a collection's elements are carrier values — and §2.1 already declares all 86.
- **The rest is lintable.** Handler bodies are ours; a check that our own handlers only
  construct heads from their own library or its declared dependencies is a lint over our
  sources, not a guarantee we need from upstream.

That last point is worth stating plainly because it is easy to assume otherwise:
**compute-engine does not constrain what a library's symbols reference.** `LibraryDefinition`
carries a `requires` field, but there is no public API to register one (§3.6 of
upstreaming.md) and nothing inspects handler bodies — a JavaScript `evaluate` can box any
head it likes. The discipline is ours to impose and ours to check.

### 5.3 When resolution fails anyway

If an unresolvable head is reached at evaluation time, the honest behaviour is to **hold**,
not to throw: the expression stays symbolic and carries enough information to say what was
missing. A held expression can then be re-resolved and re-evaluated by the outer loop —
which is the same fixpoint the pipeline already runs, entered one step later.

The residual design case is a _curator-supplied_ carrier: a published collection over a
domain that is not ours. That is the real dependency edge, and it is manageable because it
is rare and because holding gives it somewhere to fail safely.

## 6. Definitions as data — the reference implementation

Everything above treats a symbol's _definition_ as opaque: a head either has a handler or it
does not. The more valuable move is to make the definition itself data.

Almost every head we have added could be defined **in the language itself** — as an Epsil expression
tree, not as TypeScript. That version would usually be far too slow to evaluate in the
ordinary course of things; the accelerated TypeScript handler stays the one that actually
runs. But the slow one is worth having for three separate reasons, and each is independently
sufficient:

1. **It is the specification.** A `FullForm` AST that rewrites `MajorIndex` down to bare
   primitives says what the head _means_, unambiguously and in a form a reader can expand.
   Prose in a reference page approximates this; the tree is it.
2. **It is an oracle we own.** The accelerated handler and the reference definition must
   agree on every value. That is a differential test, and it is exactly the shape enumeratio
   already runs in `selfcert.mts` — accelerated `fiber_count` against naive enumeration,
   `element_at` against a sequential walk. That harness catches truncations and off-by-ones
   the example suite does not, and it does so without a second system to compare against.
3. **It makes the core explicit.** Reduce every head until nothing reduces further, and what
   remains is the primitive set — the actual definition of the language. Everything above
   that line becomes data, and data can be lazily loaded, versioned, fetched, curated and
   promoted. The whole of §4 and §5 only pays off once most of the catalog is _above_ that
   line.

### 6.1 The frontier is the deliverable

The reduction does not bottom out at zero. Some heads are irreducibly primitive by
construction, and some are irreducibly _numeric_ — ζ does not rewrite into anything simpler
in a way that helps, it evaluates. So the honest artefact is a reduction tree with a named
**frontier**: the set of heads that do not reduce, each labelled with why (primitive,
numeric kernel, foreign call).

Naming that frontier is a design act, not a discovery. Choosing it too small makes
definitions unreadably deep; too large and the "core" stops meaning anything. But it is the
single most clarifying artefact this project could produce, and it is checkable: every head
either reduces or is on the declared frontier, and a lint can hold that closed.

### 6.2 Showing it

The reference pages should be able to show, per head:

- the **accelerated implementation** actually being evaluated — the TypeScript, syntax
  highlighted, in a `notatio-code` control;
- the **reference definition** as an Epsil expression, expandable step by step down
  to the frontier.

`ReferenceEntry` now carries an `implementations` block for exactly this, and it is a LIST
because there are genuinely several — a head is made of more than one thing:

| origin      | what it is                                  | stored as               |
| ----------- | ------------------------------------------- | ----------------------- |
| `reference` | the defining expression, in Epsil           | the expression itself   |
| `native`    | the TypeScript that actually runs           | a pointer, checked      |
| `compiled`  | a compute-engine compile target (wgsl, …)   | a pointer, derivable    |
| `component` | a web component — the element IS the answer | the element name        |
| `mapped`    | the equivalent in Wolfram / SymPy / Sage    | a pointer into MAPPINGS |

A `native` row is a POINTER, never a copy, and a test checks the file exists — a copied
implementation is the thing that rots, and the pointer is what refuses to.

Each row also carries an **environment**: `engine`, `browser`, `gpu`, `node`, `external`.
That axis is not decoration. Some heads only mean anything somewhere: a plotted ζ bottoms
out in `<notatio-complex-plot>`, and the rendered phase portrait _is_ the value — there is no
expression it reduces to. A reader deserves to know that, and a `component` row is required
to say which environment it needs and what it produces.

`Zeta` is the worked example: irreducibly numeric, with four implementations across three
environments — TypeScript in the engine, WGSL on the GPU (through compute-engine's own
`WGSLTarget`), a custom element in the browser, and four external systems it maps to.

The reference page renders the block: one row per implementation, badged by origin and
environment, with the pointer for a `native` / `component` / `compiled` row and the
`primitive` reason above them. A `reference` row shows its expression in **TreeForm** — a
`<notatio-out form="tree" raw>` — the tree of heads opened one level at a time, each
closed node summarised as a line of InputForm, and each head that has an entry linked to
it. `raw` matters: the definition is shown as authored, not canonicalised, because its
spelling is the point.

The same tree is the stepping control. Every cell on a reference page carries a head
resolver built from the entries, so in TreeForm a head with a `reference` row shows `≝`,
and clicking it **unfolds** the application in place — the definition with the arguments
substituted for its wildcards, one reduction step shown rather than evaluated, foldable
back. A head on the frontier shows its `primitive` reason instead. Reading an example's
In cell this way — `MajorIndex([3,1,2])` unfolded into the `If`/`Sum`/`Filter` it is made
of — is §6.1 made concrete: the step stops exactly where the frontier says it should.
The symbol index tallies the same three standings per domain, so the population not yet
placed either way is a number on a page rather than a claim.

### 6.3 The catch

Two, and they are worth being honest about before starting:

- **A definition in Epsil is a second implementation, and second implementations rot —
  unverified ones.** The differential in (2) is what stops that, and it has to actually run:
  a reference definition is worth adding only where the differential runs, not as
  documentation garnish. Worth noting that we already HAVE several second implementations —
  every compile target is one — and they are currently unvalidated piecewise. The move is
  not "add another implementation"; it is "make the ones we already have mutually
  certifying".
- **Not everything we have added is expressible.** The diagram algebras, the Laurent-polynomial
  Burau kernel and the Bareiss elimination are algorithms over mutable state, and writing
  them as expression trees would be a translation exercise producing something nobody would
  read. Those belong on the frontier with an honest label, not forced above it.

The population where this is cheapest and the payoff highest is the combinatorial
statistics — 242 names, most a fold over an element's structure, most with an existing
oracle in enumeratio to check against.

**Started there** (history — the statistics package has since absorbed this and grown past
it, see §6.4). `packages/symbols/combinatorics/collections/src/definitions.ts` defines eleven permutation
statistics as expressions over the wildcard `_p`, and `tests/definitions.test.ts` checks each
against the fast loop over every permutation of 1..6 — roughly 9,600 agreements. All eleven
reduce to the same small vocabulary: `Count`, `Filter`, `Map`, `Sum`, `Range`, `Length`,
`At`, `Max`, `Take` and comparisons. That set is the first real sighting of the frontier.

`Cycles` (since renamed `CycleCount`) is the twelfth, and it did not reduce then: orbit traversal with a visited set, marked
`primitive: "kernel"`. One head out of twelve on the frontier, for a stated reason, is
roughly the ratio the whole exercise is worth doing to discover.

Writing the definitions also turned up two things prose would have hidden: `Range(1, 0)` does
not evaluate to the empty list, so every definition has to state its own floor (a permutation
too short to have the feature has none of it); and `MajorIndex` is visibly the _sum of the
descent positions_ rather than their count, which is the entire content of the statistic.

## 6.4 The core, derived

The frontier is no longer a claim. `@enumeratio/statistics` defines every catalog statistic
on its four carriers as an expression (84 definitions at the time of writing), and
`core.ts` computes what they rest on by walking every definition and subtracting the heads
we define ourselves.

The core is the list `tests/core.test.ts` pins — thirty-odd compute-engine heads, all of
them list and arithmetic primitives (`At`, `Filter`, `Count`, `Map`, `Fold`, `Range`, `Sum`
and comparisons do most of the work). It is pinned so that reaching for one more primitive
is a visible event rather than a quiet drift; every time it has grown, it has been to
close a frontier entry (`Fold`, `List`, `Join` for the growing-accumulator statistics,
`Flatten` for the set-partition arcs), which is the trade worth making.

The **tower** falls out of the same walk, and it is deliberately not a decision: a statistic
sits one level above the deepest head it uses. Almost all reduce straight to the core; the
exception is `StandardTableauCount`, defined as `n!` over the `HookProduct` **head** rather
than by walking the Young diagram a second time. That is the shape to want more of: the
tower gets deeper as definitions start reusing each other, and a flat tower means we are
still repeating ourselves.

### What the derivation caught

Three things, none of which prose would have found:

- **A name collision, reported as a cycle.** enumeratio's partition statistic `Length` is
  compute-engine's `Length` applied to the parts list — the same function under the same
  name. Defining it again made a self-referential definition, and the cycle check said so.
  The fix was to delete it, which forced a third category into existence: `NATIVE_TO_ENGINE`,
  for catalog names that need nothing from us at all. That is the best outcome a name can
  have, and there will be more of them.
- **The frontier split by cause, not by difficulty** — while it had entries. Of the 22 it
  once held, thirteen were _blocked on a map_ rather than primitive (the permutation cycle
  statistics wanted `CyclePartition`, the set-partition crossing statistics wanted an arc
  representation), and the rest were folds over prefixes (longest run, longest increasing
  subsequence, bounce, dinv). All of them are now definitions; the maps got built and the
  folds turned out to be expressible. The frontier emptied in September 2026.

- **Expression definitions are slow, and that is the finding.** The triple-loop pattern
  statistics cost roughly n³ expression evaluations and are checked over permutations of
  1..5 rather than 1..6. A definition is a specification, not a fast path — which is the
  argument for keeping both, and for the differential between them.
- **Frontier claims that were simply wrong, twice over.** Five statistics sat on the frontier
  because "compute-engine has no fold form". It has `Fold`. Then five more sat there because
  a fold "can only carry a fixed-width accumulator". It cannot be bounded that way either:

  ```
  Fold(Function(Join(a, List(b)), a, b), List(), [3,1,2])   [3,1,2]   — the accumulator grows
  ```

  A fold accumulator can be a growing list, and a list of lists. With that,
  `LongestIncreasingSubsequence` is patience sorting — the pile tops as the accumulator, the
  answer being how many piles — and its decreasing twin is the same fold with the comparison
  reversed. Both are now definitions, checked against the piles algorithm over every
  permutation of 1..6.

  One technique worth keeping: **when a list has to BE a value rather than a promise, fold
  it.** `Map` over a `Range` stays lazy and does not evaluate to a list on its own, which is
  right for a collection and wrong for the rebuilt pile list. Rebuilding it with a fold
  evaluates eagerly.

  Nine statistics have now moved off the frontier on claims that were asserted rather than
  checked, and `Fold`, `List`, `Join` and `Flatten` joined the core doing it. Every time the core has
  grown, it has been to close a frontier entry — which is the trade worth making. The lesson
  is the one this document keeps re-learning: **check the engine before declaring a limit.**
  Between the `InvisibleOperator` correction in §3.2, the `Fold` correction, and the cycle
  statistics, three separate "compute-engine cannot do this" claims in this document have
  turned out to be "I did not try". The engine is consistently more capable than the first
  guess, and the cost of guessing is real work not done.

### Coverage

Every catalog statistic on the four covered carriers is accounted for — defined, native to
compute-engine, or a cardinality answered by `Count` — and the frontier is empty.
`tests/coverage.test.ts` holds that closed; the per-carrier numbers are one `vp node` away
and are not repeated here, because the last two copies of that table in this file were both
wrong within a month.

Open questions moved to design/speculative/namespaces.md.

## 8. What is built

`packages/catalog` implements §3 and §4 as a working prototype, and the tests pin the census
above so it fails loudly when the catalog moves.

- `scripts/extract.ts` folds an enumeratio dump into `src/catalog-data.ts` — the dump itself
  is gitignored, the extracted result is committed.
- `ResourceRegistry` is the context registry: `add`, `bless`, `unbless`, `resolve`,
  `candidates`. Qualified spellings bypass the search path, which is the property that makes
  promotion a path change.
- `declareCatalog(ce)` declares exactly ONE head for the whole catalog, and answers a
  resource only when a head of its name is already declared — it asks the engine rather than
  recording the answer, so the registry cannot go stale against what is declared.
- `CATALOG_LATEX` carries the `ƒ` trigger, and cannot be installed by `declareCatalog`. It
  has to be merged into a `LatexSyntax` at construction. That is §3.7 of upstreaming.md
  biting for real rather than in the abstract.

- `prepare(ce, source, registry, install, parse?)` is §5.1 running: parse, find candidates,
  resolve, install, box. It takes LaTeX or MathJSON, and `install` may be async — which is
  the whole point, since evaluation may not be. Since compute-engine 0.131 an unknown name
  applied to parentheses parses as an application, so the default parse stage is the
  canonical one. The stage is pluggable: `rawParse` keeps the unresolved
  `InvisibleOperator` reading for a front end that wants to decide application versus
  product itself (e.g. keeping `a(b+c)` a product for names nobody claims), and the
  candidate walk reads either tree.

Registering all 280 collections declares nothing and costs one Map insert each — there is a
test asserting exactly that. The lazy loop is tested end to end on a real catalog name:
nothing declared up front, `["Count", ["Subsets", 4]]` installs `Subsets` on demand and
evaluates to 16.
