# @enumeratio/hopf

Combinatorial Hopf algebra extensions for compute-engine: NSym and QSym on compositions,
with product, coproduct and antipode. Every other algebra in this section has a product
and nothing else; a Hopf algebra also has a coproduct, and the two must satisfy
$\Delta(x \cdot y) = \Delta(x) \cdot \Delta(y)$ — the identity the whole package is tested
against. See [the guide](docs/hopf-algebras.md).

## Declaring

```ts
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareHopf } from "@enumeratio/hopf";

const ce = new ComputeEngine();
declareHopf(ce);
```

## The two algebras

Both are indexed by compositions (ordered lists of positive parts) and dual to each
other:

|          | basis      | product       | coproduct                                  |
| -------- | ---------- | ------------- | ------------------------------------------ |
| **NSym** | $H_\alpha$ | concatenation | deconcatenation, extended multiplicatively |
| **QSym** | $M_\alpha$ | quasi-shuffle | deconcatenation                            |

## Heads

- **NSym** — [`NSymAlgebra`](https://enumeratio.dev/reference/symbol/NSymAlgebra),
  [`NSymH`](https://enumeratio.dev/reference/symbol/NSymH) (complete basis),
  [`NSymR`](https://enumeratio.dev/reference/symbol/NSymR) (ribbon basis)
- **QSym** — [`QSymAlgebra`](https://enumeratio.dev/reference/symbol/QSymAlgebra),
  [`QSymM`](https://enumeratio.dev/reference/symbol/QSymM) (monomial basis),
  [`QSymF`](https://enumeratio.dev/reference/symbol/QSymF) (fundamental basis)
- **Structure** — [`Coproduct`](https://enumeratio.dev/reference/symbol/Coproduct),
  [`Antipode`](https://enumeratio.dev/reference/symbol/Antipode),
  [`Counit`](https://enumeratio.dev/reference/symbol/Counit),
  [`HopfDegree`](https://enumeratio.dev/reference/symbol/HopfDegree),
  [`HopfTensor`](https://enumeratio.dev/reference/symbol/HopfTensor)
- **Basis conversion** — [`InCompleteBasis`](https://enumeratio.dev/reference/symbol/InCompleteBasis),
  [`InRibbonBasis`](https://enumeratio.dev/reference/symbol/InRibbonBasis),
  [`InMonomialBasis`](https://enumeratio.dev/reference/symbol/InMonomialBasis),
  [`InFundamentalBasis`](https://enumeratio.dev/reference/symbol/InFundamentalBasis),
  [`ConjugateComposition`](https://enumeratio.dev/reference/symbol/ConjugateComposition)

`src/hopf.ts` also exports the underlying `Composition`/`Element`/`Tensor` model
(`nsymProduct`, `qsymCoproduct`, `quasiShuffle`, `antipode`, …) for use without going
through compute-engine.

## Next

Both bases at degree $n$ have dimension $2^{n-1}$, one basis element per composition of
$n$ — the guide checks the compatibility identity directly against that count.
