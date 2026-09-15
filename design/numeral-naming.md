# Design: naming the numeral systems

Status: **draft / needs a decision**. An audit of the numeral-system heads against prior
art, and a proposal. The renames are not made yet — §4 is the fork.

## 1. The problem

The heads grew one at a time and the suffixes disagree. Some are `…Radix`, some are
`…System`, some are a bare proper noun:

`MixedRadix`, `BalancedRadix`, `NegativeRadix`, `BijectiveRadix`, `PrimorialRadix`,
`Factoradic`, `Zeckendorf`, `Ostrowski`, `CombinatorialSystem`, `ResidueSystem`.

Three suffix conventions for one concept, and no way to tell from a name whether something
is a system, a base, or a function. It also reads badly in the one place it matters — the
base slot of `IntegerDigits`, where every one of these appears as a value.

Related: the guide's heading counted them ("Ten systems in one slot"), which is a number
guaranteed to go stale. Now "One slot, many systems".

## 2. Prior art

What each system is actually called in the literature and in other systems. This is the
column that should drive the naming, and it is also what the
[oracle mappings](../packages/oracle/src/mappings.ts) will need.

| Ours                  | Standard name                    | Elsewhere                                 |
| --------------------- | -------------------------------- | ----------------------------------------- |
| `MixedRadix`          | mixed radix                      | Wolfram `MixedRadix` — exact match        |
| `Factoradic`          | **factorial number system**      | the digits are the Lehmer code            |
| `PrimorialRadix`      | **primorial number system**      | —                                         |
| `BalancedRadix`       | balanced base / balanced ternary | —                                         |
| `NegativeRadix`       | **negative base** (negabinary…)  | —                                         |
| `BijectiveRadix`      | **bijective numeration**         | spreadsheet columns are bijective base 26 |
| `Zeckendorf`          | Zeckendorf representation        | the α = φ case of Ostrowski               |
| `Ostrowski`           | Ostrowski numeration             | —                                         |
| `CombinatorialSystem` | **combinatorial number system**  | "combinadics"; colex k-subset unranking   |
| `ResidueSystem`       | **residue number system** (RNS)  | —                                         |

Two things fall out. "Radix" is wrong for four of them — a factorial, primorial or
Fibonacci system has no radix, it has a sequence of place values — and the literature says
"number system" far more often than "radix". And `Factoradic` is a nickname; the formal
name is the factorial number system.

## 3. What is missing from the set

- **`PositionalNumerals`** — there is no head for "ordinary base b" as a _system value_,
  only compute-engine's integer base slot. Giving the family a name would let the base slot
  be uniformly a system rather than sometimes an integer.
- ~~Hensel / p-adic place values~~ — done as `AdicNumerals(b, prec?)` in the slot and
  `AdicNumeral(b, x, prec?)` as the value, with arithmetic, valuation and Hensel lifting.
  Composite b included. Named with the `…Numerals` suffix of option A below, so it is the
  first head on that convention; the rest still wait on the decision.
- **`BaseForm`.** Wolfram's `BaseForm[n, b]` is a _display_ wrapper, not a digit extractor.
  We have no display side at all; `IntegerDigits` returns the digits and nothing renders
  them back as a numeral string. That is a real gap, and it is the natural home for the
  alphabet question (`BijectiveRadix(26)` → `"AAA"` rather than `[1,1,1]`).

## 4. The fork

**Option A — suffix everything `Numerals`.** `FactorialNumerals`, `BalancedNumerals`,
`BijectiveNumerals`, `ZeckendorfNumerals`, `OstrowskiNumerals`, `ResidueNumerals`,
`CombinatorialNumerals`, `MixedRadixNumerals`, `PositionalNumerals`.

- Uniform, and reads correctly in the base slot: `IntegerDigits(n, ZeckendorfNumerals)`.
- Loses the Wolfram match on `MixedRadix`.
- Ten renames, all of them public surface.

**Option B — suffix `NumberSystem`, following the literature.** `FactorialNumberSystem`,
`ResidueNumberSystem`, … Most faithful to prior art, and the longest.

**Option C — keep `Radix` where there is a radix, `System` where there is not.**
`MixedRadix` and `BalancedRadix` keep their names; `Factoradic` → `FactorialSystem`,
`PrimorialRadix` → `PrimorialSystem`, `BijectiveRadix` → `BijectiveSystem`. Smallest change
that removes the actual error, but leaves two conventions standing.

**Recommendation: A**, with the old names kept as aliases. It is the only option that makes
the base slot read uniformly, which is the place these names are actually used; "numerals"
is accurate for all of them in a way "radix" is not for four; and the `MixedRadix` Wolfram
match is preserved by the alias rather than lost. Aliases also mean the rename is not a
breaking change, which is what makes ten of them tolerable.

Whatever is chosen, the aliases should be **data** — one table mapping alias → canonical —
so the reference pages, the oracle mappings and the parser all read the same source.

## 5. Settled, and done

- **Zero in a bijective base is the empty numeral.** It used to decline. Bijective
  numeration is a bijection from the NON-NEGATIVE integers onto finite strings over
  $\{1..k\}$, and the empty string is the one left for zero — so declining left the round
  trip undefined at the only interesting point. Fixed, with the round trip now pinned
  from 0.

## 6. A related question: siblings, and namespace size

Raised while auditing the collection heads, and it generalises past numerals.

`Tuples` and `Words` are order-isomorphic, and it is tempting to keep one. But a name for a
family carries more than its elements: it implies a representation, an ordering, and how
much structure is being claimed. Those are real distinctions and enumeratio already models
them — sibling collections sharing stats and maps through an order-isomorphism, one carrier
and one canonical order each. Collapsing them loses the distinction; keeping both costs
almost nothing but namespace.

Which suggests the Wolfram answer: let the namespace be large, and fix the discoverability
with tooling rather than by deleting names. Default the reference index to a curated set,
let search reach everything, and make the sibling relation itself queryable so
`Tuples` can say what it is isomorphic to and how. The cost is a table, not code.

The open question is whether every collection wants a HEAD, or whether a family is better
addressed as a value — `Collection("weak_compositions")` — with heads reserved for the ones
that earn notation. 41 heads is comfortable; the ~270 in enumeratio is not obviously so, and
the answer probably differs for collections (many, mechanical) versus stats and maps (fewer,
each with real notation).
