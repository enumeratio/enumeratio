# cardinality

*The size of a collection — $|C|$.*

## Usage

| Form | Meaning |
|---|---|
| $\lvert C \rvert$ | the LaTeX spelling — parses to the `Count` MathJSON head |
| $\#C$ | the alternate LaTeX spelling, same head |
| `Count(C)` | the MathJSON/AST form both of the above produce |

## Details

- **Kind:** one of three *generic* engine primitives bound directly by head name in
  `packages/expressions/src/names.ts`'s `OPERATORS` table (`Element` → `contains`, `At` → `element_at`, `Count`
  → `cardinality`) — unlike `unrank`/`rank`/`next`/`prev`/`random_element`, these three ARE recognized purely by
  their MathJSON head, no argument-type dispatch needed.
- **Result type:** `natural_number`, unconditionally — `typeCardinality` in `packages/expressions/src/bind.ts`
  type-checks the operand (for error propagation) but does not require it to actually be a collection handle;
  a malformed argument surfaces whatever error typing *that* argument produces, not a `cardinality`-specific one.
- **Evaluation:** lowers to CE's own `Length(C)` (`packages/client/src/ce-enum-engine.ts`), which reads the
  collection's `count` handler directly — a closed-form lookup (e.g. $n!$, $2^n$, $p(n)$), never an enumeration.
  $O(1)$ regardless of $C$'s size.
- **Not (yet) wired to `Abs`:** compute-engine's own `Abs`/`|x|` head has no curated binding in this catalog at
  all (`UNMAPPED_HEADS_NO_CURATED_ID` in `names.ts`) — `|C|` reaches `cardinality` only via the dedicated `Count`
  binding, not by generically routing `Abs` applied to a collection handle through cardinality. A design that
  makes `Abs` itself collection-aware would be a change to `names.ts`/`bind.ts`, not something already in place.

## Examples

$\lvert \operatorname{SymmetricGroup}(5) \rvert = 5! = 120$

$\#\operatorname{Subsets}(10) = 2^{10} = 1024$

## See also

[`unrank`](/reference/unrank) (the bound its index ranges over) · [`rank`](/reference/rank) ·
[`random_element`](/reference/random-element) · `Element` (`x \in C` — membership, the other generic head-bound
primitive) · `At` (`L[i]` — the other one)
