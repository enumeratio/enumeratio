# @enumeratio/structures

Mathematical structure as compute-engine protocols ([Structures](https://github.com/enumeratio/enumeratio/wiki/Structures)): a
generic head requires structure, a type conforms to it. `Min` works on anything with a total
order, `Floor` on anything whose order has ticks, `Basis` on anything that is a
finite-dimensional algebra — including a type declared in a notebook, as long as it says
(and satisfies) what it is. Depends only on [`engine`](../engine/README.md).

Reference entries for the generic heads (`Min`, `Floor`, `Basis`, …) live under
`reference/` here, per the layout in AGENTS.md "Reference entries".

## Entry points

`.` (`src/index.ts`) calls `declareStructures(ce)` to install everything below, and
re-exports it all individually:

- **`protocols.ts`** — `PROTOCOLS`, `ensureProtocols`, `ancestry`: named structures as
  member signatures in compute-engine's type grammar, with `refines` for compute-engine's
  missing refinement.
- **`conform.ts`** — `conform`/`Conformance`, `member`, `compare`: does a type conform to a
  protocol, and dispatch a member on the first argument's type.
- **`generic.ts`** — `declareGenericHeads`: widens `Min`/`Max`/`Clamp`/`Floor`/`Ceil`/`Round`
  to dispatch through conformance once the native real/unknown path doesn't apply.
- **`algebra.ts`** — `declareAlgebra`, `ensureAlgebraHeads`, `registerProduct`: types whose
  values name an algebra (`HeckeAlgebra(3)`) conform to `FiniteDimensionalAlgebra`; products
  are registered per library until they get a protocol of their own.
- **`operations.ts`** — `registerOperation`/`registerCarrier`/`registerCollectionCarrier`,
  `operationOf`, `OperationCollisionError`: the operation/carrier registry generic heads
  dispatch through.
- **`carriers.ts`** — `declareCarriers`/`declareCarrierElement`/`declareCarrierPlurals`,
  `Carrier`, `typeFor`, `contentsOf`, `attachConversion`.
- **`representation.ts`** — `Representation`/`Medium`, `REPRESENTATIONS`,
  `LATEX_REPRESENTATIONS`, `canonicalFor`, `representationsFor`.
- **`restriction.ts`** — `declareRestricted`/`declareRestrictions`, `Restriction`: a
  restriction is a set over a carrier (a derangement is permutations filtered, not a
  subtype), so the carrier's statistics keep working.
- **`compose.ts`** — `declareCompose`/`applyComposition`.
- **`numbers.ts`**, **`extend.ts`** — `conformNumbers` (built-in numeric types' protocols),
  `extendBuiltin`/`privateNameFor`/`publicName` (the private-suffix seam for widening a
  built-in without colliding with it).

## Commands

```sh
vp check
vp test
vp pack   # build dist (also: vp pack --watch)
```

## Next

Read [Structures](https://github.com/enumeratio/enumeratio/wiki/Structures) before adding a protocol or a generic head — it has
the full table of which head needs which structure, and why.
