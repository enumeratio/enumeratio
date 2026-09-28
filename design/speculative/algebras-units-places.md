# Design: units belong to algebras

Speculative. Three claims, then what they cost:

1. **A unit is a value of an open family**, `Unit(family, k)`, not a symbol. What it squares
   to and what it commutes with are relations of the family, not of any surrounding algebra —
   a family keeps growing (index 47 is as much a unit as index 1) and can always be viewed
   inside any algebra whose span reaches it.
2. **A name like `i` is presentation**, bound in a context. Values settle ambiguity;
   names never do.
3. **One algebra has several models and several local pictures.** Isomorphisms, embeddings
   and completions are maps between values, so "the `i` of ℍ", "Gaussian `i`" and "a square
   root of −1 in ℚ₅" are three different things joined by explicit maps.

All of this is enumeratio (meaning). Which letter prints for a unit is notatio. Mathlib is
the spec for concepts and names, as in design/structures.md; every departure below is
marked **extension**.

## 1. Algebras are finite spans of units

A unit's relations — its square, and whether it commutes or anticommutes with another unit —
belong to its family, not to whichever algebra someone chooses to view it through (§2). An
algebra fixes a finite set of units and takes their span; the span of any finite set is a
subalgebra, and the inclusion is canonical. So an element can be viewed in any algebra
containing its units, and "which algebra" is a question you can defer or answer twice, not
one every unit has to settle up front.

| algebra                      | generators | relations                                  | Mathlib                                |
| ---------------------------- | ---------- | ------------------------------------------ | -------------------------------------- |
| `QuaternionAlgebra(K, a, b)` | 2          | i² = a, j² = b, ij = −ji                   | `QuaternionAlgebra R a b c`, see below |
| `MulticomplexAlgebra(n)`     | n          | each squares to −1; all pairs commute      | none: extension                        |
| `CliffordAlgebra(p, q, r)`   | p + q + r  | squares +1 / −1 / 0; all pairs anticommute | `CliffordAlgebra Q`, Q diagonal        |
| `GaussianRationals`, ℂ       | 1          | i² = −1: degree 2 over ℚ, ℝ                | a number field; `Complex`              |

Mathlib's `QuaternionAlgebra` carries a third parameter so the definition survives
characteristic 2; the classical (a, b) is the case with that parameter zero, written
ℍ[R, a, b]. Ours takes (K, a, b) and leaves characteristic 2 out until finite fields need it
(a restriction, marked as a departure on the record). Mathlib's `CliffordAlgebra` is over any
quadratic form; `CliffordAlgebra(p, q, r)` is the diagonal case and stays our constructor
for it.

So Gaussian `i` is `Unit(Multicomplex, 1)` — the same value multicomplex `i_1` is, since ℂ is
just where that family starts (below) — while the classical quaternion `i` is
`Unit(Clifford, 1)`: a different family. Adding them still declines, but not because they
come from different algebras; it's that `Multicomplex` and `Clifford` carry no relation
between their units beyond commuting (§2), so the sum is a well-formed element of the tensor
of the two families, sitting in neither ℂ nor ℍ alone. An algebra never overrides this — it
only picks which finite set is in view.

**`k` is not a unit.** In the Clifford view of ℍ it is the product `Unit(Clifford, 1) *
Unit(Clifford, 2)`, a basis element, not a third family member. `Basis(B)` returns
(1, i, j, k); there is no fourth unit behind it. A context that wants a name for it binds
`k := Unit(Clifford, 1) * Unit(Clifford, 2)`.

**The identity is not a unit either.** It is `1`, the image of the base ring's 1 under the
structure map (Mathlib's `algebraMap R A`). Conventions that write it `e_0` (octonions, some
Clifford texts) or `j_0` / `i_0` (multicomplex towers) are display names for that identity,
bound like any other name (§3). Units index from 1, so `Unit(family, 0)` never has to mean
two things.

**ℂ is the one place compute-engine already has a value.** Its `ImaginaryUnit` is the complex
number 0 + 1i, a numeric literal with full arithmetic. `Unit(Multicomplex, 1)` should
canonicalise to `ImaginaryUnit` rather than shadow it. `i_2`, `i_3`, … are further units of
the same open family, not images of `i_1` under some tower embedding — the family already
contains them, growing by one index at a time, not by re-embedding a smaller ℂ into a bigger
one.

## 2. Open unit families

A unit doesn't need an algebra to exist. `Unit(family, k)` fixes, per index, only its square
and whether two of the family's units commute or anticommute — the two facts arithmetic
needs. Given those, `i_3 · e_2 · j_4` multiplies without anyone declaring how many units
either family has: element arithmetic needs only the indices that appear, never a dimension n.

Units from different families always commute, so the product of two families is a tensor
product, and an element is free to draw generators from as many families and indices as it
needs. A family can keep growing the way a list does — index 47 is no less a unit than
index 1 — and one algebra's finite choice (§1) never blocks another algebra, or no algebra at
all, from reaching further into the same family.

The repo's hypercomplex package (`packages/symbols/algebras/hypercomplex/src/units.ts`)
already parses exactly this grid — square ∈ {−1, 0, +1} crossed with commuting/anticommuting
— as six symbol-prefix families. Aligning `Unit`'s family names to it:

| `Unit` family  | repo prefix   | square   | commutes | feeds                                          |
| -------------- | ------------- | -------- | -------- | ---------------------------------------------- |
| `Multicomplex` | `i_k`         | −1       | yes      | multicomplex ℂₙ                                |
| `SplitComplex` | `j_k`         | +1       | yes      | split / perplex towers                         |
| `Dual`         | `ε_k`         | 0        | yes      | dual numbers                                   |
| `Clifford`     | `e_k` / `f_k` | +1 or −1 | no       | Cl(p, q, r); PGA's non-degenerate directions   |
| `Grassmann`    | `θ_k`         | 0        | no       | exterior algebra Λ(ℝⁿ); PGA's degenerate `e_0` |

Two mismatches worth flagging against a first sketch of this grid:

- **Clifford's sign is per index, today per family in the repo.** The repo spells +1 and −1
  as two prefixes, `e_k` and `f_k` — a choice made once, per family, not per unit. This
  design wants the sign attached to the index instead (`CliffordAlgebra(p, q, r)`'s own p/q
  split already works that way), so `e_k`/`f_k` collapse into one `Clifford` family read
  against a declared signature. Left open (Open, below): whether that signature lives on the unit, or
  is state a context supplies alongside it.
- **PGA's degenerate unit is `Grassmann`, not `Dual`.** Dual numbers' ε commutes and squares
  to 0; PGA's degenerate direction (often itself written `e_0`, unrelated to the identity's
  `e_0` above) anticommutes and squares to 0 — the repo's `θ_k`. Same square, different
  commutation, so "nilpotent" isn't one family; it's these two.

`Unit`, `Multicomplex`, `SplitComplex`, `Dual`, `Clifford` and `Grassmann` are all free
against compute-engine 0.139 (`ce.lookupDefinition`, checked bare) and against the repo's
reference records.

## 3. Names are bound per context

`i`, `i_1`, `e_0`, `j_0` and `f_2` are display names. A notebook scope binds them:

```
H := QuaternionAlgebra(Rationals, -1, -1)
i := Unit(Clifford, 1)
j := Unit(Clifford, 2)
```

After that `i` prints for the value and parses back to it. A second scope may bind `i` to
Gaussian `i`; nothing clashes, because what is compared, stored and evaluated is the value.
The existing unit families (`i_k`, `j_k`, `epsilon_k`, `e_k`, `f_k`, `theta_k`) become a
_default binding_, the names a context gets when it states none, not the mechanism.

This is what the oracle rule already assumes: a symbol with no compute-engine definition is
a free variable. Today's quaternion examples spell units as bare subscripted symbols
(`f_1`, `i_1`), which have no definition, so every system reads them as unknowns. Wolfram
leaves `Subscript[f, 1] ** Subscript[f, 2]` unevaluated, Sage multiplies them as commuting
variables, and the rows land as `domain` disagreements that say nothing about the math. (One
scan also collided a harness loop variable with the bare `i` inside `i_1`.)

**Examples should spell units as values:** `[Unit, Clifford, 1]`, not `f_1`. `Unit` has a
definition, so it is not free, and it maps cleanly: Sage `QuaternionAlgebra(QQ, -1,
-1).gens()[0]`, Wolfram `Quaternion[0, 1, 0, 0]` from the `Quaternions`` package. Captions
and the notatio form can still show `i` by rendering under a binding.

## 4. Several models of one algebra

ℍ has at least four standard constructions:

- `QuaternionAlgebra(Reals, -1, -1)`, the presentation above.
- Clifford: all of `CliffordAlgebra(0, 2)` (i = `Unit(Clifford, 1)`, j = `Unit(Clifford, 2)`,
  k = their product, which is what the hypercomplex package does now), or the even part of
  Cl(3, 0) or Cl(0, 3). The even part of Cl(0, 2) is only ℂ. Mathlib states the first as an
  equivalence of the Clifford algebra of a two-dimensional form with ℍ[R, c₁, c₂], which is
  precedent for the map below.
- Cayley–Dickson: ℂ doubled with −1, `CayleyDickson(ComplexNumbers, -1)`; the next step is the
  octonions. Not in Mathlib: extension.
- Matrices: the subalgebra of M₂(ℂ) with i ↦ diag(ImaginaryUnit, −ImaginaryUnit),
  j ↦ ((0, 1), (−1, 0)). Mathlib's `Subalgebra`.

Each is its own algebra value. They are related by an **algebra homomorphism**, a value fixed
by where the generators go: `AlgebraHomomorphism(A, B, [images…])`, checked once against
`A`'s relations, then applied or composed. An `AlgebraEquivalence` is one with an inverse; an
embedding (ℂ → ℍ, `GaussianRationals` → ℍ, ℂ → ℂₙ) is an injective homomorphism. These are
Mathlib's `AlgHom` and `AlgEquiv` with the abbreviations spelled out. Not `AlgebraMap`: in
Mathlib that is the structure map R → A.

**The Clifford model _is_ the open-family view; `QuaternionAlgebra(-1, -1)` is the same span
under a presentation.** The `AlgebraEquivalence` between them carries `Unit(Clifford, 1)` and
`Unit(Clifford, 2)` to the presentation's `i` and `j`. `k` is not carried across as a
generator on either side — it's `i·j` in the presentation and `Unit(Clifford, 1) *
Unit(Clifford, 2)` in the family view, the same derived product, never a unit itself (§1).
For general (a, b), `QuaternionAlgebra(K, a, b)` has no family unit behind `i` or `j` at all:
the map "i ↦ a unit with square a" only lands on `Unit(Clifford, k)` when a, b ∈ {−1, +1};
otherwise the presentation stands alone until an equivalence to a family view is found (Open, below).

A named algebra like `Quaternions` resolves to one chosen model, and the others carry a
canonical equivalence to it. A context picks a model the way it picks names, by binding `H`.
Results stay in the model they were computed in; moving between models is an explicit map,
never a silent coercion.

## 5. What needs a fixed dimension

Not everything here is open-family arithmetic. `Basis(B)` and `AlgebraDimension(B)` are
questions about a chosen finite span, and everything built on its pseudoscalar I — the Hodge
star and dual/undual, the regressive product (PGA's meet), orientation — needs that span
fixed, because I is the top-graded product of _all_ of an algebra's generators, an answer
that isn't stable while a family can still grow. Arithmetic, reversion, grade involution,
norms and versor inverses don't: they're per-unit or per-product, so they work whether or not
anyone has fixed an algebra around the units involved.

## 6. Places, via the adeles

Over ℚ a quaternion algebra B = (a, b) is classified by its **ramified places**: a finite
set of even size, drawn from the primes and ∞. At each place v, B ⊗ ℚ_v is either split,
M₂(ℚ_v), or the unique quaternion division algebra over ℚ_v, and the Hilbert symbol (a, b)_v
decides which: −1 ramifies, +1 splits. (−1, −1) ramifies at exactly 2 and ∞; (−1, 3) at 2
and 3; (1, 1) nowhere, which is M₂(ℚ).

The same picture places units. √−1 lies in ℚ_p exactly when p ≡ 1 (mod 4), so at those
places Gaussian `i` has an image: two p-adic square roots of −1, one per prime above p. That
image is a **completion applied to a global unit**, `Completion(x, v)`, landing on an
`AdicNumeral`: not a new unit. At ∞, the embeddings of a number field into ℝ or ℂ are its
infinite places (Mathlib's `NumberField.InfinitePlace`): `GaussianRationals` has one complex
place, the conjugate pair i ↦ ±ImaginaryUnit; ℚ(√2) has two real ones. "Several units at ∞"
is several embeddings of one unit. The same head on an algebra, `Completion(B, v)`, is the
base change B ⊗ ℚ_v, so elements and their parent complete together.

The adeles package already holds the global-to-local machinery over ℚ: `ProfiniteNumber`,
`Adele`, `Idele`, with components at each p as `AdicNumeral`s. To carry algebras it needs:

- `HilbertSymbol(a, b, v)` at primes and ∞, from the Kronecker symbol and the valuations the
  number-theory packages already have (not in Mathlib: extension);
- `RamifiedPlaces(B)` and `ReducedDiscriminant(B)`, derived from it;
- p-adic square roots (Hensel lifting on `AdicNumeral`), so `Completion` of a quadratic unit
  is a value;
- `Completion(B, v)` returning a matrix algebra or the local division algebra, and later
  adelic points of B.

Over a number field this waits on the number-field layer the adeles package's next phase
needs anyway. Sage's adeles library, the package's oracle, recently accepted our fix PR, so
that oracle stays usable against a current Sage.

## 7. Prior art, and what already exists

- **Mathlib**: `QuaternionAlgebra`, `Quaternion` (ℍ[R]) with `star` and `normSq`;
  `CliffordAlgebra Q`, its even part, and its equivalences with ℂ and ℍ; `Algebra R A`,
  `Subalgebra`, `AlgHom`, `AlgEquiv`; `Algebra.norm` and `Algebra.trace` (determinant and
  trace of multiplication); `NumberField.InfinitePlace`, p-adic numbers and adic completions.
  No Hilbert symbol or quaternion ramification that we found.
- **Sage** is the oracle. `QuaternionAlgebra(K, a, b)` with `.gens()`, `.invariants()`,
  `.ramified_primes()` (finite only; ∞ is implied by parity), `.discriminant()`,
  `.is_division_algebra()`, `.is_matrix_ring()`; `hilbert_symbol(a, b, p)` with p = −1 for ∞;
  orders and `.maximal_order()`; elements with `.reduced_norm()` and `.conjugate()`. Enough to
  check every head in the first slice.
- **Wolfram** has no built-in quaternion type. The `Quaternions`` add-on gives
`Quaternion[a, b, c, d]`over ℝ with`**`, plus integer-quaternion GCDs; nothing in general
(a, b), no Hilbert symbol. `FiniteField`/`FiniteFieldEmbedding`are the nearest analogue
of "a field as a value, with explicit embeddings";`NumberField*` is its naming precedent
  for number-field invariants.
- **compute-engine** has `ImaginaryUnit` and complex arithmetic, nothing noncommutative. Its
  `Multiply` is commutative and sorts operands during canonicalisation, which is why the
  ordered products are their own heads.
- **This repo**: the hypercomplex package fixes units by a six-family grid (square ×
  commutes), families named by symbol prefix; `CliffordAlgebra` and its sibling
  constructors; the named `Quaternions` (= Cl(0, 2)), `BicomplexNumbers` and friends; `Basis`,
  `AlgebraDimension`, `AlgebraSignature`, `NonCommutativeMultiply`, `Norm`; the geometric
  package on top of Clifford. All of them now conform through `clifford_algebra`.

How the design subsumes it: the constructors stay, as finite spans whose units are
`Unit(family, k)` (§2). The families stop being fixed to one algebra and become the open
things §2 describes; the default bindings of §3 are what a context gets when it names none.
`Quaternions` becomes an alias for one model of ℍ. `Basis`, `AlgebraDimension` and
`AlgebraSignature` take any presented algebra; `AlgebraDimension` is no longer always 2ⁿ,
even though the quaternion algebra happens to fit.

**`Norm` is a collision to fix, not only a decision.** Ours is the determinant of
multiplication, Mathlib's `Algebra.norm`: `Norm(3 + 4 i_1)` is 25. compute-engine's `Norm` of
`3 + 4 ImaginaryUnit` is 5. Same head, different meanings. Rename ours `AlgebraNorm`, and give
the quaternion reduced norm its own head (§9).

## 8. Relation to structures

design/structures.md makes a head require structure and a type provide it, through
compute-engine protocols with `refines` as data. #364 conformed each algebra family's
_name_ type to `FiniteDimensionalAlgebra` and left the ordered product as a registry
(`registerProduct`) "until elements have types". This design gives them types. Three seams:

**1. Element-level conformance: yes.** `Unit(family, k)`, and every element built from it,
carries a type minted by the families and indices it actually uses — not by whichever
algebra happens to view it. Two `Clifford` units and a `Grassmann` unit make one element
type; which named algebras that type also conforms to is a separate question, answered by
inclusion (§1), not fixed at construction. That type conforms to `Ring`, `StarRing` for
conjugation and, later, `Module` over the base, exactly where Mathlib puts `Algebra R A`. The
algebra's name type keeps `FiniteDimensionalAlgebra`, as a Sage parent: `Basis` and
`AlgebraDimension` are questions about the algebra, the product is a question about elements.
Once a family's elements are typed, its product dispatches on them and it leaves the
registry. The algebra's parameters live in the value, not the type, unless compute-engine's
types can carry them. The member dispatches on its first operand's type only, so operands
from families with no declared relation decline inside the member rather than failing the
type check.

**Bridge while families migrate.** Once `NonCommutativeMultiply` is a protocol member, the
protocol declares the head, and an untyped operand gets `protocol-implementation-missing` where
today it gets a registry answer. So structures wraps the member head: member dispatch first,
then the `registerProduct` registry as a fallback. `GeometricProduct` and `CircleTimes` stay
registry heads until their families move. The fallback and `registerProduct` are deleted with
the last family.

**2. Ring operations: split them.** Keep `Add` and `Negate` as compute-engine's. Addition is
commutative in every ring, so canonical sorting is harmless there, and wrapping `Add` would put
a gate on the hottest head in the engine and still run after canonicalisation. The product is
different: `Multiply` sorts its operands before any handler runs, so a noncommutative ring
cannot ride on it. So `Ring` stays Mathlib's `Ring`, possibly noncommutative, and gains the
product as a member: `NonCommutativeMultiply`, already our own head rather than compute-engine's,
with juxtaposition still routed to it at the `InvisibleOperator` seam. A new `CommutativeRing`
marker refines `Ring` for carriers whose product is compute-engine's `Multiply`; `real` conforms
to both, with `NonCommutativeMultiply` implemented as `Multiply`, so numbers keep the native
path. `FloorRing` still refines `Ring`, unchanged.

**`Conjugate` reaches `Star`.** A `StarRing` protocol (Mathlib's name) refines `Ring` with one
member, `Star`. `Conjugate` joins structures' generic heads: a non-number dispatches to `Star`,
the way `Min` reaches `Compare`, and numbers stay native.

Open: whether
compute-engine's `Add` accepts non-number operand types at all, or needs the widened signature
the order heads got. To probe before building.

**3. Naming.** Every proposed head, member and protocol was checked against compute-engine
0.139's definitions (`lookupDefinition`, bare and with every package declared) and against the
repo's records. `CommutativeRing` and `StarRing` are free too.

| name                                                 | status                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Unit`                                               | free (checked bare and against the repo's records; see §2)                                            |
| `QuaternionAlgebra`                                  | free; Mathlib's name                                                                                  |
| `HilbertSymbol`, `RamifiedPlaces`                    | free; extensions                                                                                      |
| `Completion`                                         | free                                                                                                  |
| `AlgebraHomomorphism`, `AlgebraEquivalence`          | free; Mathlib's `AlgHom`, `AlgEquiv` spelled out                                                      |
| `CayleyDickson`                                      | free; extension                                                                                       |
| `ReducedNorm`, `ReducedTrace`, `ReducedDiscriminant` | free                                                                                                  |
| `AlgebraNorm`                                        | free; Mathlib's `Algebra.norm`                                                                        |
| `Star` (member)                                      | free in compute-engine and the records; Mathlib's `star`                                              |
| `Discriminant`, `Norm`, `Trace`, `Conjugate`         | compute-engine's (polynomial discriminant, vector norm, matrix trace, complex conjugate): not widened |
| `GaussianRationals`                                  | an existing carrier record: reuse, don't redeclare                                                    |

`Conjugate` is the one compute-engine head worth routing through, since quaternion conjugation
is the same involution complex conjugation is. `Norm`, `Trace` and `Discriminant` mean
something else on an algebra, so they get the `Reduced…` names instead. `ReducedNorm` over
Mathlib's `normSq` is a departure, marked as one: `normSq` reads as the square of a norm, which
is wrong for an indefinite algebra.

**New rows for the hierarchy table** in design/structures.md, added there when they are built:

| protocol          | refines | members                  | laws                                                                           | Mathlib    |
| ----------------- | ------- | ------------------------ | ------------------------------------------------------------------------------ | ---------- |
| `Ring`            | --      | `NonCommutativeMultiply` | a ring: associative, distributive, unital; `Add` and `Negate` compute-engine's | `Ring`     |
| `CommutativeRing` | `Ring`  | --                       | the product commutes; it is compute-engine's `Multiply`                        | `CommRing` |
| `StarRing`        | `Ring`  | `Star`                   | an involutive anti-automorphism                                                | `StarRing` |

The element types (`quaternion_element`, `clifford_element`, …) conform to `Ring` and
`StarRing`, and their algebras' name types keep `FiniteDimensionalAlgebra`. The two extensions
are `Unit` and `QuaternionAlgebra`'s characteristic-2 restriction. `HilbertSymbol` and
`RamifiedPlaces` are plain heads, not protocols.

## 9. First slice

- `QuaternionAlgebra(K, a, b)` over ℚ (a number field later), with `Unit`, a typed element
  whose product is its own `NonCommutativeMultiply` member, `Conjugate` via `Star`,
  `ReducedNorm` and `ReducedTrace`, and `Basis` / `AlgebraDimension` through the existing
  protocol.
- `HilbertSymbol(a, b, v)` and `RamifiedPlaces(B)`, ∞ included.
- `Ring` with its product member, `CommutativeRing`, `StarRing`, and the registry bridge.
- `Quaternions` changes type. #364 made it a typed constant of `clifford_algebra`, for `Basis`
  and `Element` dispatch; that is also why its two examples lost their Wolfram rows, since it is
  now defined rather than free. As an alias of `QuaternionAlgebra(Reals, -1, -1)` it takes the
  quaternion algebra's name type instead. `Basis(Quaternions)` then returns (1, i, j, k) as
  `Unit(Clifford, 1)`, `Unit(Clifford, 2)` and their product, printed under a binding, not the
  Cl(0, 2) blades `f_1`, `f_2`, `f_1f_2`. Cl(0, 2) keeps its blades and reaches ℍ through the
  equivalence of §4.
- Rename the hypercomplex `Norm` to `AlgebraNorm`.
- Respell the existing quaternion examples with `Unit`, so the oracle rows compare values,
  not free symbols.
- Every example checked against Sage; a Wolfram binding only where the `Quaternions`` package
  covers it (a = b = −1, over ℝ).

Not in the slice: homomorphisms between models, completions of units, `Completion(B, v)`,
orders, a declared per-index `Clifford` signature (§2).

## Open

- **`k`, and derived names generally.** Is a basis element other than a unit ever a
  head-level value, or only ever `i·j` under a binding?
- **`Clifford`'s signature.** Per index (state carried on or beside the unit) or per family
  (today's `e_k`/`f_k` split, kept as two families instead of one)? §2 leans toward per
  index; not decided.
- **Where does a binding live for a reference example?** A per-example `bindings` field the
  notatio form renders under, or captions only?
- **Ramified places including ∞.** Sage returns finite primes only. Match Sage and add a
  separate definiteness test, or return ∞ and note the difference in the binding?
- **Element canonical form.** A coefficient vector as the value, printing blades only as
  notatio, or the ordered-`Multiply` blade spelling the hypercomplex package uses now?
- **The unit families.** Do `e_k` / `f_k` stay parseable symbols that canonicalise to
  `Unit(…)`, or become printed names only?
