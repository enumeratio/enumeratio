# Design: carrier domains, representations, and the maps between them

Status: **built, minus the lattice**. `@enumeratio/domains` mints a nominal type per carrier
and declares a held constructor for each ([`declare.ts`](../packages/symbols/combinatorics/domains/src/declare.ts),
[`types.ts`](../packages/symbols/combinatorics/domains/src/types.ts)), so a head declared over `permutation`
rejects a bare list, and the maps are declared in both engines -- the CLI session and the
docs site -- so `CycleType(Permutation([2, 3, 1]))` evaluates in either. The statistics
stay on bare lists there (no `domainTypes`), because a collection's rows are lists: the
maps take carriers, the statistics take what the collections actually yield. The open item
is the subtype lattice, which needs the upstream ask in §1.1.

Companion to [namespaces.md](./namespaces.md), which settled how names are _addressed_. This
one is about what they are _about_: the domains a collection's elements belong to, how those
domains relate, and what has to exist before combinatorial maps can be modelled honestly.

The forcing question is a map. A map takes an element of one collection to an element of
another — `Rsk` from a permutation to a pair of tableaux, `ToLehmerCode` from a permutation
to a subexcedant sequence. Writing that down requires saying what a permutation _is_. That
now has an answer: each carrier is a minted type whose values are tagged by an unevaluated
constructor, so `Permutation([2, 1, 3])` is a permutation and `[2, 1, 3]` is a list. What is
still missing is the relation _between_ carriers — `Derangement ⊂ Permutation` has nowhere
to live, because minted types do not subtype (§1.1).

## 1. What compute-engine actually offers

Verified against 0.128.0. `ce.declareType(name, body, options)` exists, and the `options`
decide everything:

```ts
ce.declareType("Permutation", "list<integer>", { mint: true }); // nominal
ce.declareType("OneLine", "list<integer>", { alias: true }); // structural

ce.type("Permutation").matches("list<integer>"); // false — opaque, both directions
ce.type("OneLine").matches("list<integer>"); // true  — transparent, both directions
```

`mint` gives a genuinely **nominal** type: it does not match its own body in either
direction. `alias` gives a structural synonym. That is exactly the nominal/structural
distinction we want, and it is already there.

**And it dispatches.** A head declared over a minted type refuses a structurally identical
value:

```ts
ce.declare("Sign", { signature: "(Permutation) -> integer", … });
ce.declare("p", { type: "Permutation" });

ce.box(["Sign", "p"]).evaluate()            // 1
ce.box(["Sign", ["List", 2, 1]]).evaluate() // Error(incompatible-type, Permutation, vector<integer^2>)
```

That is the whole prize: `SetPartitions(n)` returning values that are _set partitions_
rather than lists of lists of integers, and a statistic over the wrong carrier failing
loudly rather than quietly computing nonsense.

### 1.1 Two things it does not do

**Minted types do not subtype.** A restriction cannot be expressed:

```ts
ce.declareType("Derangement", "Permutation", { mint: true });
ce.type("Derangement").matches("Permutation"); // false
```

Each minted type is an island. The restriction lattice — `Derangement ⊂ Permutation`,
`DistinctPartition ⊂ IntegerPartition` — has nowhere to live. There is a workaround:

```ts
ce.declareType("AnyPermutation", "Derangement | Permutation", { alias: true });
ce.type("Derangement").matches("AnyPermutation"); // true
```

but it inverts the dependency. The supertype must enumerate its subtypes, so adding a
restriction means editing the thing it restricts — the exact shape an open, lazily-loaded
catalog cannot afford. **This is the upstream ask**: `declareType` gaining a supertype
relation, so a minted type can be declared as a nominal subtype of another.

**A nominal type does not survive evaluation.**

```ts
ce.declare("AsPermutation", {
  signature: "(list<integer>) -> Permutation",
  evaluate: (ops) => ops[0],
});

ce.box(["AsPermutation", ["List", 2, 1, 3]]).type; // Permutation   (held)
ce.box(["AsPermutation", ["List", 2, 1, 3]]).evaluate().type; // vector<integer^3>
```

The signature types the _expression_; the evaluated result is typed structurally by what it
actually is. So a constructor cannot tag a value — the tag is a property of the call, not of
the thing returned. Every downstream consumer sees a list again.

Types here describe expressions, and a value is an expression that has finished evaluating.
So for a carrier domain to mean anything at the value level, either evaluation must preserve
a declared return type, or a carrier value must be a **held constructed expression** that
never evaluates away.

### 1.2 The held constructor works

The second option needs no upstream change at all. A head declared with a signature and **no
`evaluate` handler** does not collapse, and keeps its declared type through evaluation:

```ts
ce.declareType("Permutation", "list<integer>", { mint: true });
ce.declare("AsPermutation", { signature: "(list<integer>) -> Permutation" });

const p = ce.box(["AsPermutation", ["List", 2, 1, 3]]);
p.evaluate().json; // ["AsPermutation", ["List", 2, 1, 3]]  — held
p.evaluate().type; // Permutation
```

And that is enough for real dispatch. With `FixedPoints` declared over `Permutation`:

```
FixedPoints(AsPermutation([2,1,3]))        1
FixedPoints([2,1,3])                       Error(incompatible-type, Permutation, vector<integer^3>)
FixedPoints(AsSetPartition([[1,2],[3]]))   Error(incompatible-type, Permutation, SetPartition)
```

The third line is the one that matters. A set partition passed to a permutation statistic is
**rejected by type**, not quietly counted. That is the nominal typing this whole design is
for, and it is available today.

Held values also survive being elements of a list, which is what a collection needs:
`List(p, p)` stays `["List", ["AsPermutation", …], ["AsPermutation", …]]`.

### 1.3 Three names, and no suffix on any of them

Types and symbols share one namespace, so **a type and a head cannot have the same
spelling**:

```ts
ce.declareType("Permutation", …);
ce.declare("Permutation", …); // Error: The symbol "Permutation" is already declared in this scope
```

There are three things to name — the type, the constructor, and the collection — and the
first instinct was to suffix one of them (`PermutationType`). That was the wrong way out.
**compute-engine's own casing convention already has room for all three**, and following it
costs nothing:

```
permutation     the TYPE         snake_case, exactly like `integer`, `indexed_collection`
Permutation     the CONSTRUCTOR  what appears in expressions
Permutations    the COLLECTION   the indexed family, `Permutations(3)`
```

The engine spells its primitive types lowercase — `integer`, `number`, `boolean`,
`indexed_collection` — and reserves the TitleCase plural for a **set-valued symbol**:
`Integers` is not a type at all, it is a symbol whose type is `set<integer>`.

```ts
ce.box("Integers").type; // set<integer>
ce.type("integer"); // integer
```

So the plural denotes a set (a _value_), the snake_case singular is the type, and the
TitleCase singular is free. Which means the type name needs **no transformation**: it is
enumeratio's carrier id verbatim, since that was snake_case already.

`plural-as-type` was tried first and fails for a different reason — declaring `Permutations`
as a type makes the collection head `Permutations(n)` impossible. The casing convention
avoids the collision entirely instead of trading one name away.

### 1.4 Epsil already has the syntax

The strongest argument that this is the right shape:

```
type Permutation = list<integer>   ->  ["DeclareType", "Permutation", "list<integer>"]
x: integer                         ->  ["Declare", "x", "integer"]
x ∈ Integers                       ->  ["Element", "x", "Integers"]
{1, 2, 3}                          ->  ["Set", 1, 2, 3]
```

Epsil has a type-declaration statement, a membership operator, and set literals. What it does
**not** have is **set-builder notation** — `{x | x > 0}` is a parse error. That matters for
§4, and it turns a vague ask into a precise one.

### 1.5 A constructed value is opaque to generic heads

A constraint found the hard way: **a type and a head cannot share a spelling.**

```ts
ce.declareType("Permutation", …);
ce.declare("Permutation", …); // Error: The symbol "Permutation" is already declared in this scope
```

So a carrier needs two names — the domain and its constructor — and one of them gets the
uglier. The probe above used `Permutation` for the type and `AsPermutation` for the
constructor, which puts the clean name where the type system reads it and the awkward one
where it is written. The opposite convention (`PermutationDomain` as the type, `Permutation`
as the constructor) reads better in expressions and worse in signatures. **Undecided, and
worth deciding before 86 of them exist.**

Wrapping a value in its domain hides it from every operation that has not been taught about
the wrapper. `Length(Permutation([2,1,3]))` does not evaluate: compute-engine's own
collection heads see a `PermutationType`, not a list. Anything reaching inside has to unwrap
first, which is why restriction predicates below carry two wildcards — `_x` for the
constructed value and `_raw` for its contents.

This is the real running cost of the held-constructor approach, and it is worth stating
plainly rather than discovering later: nominal typing buys rejection of wrong values at the
price of making right values opaque.

The serialised form is `\mathrm{Permutation}([2, 1, 3])` today — exactly the case the
notation mechanism in namespaces.md §3.3 exists to fix.

## 2. Domains are not collections

Worth stating plainly because the two are easy to conflate and the catalog keeps them
separate for good reason.

- A **domain** is a set of values with structure — _what a set partition is_. It answers
  membership: is this thing one?
- A **collection** is an indexed, ordered family — _the set partitions of {1..n}, in this
  order_. It answers counting, unranking and ranking.

`SetPartitions(4)` is a collection whose elements inhabit the `SetPartition` domain. The
same domain is inhabited by elements of `SetPartitionsIntoKBlocks(4, 2)`, of
`NonCrossingSetPartitions(4)`, and of anything else over that carrier. **One domain, many
collections** — which is exactly why enumeratio stores `carrier` as a column on
`base_collection` rather than deriving it.

The census makes the ratio concrete: 280 collections over 86 carriers, so a domain serves
three collections on average. Domains are the small, stable vocabulary; collections are the
open tail — the same split §2 of namespaces.md found for names, arrived at independently.

**Naming, 2026-09-26**: the concepts above stay distinct (this section is unchanged), but a
domain's NAME no longer is. A domain takes the plural — `SetPartitions`, not `SetPartition`
— and is the same head as its plain collection where one exists, both jobs on one
declaration (`declareConstructor` in [`declare.ts`](../packages/symbols/combinatorics/domains/src/declare.ts)
overloads onto whatever the collection already declared, the same mechanism §5.2 describes
for extending a built-in). The singular pascal-case of a carrier's id is reserved for an
inhabitant — a helper naming ONE value, never a domain or a collection — so there is no
singular alias to fall back on. The code examples through the rest of this document
predate that decision and still say `Permutation`; read it as `Permutations` throughout.

## 3. Representation is writing, not structure

This section previously argued that one-line and cycle notation are two DOMAINS — different
structures related by a bijection — and that calling one canonical "hides work". Reading
enumeratio's `base_repr` settled it the other way, and the correction is worth keeping
because the wrong version was plausible.

enumeratio registers all three permutation spellings against the SAME carrier:

```
('permutations','oneline','one_line',           'One-line notation',            true,  'perm_from_oneline')
('permutations','cycle',  'perm_cycles',        'Cycle notation',               false, 'perm_from_cycles')
('permutations','dense',  'perm_oneline_dense', 'Dense base-36 one-line',       false, 'perm_from_oneline_dense')
```

A representation is a **render function with a parse inverse**, keyed by (collection, repr,
medium), with exactly one marked canonical. The value is the same permutation either way;
only the text differs. `(1 2 3)` and `2 3 1` are two ways of writing one thing.

**What makes this the right call** is that enumeratio has a SEPARATE mechanism for the case
where the structure genuinely differs: a sibling collection over its own carrier, related by
an order isomorphism. Cycle notation is not that. Treating it as a second domain would have
produced a `cycle_permutation` carrier that nothing needs, and every permutation statistic
would have had to be declared over both.

The test for which mechanism applies is sharp: **if a parse inverse exists, it is a
representation.** `perm_from_cycles` recovers the image array exactly, so nothing has been
added or lost — there is no second structure, only a second spelling.

### 3.0 What is built

`representation.ts` carries the registry and `render.ts` the two heads:

```
Render(Permutation([2,3,1]), "cycle")            "(1 2 3)"
Render(Permutation([2,1,4,3]), "cycle")          "(1 2)(3 4)"
Render(Permutation([2,3,1]))                     "2 3 1"      — the canonical one
Render(IntegerPartition([3,3,1]), "exponential") "3^2 1"
ParseAs("(1 2 3)", "permutation", "cycle")       Permutation([2,3,1])
```

Six representations over three carriers, and **every render/parse pair is checked to be an
inverse** — over every permutation up to size 5 for the three permutation spellings. A
representation whose parse is not the inverse of its render is lying, and that round-trip is
the only test that would notice.

Two details worth keeping. Cycle notation writes **every** cycle including fixed points,
which is what makes it parseable without knowing n — `(1)(2)(3)` rather than the empty
string for the identity. And `Render` reads the carrier off the VALUE, so it cannot be asked
to write a permutation in a partition's notation; it finds nothing rather than inventing
something.

### 3.2 Reading and round-tripping are different jobs

Adding a `latex` medium turned up something that sharpens the upstreaming ask. Conventional
notation does **not** read back on its own:

```
2\,3\,1          parses as the NUMBER 231
(1\,2\,3)        parses as 123 — LaTeX parentheses are grouping, not cycle structure
\permutation(2, 3, 1)   parses as the permutation
```

A person reading `2\,3\,1` knows it is a permutation because of the surrounding page. A
parser has no such reader. So there are two jobs, and they want different output:

| job        | output                  | reached by                     |
| ---------- | ----------------------- | ------------------------------ |
| display    | `2\,3\,1`, `(1\,2\,3)`  | `Render(value, name, "latex")` |
| round trip | `\permutation(2, 3, 1)` | the engine's own `.latex`      |

The engine's serialisation keeps a trigger, so anything it writes it can read — checked over
every permutation up to size 4. The conventional spellings stay available for display, and
every `latex` representation deliberately has **no parse**, because claiming one would assert
something the measurement above disproves.

This is worth carrying upstream. §3.7 of upstreaming.md asks for notation contributable per
library, and the ζ_H example round-trips because `\zeta_H(2, 1)` keeps its trigger. The
general case does not: **traditional notation is a rendering, and recovering a value from it
needs either a trigger or a typed context**. `ParseAs` supplies that context explicitly,
which is why the ascii representations round-trip through it even though they would not stand
alone.

### 3.3 Render and parse are code, not data

Render and parse are TypeScript rather than expressions, which is a deliberate departure
from the definitions-as-data principle of namespaces.md §6. enumeratio makes the same call —
`render_fn` is a plpgsql function — and the reason is that formatting a list as `(1 2 3)(4 5)`
has no mathematical content to expose. The tower is about what things MEAN, not how they are
spelled.

### 3.4 Why domains still had to come before maps

A map takes an element of one collection to an element of another:

```
Rsk         : Permutations(n) -> StandardTableauxPairs(n)
ToLehmerCode: Permutations(n) -> SubexcedantSequences(n)
Inverse     : Permutations(n) -> Permutations(n)
```

Without domains, all three have the type `list<integer> -> list<integer>`, which is to say
no type at all. `Inverse` and `ToLehmerCode` are indistinguishable to the engine, and
composing them is unchecked. With carrier domains, each has a real signature, and a
composition that does not typecheck is caught rather than computed.

The 84 map names in the catalog are therefore blocked on this, not on effort. **This is why
domains come first.**

## 4. Restrictions are sets, not subtypes

A derangement is a permutation with no fixed points. The instinct is `Derangement <:
Permutation`, and §1.1 says compute-engine cannot express it. But the instinct is worth
questioning independently of what the engine supports.

A restriction modelled as a **subtype splits the carrier**: a derangement would no longer be
a permutation, and every permutation statistic would have to be re-declared over it — or
rely on exactly the subtype relation that does not exist. A restriction modelled as a **set
keeps the carrier shared**: a derangement _is_ a permutation, carries the `permutation`
type, and every permutation statistic already applies.

So the answer to "is defining the set of permutations with `FixedPoints = 0` good enough to
call it `Derangements`?" is **yes, and it is better than the subtype** — for this catalog.
What you give up is declaring a head that accepts only derangements. What you keep is
everything else working.

```
Derangements(Permutation([2,3,1]))   True
Derangements(Permutation([2,1,3]))   False
FixedPoints(Permutation([2,3,1]))    0     — still an ordinary permutation statistic
Cycles(Permutation([2,3,1]))         1
Derangements(IntegerPartition([3,1])) Error(incompatible-type, permutation, integer_partition)
```

The predicate is not new machinery: it is a statistic that already exists, plus a
comparison. `Derangements` is `FixedPoints(x) = 0`; `DistinctPartitions` is
`DistinctParts(x) = Length(x)`. This is also how enumeratio already models it — a restricted
collection shares its parent's carrier and adds a predicate.

**Where it stops being enough**: the predicate is a proposition checked per value, not a
classification the engine can dispatch on. `Element(p, Derangements(5))` is decidable;
`(derangement) -> …` is not writable. If a head must accept only derangements, the subtype
relation is genuinely needed — and that, not the modelling, is the upstream ask. Expressed
in epsil it would want set-builder notation (§1.4), which is the other half of the same gap:

```
type Derangement = {p ∈ Permutations | FixedPoints(p) = 0}   -- neither half parses today
```

## 4.1 Anonymous restrictions need no machinery

`Filter` over a lazy collection stays lazy, which is the whole thing:

```
Count(Filter(Permutations(4), p -> FixedPoints(p) = 0))   9   — without materialising 24
```

So `Restricted(collection, predicate)` delegates to `Filter` and adds only two things: a name
saying this is a restriction rather than an arbitrary filter, and the predicate kept as
**data**. The second is the argument for having it at all — a named head cannot serve a
PARAMETERISED family. `Derangements` can be a head; "partitions whose largest part is at most
k" cannot be, not for every k, and enumeratio models those as constructor parameters for
exactly this reason. Wolfram's `Restricted` lives in the Interpreter layer rather than the
type system, so it is not the mechanism to copy — but the shape, a restriction as an
anonymous value, is the part worth taking.

A named restriction is then just an anonymous one that earned a name, going through the same
`Filter`.

### 4.2 The specification meets the kernel

Several restriction names — `Derangements`, `CyclicPermutations` — already exist as
collections in `@enumeratio/collections`, with hand-written count and unrank. That is not a
conflict. It is the reference/accelerated pairing from namespaces.md §6 arriving somewhere
new: the restriction is the SPECIFICATION, the kernel is the implementation, and a
differential holds them together.

Running that differential immediately found something:

```
Restricted(SymmetricGroup(4), no fixed points)  first element  [2,1,4,3]
Derangements(4)                                 first element  [4,3,2,1]
```

Same nine elements, different order, and **neither is wrong**. A restriction says _which_
elements, not in what sequence. enumeratio gives every collection its own canonical order,
and a restricted collection's order is its own data rather than the parent's induced one. So
the differential compares membership, and the ordering divergence is recorded rather than
reconciled — which is more evidence for §4's framing that a restriction is a set.

## 5. What to build, in order

1. **Mint the 86 carriers** as nominal types, from the extracted catalog data. Cheap, and it
   is the vocabulary everything else needs.
2. **A held constructor per carrier**, so a value carries its domain. Verified in §1.2 — it
   works today, and it is what makes the rest of this list possible without waiting on
   upstream.
3. **Restrictions as (type, predicate) data**, reusing the statistics. Done — membership
   now, dispatch when the engine can express it.
4. **Representations** — done, and NOT as sibling domains: a render/parse pair over one
   carrier, per §3. Sibling collections remain the mechanism for the case where the structure
   really does differ, and nothing here needs one yet.

Item 5 of this list — typing the maps by carrier — is still in progress (not yet built in
full); its current state moved to design/speculative/domains.md. What building the first maps
turned up (§5.1 below) is kept here since it documents what has already landed.

### 5.1 What building the first maps turned up

- **The typing does what it was for.** `Inverse(Permutation([2,3,1]))` has type `permutation`;
  `Inverse([2,3,1])` and `Inverse(IntegerPartition([2,1]))` are type errors. `CycleType` is
  the case the whole design exists for — `permutation -> integer_partition` — and its output
  feeds partition statistics while _refusing_ permutation ones.
- **Maps reduce statistics.** `DescentSet`'s size and sum are `Descents` and `MajorIndex`;
  `ToLehmerCode`'s total is `Inversions`. Those are four statistics that could be defined in
  terms of two maps instead of walking the word again — the deliberate tower-deepening §6.4
  of namespaces.md asks for.
- **Our map `Reverse` shadows compute-engine's list `Reverse`.** A head means one thing, so
  `CycleType` cannot sort-then-reverse; it reads the sorted list back to front by index
  instead. Minting 86 carrier constructors has the same hazard — `Word` is a carrier name and
  a compute-engine head — and replacing a built-in is silent.
- **A carrier's real shape shows up immediately.** `finset` is `(members, n)`, so a map into
  it hands over a Tuple, not a list. Extracted shapes earn their keep the moment anything
  constructs a carrier value.

## 5.2 Extending a built-in without losing it

An earlier version of this document said there was no mechanism for adding behaviour to an
existing head, then said there was one that did not reach built-ins. Both were wrong. There
are three mechanisms, and between them a built-in can be extended with nothing lost.

**Protocols are real typeclass dispatch** — `declareProtocol` plus one
`declareProtocolImplementation` per (type, protocol):

```ts
ce.declareProtocol("Reversible", { functions: { reversed: "(Self) -> Self" } });
ce.declareProtocolImplementation("permutation", "Reversible", { functions: { reversed: … } });
ce.declareProtocolImplementation("list<integer>", "Reversible", { functions: { reversed: … } });

reversed(Permutation([1,2,3]))   Permutation([3,2,1])
reversed([1,2,3])                [3,2,1]
```

One name, two implementations, dispatched on type. But it only works for **new** names: a
protocol member called `Reverse` does not extend compute-engine's `Reverse`.

**Signatures are already intersections**, which is to say compute-engine already has
overloading:

```
Reverse : ((T) -> T where T: string) & ((T) -> T where T: list) & ((indexed_collection<T>) -> list<T> where T)
```

What it lacks is _incremental_ overloading — no way to add a clause to a head you did not
declare.

**So: keep the original whole, and add to it.** `extendBuiltin` re-declares the original
definition under a private name (`ReversePrimitive`), then declares the public name with our
clause appended to its signature and a handler that delegates anything that is not ours:

```
Reverse(Permutation([1,2,3]))   Permutation([3,2,1])   ours
Count(Reverse([1,2,3]))         3                      still lazy
At(Reverse([1,2,3]), 1)         3                      collection handlers intact
Reverse("abc")                  'cba'                  string overload intact
Complement(Set(1,2))            ComplementPrimitive(…) — the one leak
```

This matters because the two shapes of built-in behave differently under naive replacement.
`Sign`, `Inverse` and `Sort` are `evaluate`-backed and can be captured and delegated to.
`Reverse` and `Complement` are backed by **collection handlers** with no `evaluate` at all,
and those handlers cannot be carried onto a definition whose signature returns a nominal
carrier type — the engine rejects that combination, because a minted type is not a
collection. Keeping the original definition intact under another name sidesteps both
problems at once.

Two details that cost a debugging cycle each. The original signature must be parenthesised
before intersecting **only when it is not already an intersection** — wrapping one that is
breaks the `where` clauses inside it. And an extended head no longer produces a type error
for a wrong argument: it hands the call to the original, which is the point, so a test that
wants to see rejection has to use a head that is ours alone.

**Whether the private name is needed depends on the head**, and the difference is worth
stating because the obvious way to avoid it costs more than it saves.

An **evaluate-backed** head (`Sign`, `Inverse`, `Sort`) needs no second symbol at all:
capture `operatorDefinition.evaluate`, declare our clause with its honest return type, and
delegate. Nothing leaks.

A **collection-backed** head (`Reverse`, `Complement`) does need one. Its handlers cannot sit
on a definition whose clause returns a nominal carrier, because the engine refuses that
pairing — a minted type is not a collection. Declaring the clause `-> collection` instead
satisfies the check and removes the leak entirely... and silently breaks written composition:

```
Reverse : … & ((permutation) -> collection)

Complement(Reverse(p))   Error(incompatible-type, 'permutation | set', 'collection')
```

The head's DECLARED return type is no longer the carrier, so a composition type-checks only
when each step has already been evaluated. Composition is the entire reason maps are typed,
so the honest return type wins and the original definition is kept under a private name. The
leak is then narrow and cosmetic — only a built-in result that stays UNEVALUATED prints as
`ComplementPrimitive(…)` — and it is a candidate for the notation mechanism of
namespaces.md §3.3.

**The remaining ask** is small and precise: let a protocol implementation attach to an
existing operator, so a built-in can be extended per type without any of this. Protocols
already do the dispatch; they are simply not wired to the heads that came with the engine.

### 5.3 The shadowing audit

Against a bare engine, our names collide in exactly four places:

```
carriers      ContinuedFraction
maps          Reverse, Complement, Inverse
statistics    Sign
```

The three maps are _extended_ rather than renamed, per §5.2. The remaining two are worth
handling by hand, and the audit is worth re-running whenever a batch of names lands — a
carrier minted over a built-in replaces it with no warning at all.

Open questions, and item 5's in-progress state, moved to design/speculative/domains.md.
