# Design: which names are ours, and which are Wolfram's

Split from design/symbols.md: §5 Open.

## Open

- **Numeral systems as domains.** The systems are already values rather than heads —
  `IntegerDigits(n, Zeckendorf)` — which is the Wolfram model and needs no collapsing. The
  open idea is larger: represent numerals as polynomial-like domains, so a numeral is an
  object with structure rather than a digit list, and the systems become mappable onto the
  other structures they secretly are (factoradic is the Lehmer code; the combinatorial system
  is subset unranking).
- **`modular` is the least normalised package** — 34 heads, heavily prefixed (`Form*`,
  `Modular*`), several of them (`FormRho`, `LinkingWithTrefoil`, `WordSymbol`) named for the
  implementation rather than the mathematics. No Wolfram counterpart to align against, which
  is precisely why it drifted.
