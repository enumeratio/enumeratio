# @enumeratio/groupalgebra

Group-algebra extensions for compute-engine: cyclic, dihedral and product groups, their
group algebras, conjugacy classes and centres. The group algebra $k[G]$ is the most
elementary construction in this section of the catalogue — its basis is just the group's
elements — and the point of the package is the **centre**: a canonical commutative
subalgebra spanned by class sums, one per conjugacy class. See
[the guide](docs/group-algebras.md).

## Declaring

```ts
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareGroupAlgebra } from "@enumeratio/groupalgebra";

const ce = new ComputeEngine();
declareGroupAlgebra(ce);
```

## Heads

- **Groups** — [`CyclicGroup`](https://enumeratio.dev/reference/symbol/CyclicGroup),
  [`DihedralGroup`](https://enumeratio.dev/reference/symbol/DihedralGroup),
  [`PermutationGroup`](https://enumeratio.dev/reference/symbol/PermutationGroup),
  [`AlternatingGroup`](https://enumeratio.dev/reference/symbol/AlternatingGroup),
  [`GroupOrder`](https://enumeratio.dev/reference/symbol/GroupOrder),
  [`GroupGenerators`](https://enumeratio.dev/reference/symbol/GroupGenerators),
  [`GroupElements`](https://enumeratio.dev/reference/symbol/GroupElements)
- **The algebra** — [`GroupBasis`](https://enumeratio.dev/reference/symbol/GroupBasis),
  [`ClassSum`](https://enumeratio.dev/reference/symbol/ClassSum),
  [`ConjugacyClasses`](https://enumeratio.dev/reference/symbol/ConjugacyClasses)
- **Permutations** — [`Cycles`](https://enumeratio.dev/reference/symbol/Cycles),
  [`PermutationCycles`](https://enumeratio.dev/reference/symbol/PermutationCycles),
  [`PermutationList`](https://enumeratio.dev/reference/symbol/PermutationList),
  [`PermutationReplace`](https://enumeratio.dev/reference/symbol/PermutationReplace),
  [`Permute`](https://enumeratio.dev/reference/symbol/Permute),
  [`InversePermutation`](https://enumeratio.dev/reference/symbol/InversePermutation)

`src/group.ts` also exports the underlying group model (`directProduct`, `isAbelian`,
`isCentral`, `conjugacyClasses`) used directly by [`@enumeratio/hecke`](../hecke/README.md) and
[`@enumeratio/diagram`](../diagram/README.md) for their own symmetric-group bookkeeping.

## Usage

```
GroupIsAbelian(CyclicGroup(6))         // True
GroupIsAbelian(DihedralGroup(4))       // False
IsCentral(DihedralGroup(3), ClassSum(DihedralGroup(3), 2))   // True
```

## Next

The guide walks through why every group's centre is commutative even when the group
itself is not, and how the class-sum basis connects to irreducible characters.
