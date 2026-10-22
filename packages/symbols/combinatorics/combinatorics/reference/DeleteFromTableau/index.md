---
name: DeleteFromTableau
domain: Combinatorics
signature: DeleteFromTableau(tableau, r)
summary: Reverse row insertion at the end of row $r$ of a Young tableau, the step inverse RSK repeats.
signatures:
  - call: DeleteFromTableau(tableau, r)
    description: the tableau without the last cell of row `r`, its entry bumped back up the rows above.
    library: enumeratio-combinatorics
    type: (list, integer) -> unknown
seeAlso:
  - ToPermutation
  - Rsk
  - RskInsertion
  - StandardTableaux
catalog:
  - system: combinatorica
    identity: DeleteFromTableau
    note: same value on every tableau of distinct entries whose row ends in a corner.
bindings:
  - origin: mapped
    form: combinatorica
    template: DeleteFromTableau[$1, $2]
    arity: 2
    note: Combinatorica checks no corner, so it also answers for a row that is not one, with a result that is no tableau; ours stays unevaluated there.
---

- Row insertion undone. The last cell of row $r$ leaves; its entry $x$ goes to row $r-1$ and takes the place of the largest entry smaller than $x$, which goes up in turn, and so on to row 1, where the entry that comes out is dropped. Inserting that entry into the result bumps along the same path and puts $x$ back at the end of row $r$.
- Inverse RSK is this step repeated: [[ToPermutation]] removes the cell of $n$ in the recording tableau, then $n-1$, and so on, and each deletion from the insertion tableau drops the next letter, last first.
- The tableau is a list of rows. Rows weakly increase and columns strictly increase (a semistandard tableau; a standard one has distinct entries), and row $r$ must end in a corner: it is the last row or longer than the one below it. Anything else, a row out of range or an entry that is no small integer, leaves the call unevaluated.
- The result keeps the entries but the dropped one, so it is a tableau of those entries, not a standard one: $\{\{1,3\},\{2\}\}$ at row 2 gives $\{\{2,3\}\}$.
- Defined in Epsil as a fold up the rows above $r$; the domain check is the only TypeScript. `tests/delete-from-tableau.test.ts` peels the RSK pair of every permutation up to $n=4$ and holds each step to a separate row insertion.
- Combinatorica's name and value. Not a Wolfram head; [[Rsk]] is the forward direction, the insertions of all the letters at once.
