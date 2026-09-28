# Design: units belong to algebras

Speculative. Three claims, then what they cost:

1. **A unit is a value of its algebra**, `Generator(A, k)`, not a symbol. What it squares
   to and what it commutes with are relations in `A`'s presentation.
2. **A name like `i` is presentation**, bound in a context. Values settle ambiguity;
   names never do.
3. **One algebra has several models and several local pictures.** Isomorphisms, embeddings
   and completions are maps between values, so "the `i` of ℍ", "Gaussian `i`" and "a square
   root of −1 in ℚ₅" are three different things joined by explicit maps.

All of this is enumeratio (meaning). Which letter prints for a unit is notatio. Mathlib is
the spec for concepts and names, as in design/structures.md; every departure below is
marked **extension**.

## 1. Units are generators of a presentation

An algebra is a base ring plus a presentation: generators, and relations among them. The
relations that matter here are a square for each generator and a rule for each _pair_:
commute, anticommute, or a product given by a table. Commutativity is not a property of
one unit: `i_1` commutes with `i_2` in the bicomplex numbers and `f_1` anticommutes with
`f_2` in Cl(0, 2), and neither fact is about a single generator.

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

So Gaussian `i` is `Generator(GaussianRationals, 1)` and the quaternion `i` is
`Generator(QuaternionAlgebra(Rationals, -1, -1), 1)`. They are different values, and
adding them declines unless a context supplies an algebra containing both (a tensor
product, or an explicit embedding of one into the other, §3). `GaussianRationals` is already
a catalogued carrier; a general `QuadraticField(d)` is Sage's name and would be an extension.

**`k` is not a generator.** In `QuaternionAlgebra` it is the product `i·j`, a basis
element. `Basis(B)` returns (1, i, j, k); `Generator(B, 3)` does not exist. A context that
wants a name for it binds `k := Generator(B, 1) * Generator(B, 2)`.

**The identity is not a generator either.** It is `1`, the image of the base ring's 1
under the structure map (Mathlib's `algebraMap R A`). Conventions that write it `e_0`
(octonions, some Clifford texts) or `j_0` / `i_0` (multicomplex towers) are display names
for that identity, bound like any other name (§2). Generators index from 1, so
`Generator(A, 0)` never has to mean two things.

**ℂ is the one place compute-engine already has a value.** Its `ImaginaryUnit` is the
complex number 0 + 1i, a numeric literal with full arithmetic. `Generator(ComplexNumbers, 1)`
should canonicalise to `ImaginaryUnit` rather than shadow it. Multicomplex `i_1` is then the
image of `ImaginaryUnit` under the embedding ℂ → ℂₙ that starts the tower: an embedding,
not an identity, which is why `ImaginaryUnit · i_1 · i_1` stays a product today.

Mathlib has no indexed "k-th generator": a quaternion algebra names `i`, `j`, `k`, and a
Clifford algebra embeds its whole module by `ι`. `Generator` is an **extension**, and the
uniform handle this design needs.

## 2. Names are bound per context

`i`, `i_1`, `e_0`, `j_0` and `f_2` are display names. A notebook scope binds them:

```
H := QuaternionAlgebra(Rationals, -1, -1)
i := Generator(H, 1)
j := Generator(H, 2)
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

**Examples should spell units as values:** `[Generator, Quaternions, 1]`, not `f_1`.
`Generator` has a definition, so it is not free, and it maps cleanly: Sage
`QuaternionAlgebra(QQ, -1, -1).gens()[0]`, Wolfram `Quaternion[0, 1, 0, 0]` from the
`Quaternions`` package. Captions and the notatio form can still show `i` by rendering under
a binding.

## 3. Several models of one algebra

ℍ has at least four standard constructions:

- `QuaternionAlgebra(Reals, -1, -1)`, the presentation above.
- Clifford: all of `CliffordAlgebra(0, 2)` (i = f₁, j = f₂, k = f₁f₂, which is what the
  hypercomplex package does now), or the even part of Cl(3, 0) or Cl(0, 3). The even part of
  Cl(0, 2) is only ℂ. Mathlib states the first as an equivalence of the Clifford algebra of
  a two-dimensional form with ℍ[R, c₁, c₂], which is precedent for the map below.
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

A named algebra like `Quaternions` resolves to one chosen model, and the others carry a
canonical equivalence to it. A context picks a model the way it picks names, by binding `H`.
Results stay in the model they were computed in; moving between models is an explicit map,
never a silent coercion.

## 4. Places, via the adeles

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

## 5. Prior art, and what already exists

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

How the design subsumes it: the constructors stay, as presentations whose generators are
`Generator(A, k)`. The families become the default bindings of §2 and stop being how the
engine knows a square. `Quaternions` becomes an alias for one model of ℍ. `Basis`,
`AlgebraDimension` and `AlgebraSignature` take any presented algebra; `AlgebraDimension` is no
longer always 2ⁿ, even though the quaternion algebra happens to fit.

**`Norm` is a collision to fix, not only a decision.** Ours is the determinant of
multiplication, Mathlib's `Algebra.norm`: `Norm(3 + 4 i_1)` is 25. compute-engine's `Norm` of
`3 + 4 ImaginaryUnit` is 5. Same head, different meanings. Rename ours `AlgebraNorm`, and give
the quaternion reduced norm its own head (§7).

## 6. Relation to structures

design/structures.md makes a head require structure and a type provide it, through
compute-engine protocols with `refines` as data. #364 conformed each algebra family's
_name_ type to `FiniteDimensionalAlgebra` and left the ordered product as a registry
(`registerProduct`) "until elements have types". This design gives them types. Three seams:

**1. Element-level conformance: yes.** `Generator(A, k)`, and every element built from it,
carries a type minted by its family (`quaternion_element`, `clifford_element`, …). That type
conforms to `Ring` and, later, `Module` over the base and a star ring for conjugation (Mathlib's
`StarRing`), exactly where Mathlib puts `Algebra R A`. The algebra's name type keeps
`FiniteDimensionalAlgebra`, as a Sage parent: `Basis` and `AlgebraDimension` are questions about
the algebra, the product is a question about elements. Once a family's elements are typed, its
product dispatches on them and it leaves the registry; when the last family has moved,
`registerProduct` goes. The algebra's parameters live in the value, not the type, unless
compute-engine's types can carry them; operands from two different algebras then decline in the
member rather than failing the type check.

**2. Ring operations: split them.** Keep `Add` and `Negate` as compute-engine's. Addition is
commutative in every ring, so canonical sorting is harmless there, and wrapping `Add` would put
a gate on the hottest head in the engine and still run after canonicalisation. The product is
different: `Multiply` sorts its operands before any handler runs, so a noncommutative ring
cannot ride on it. Give the product a free member name; `NonCommutativeMultiply` is already our
own head, not compute-engine's, so it can become the member itself, with juxtaposition still
routed to it at the `InvisibleOperator` seam. `Ring` stays a marker for commutative carriers,
and a noncommutative element type conforms through the product member. Open: whether
compute-engine's `Add` accepts non-number operand types at all, or needs the widened signature
the order heads got. To probe before building.

**3. Naming.** Every proposed head and member was checked against compute-engine's definitions
(`lookupDefinition`) and against the repo's records:

| name                                                 | status                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Generator`                                          | free (only internal TypeScript types share it)                                                        |
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

`Conjugate` is the one compute-engine head worth routing through: quaternion conjugation is the
same involution complex conjugation is, so `Conjugate` of a non-number dispatches to `Star`,
the way `Min` reaches `Compare`. `Norm`, `Trace` and `Discriminant` mean something else on an
algebra, so they get the `Reduced…` names instead.

## 7. First slice

- `QuaternionAlgebra(K, a, b)` over ℚ (a number field later), with `Generator`, a typed element
  whose product is its own `NonCommutativeMultiply` member, `Conjugate` via `Star`,
  `ReducedNorm` and `ReducedTrace`, and `Basis` / `AlgebraDimension` through the existing
  protocol.
- `HilbertSymbol(a, b, v)` and `RamifiedPlaces(B)`, ∞ included.
- Rename the hypercomplex `Norm` to `AlgebraNorm`.
- Respell the existing quaternion examples with `Generator`, so the oracle rows compare values,
  not free symbols.
- Every example checked against Sage; a Wolfram binding only where the `Quaternions`` package
  covers it (a = b = −1, over ℝ).

Not in the slice: homomorphisms between models, completions of units, `Completion(B, v)`,
orders.

## Open

- **`k`, and derived names generally.** Is a basis element other than a generator ever a
  head-level value, or only ever `i·j` under a binding?
- **Where does a binding live for a reference example?** A per-example `bindings` field the
  notatio form renders under, or captions only?
- **Ramified places including ∞.** Sage returns finite primes only. Match Sage and add a
  separate definiteness test, or return ∞ and note the difference in the binding?
- **Element canonical form.** A coefficient vector as the value, printing blades only as
  notatio, or the ordered-`Multiply` blade spelling the hypercomplex package uses now?
- **Mixed arithmetic.** Should `Generator(H, 1) + Generator(GaussianRationals, 1)` decline, or
  resolve through a context's declared embeddings?
- **The unit families.** Do `e_k` / `f_k` stay parseable symbols that canonicalise to
  `Generator(…)`, or become printed names only?
- **Mathlib's `normSq` versus `ReducedNorm`.** Mathlib's name reads as the square of a norm,
  which is wrong for an indefinite algebra; the textbook and Sage say reduced norm. Take the
  departure, or follow Mathlib?
