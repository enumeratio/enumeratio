// The cactus evacuation of a permutation as a fast path. Its Epsil is `cactusEvacuation` in ./flat.ts, which
// tests/map-kernels.test.ts holds this to.

/** The insertion tableau of `word`, by row insertion. */
function insertionTableauOf(word: readonly number[]): number[][] {
  const rows: number[][] = [];
  for (const entry of word) {
    let carried: number | undefined = entry;
    for (const row of rows) {
      const bumped = row.findIndex((x) => x > carried!);
      if (bumped < 0) {
        row.push(carried);
        carried = undefined;
        break;
      }
      [row[bumped], carried] = [carried, row[bumped]!];
    }
    if (carried !== undefined) rows.push([carried]);
  }
  return rows;
}

/** The word whose insertion tableau is `p` and recording tableau is `q`: each cell of `q` from the
 *  largest entry down leaves both tableaux, and `p`'s entry there bumps back up through the rows above. */
function inverseRskOf(p: number[][], q: number[][], size: number): number[] {
  const word = Array.from<number>({ length: size });
  for (let k = size; k >= 1; k--) {
    const r = q.findIndex((row) => row[row.length - 1] === k);
    q[r]!.pop();
    if (q[r]!.length === 0) q.pop();
    let carried = p[r]!.pop()!;
    if (p[r]!.length === 0) p.pop();
    for (let above = r - 1; above >= 0; above--) {
      const row = p[above]!;
      const pos = row.findLastIndex((x) => x < carried);
      [row[pos], carried] = [carried, row[pos]!];
    }
    word[k - 1] = carried;
  }
  return word;
}

/** A fast path for the cactus evacuation of a permutation of 1..n; `undefined` for anything else. */
export function cactusEvacuationKernel(word: readonly number[]): number[] | undefined {
  const n = word.length;
  if (new Set(word).size !== n || word.some((x) => !Number.isInteger(x) || x < 1 || x > n)) return undefined;
  const inverse = Array.from<number>({ length: n });
  word.forEach((x, i) => (inverse[x - 1] = i + 1));
  const evacuated = inverse.map((_, j) => n + 1 - inverse[n - 1 - j]!);
  return inverseRskOf(insertionTableauOf(word), insertionTableauOf(evacuated), n);
}
