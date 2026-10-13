import { type Engine, type Expr, integerAt, operandsOf } from "@enumeratio/engine";
import { conform } from "@enumeratio/structures";

// Permutations of one n under the weak order (https://github.com/enumeratio/enumeratio/wiki/Structures), Sage's
// `permutohedron_lequal` with its default `side="right"`: p ≤ q when the inversion set of p is
// contained in q's, where an inversion is a pair of VALUES a < b with b before a in the word.
// (The left order compares pairs of positions instead: this order on inverses.) The identity is
// the bottom, the reversal the top. A lattice, so `Min` is the meet and `Max` the join: a join's
// inversion set is the transitive closure of the union; a meet's non-inversions are the closure
// of the union of the non-inversions. Words of different length have no meet.

/** A set of pairs (a, b), 0 <= a < b < n, as a * n + b. */
type Pairs = Set<number>;

const wordOf = (p: Expr): number[] | undefined => {
  const word = operandsOf(operandsOf(p)[0]).map(integerAt);
  return word.every((x): x is number => x !== undefined) ? word : undefined;
};

/** The pairs of values (a, b) with b before a. */
function inversions(word: readonly number[]): Pairs {
  const n = word.length;
  const out: Pairs = new Set();
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (word[i]! > word[j]!) out.add(word[j]! * n + word[i]!);
  return out;
}

/** Closed under (a, b), (b, c) => (a, c); Warshall's order, the middle value outermost. */
function close(pairs: Pairs, n: number): Pairs {
  const out = new Set(pairs);
  for (let b = 0; b < n; b++)
    for (let a = 0; a < b; a++)
      if (out.has(a * n + b)) for (let c = b + 1; c < n; c++) if (out.has(b * n + c)) out.add(a * n + c);
  return out;
}

/** The word whose inversion set is `pairs`: a value sits after the smaller values that don't invert with it
 *  and the larger values it does. */
function fromInversions(pairs: Pairs, n: number): number[] {
  const word = new Array<number>(n);
  for (let v = 0; v < n; v++) {
    let position = 0;
    for (let u = 0; u < v; u++) if (!pairs.has(u * n + v)) position++;
    for (let u = v + 1; u < n; u++) if (pairs.has(v * n + u)) position++;
    word[position] = v;
  }
  return word;
}

/** Both words, 0-based; undefined unless both are permutations of one n. */
function wordsOf(a: Expr, b: Expr): [number[], number[]] | undefined {
  const [x, y] = [wordOf(a), wordOf(b)];
  if (x === undefined || y === undefined) return undefined;
  const ok = (w: readonly number[]) =>
    w.length === x.length && new Set(w).size === w.length && w.every((v) => v >= 1 && v <= w.length);
  return ok(x) && ok(y) ? [x.map((v) => v - 1), y.map((v) => v - 1)] : undefined;
}

const subset = (a: Pairs, b: Pairs): boolean => [...a].every((p) => b.has(p));

export function declarePermutationOrders(ce: Engine): void {
  const permutation = (word: readonly number[]) =>
    ce.function("Permutation", [
      ce.function(
        "List",
        word.map((v) => ce.number(v + 1)),
      ),
    ]);

  conform(ce, "permutation", {
    PartialOrder: {
      Compare: (a, b) => {
        const words = wordsOf(a, b);
        if (words === undefined) return ce.NaN;
        const [p, q] = [inversions(words[0]), inversions(words[1])];
        const [below, above] = [subset(p, q), subset(q, p)];
        return ce.number(below && above ? 0 : below ? -1 : above ? 1 : Number.NaN);
      },
    },
    Lattice: {
      LeastUpperBound: (a, b) => {
        const words = wordsOf(a, b);
        if (words === undefined) return undefined;
        const n = words[0].length;
        const union = new Set([...inversions(words[0]), ...inversions(words[1])]);
        return permutation(fromInversions(close(union, n), n));
      },
      GreatestLowerBound: (a, b) => {
        const words = wordsOf(a, b);
        if (words === undefined) return undefined;
        const n = words[0].length;
        const absent = (word: readonly number[]): Pairs => {
          const inverted = inversions(word);
          const out: Pairs = new Set();
          for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (!inverted.has(i * n + j)) out.add(i * n + j);
          return out;
        };
        const joined = close(new Set([...absent(words[0]), ...absent(words[1])]), n);
        const meet: Pairs = new Set();
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (!joined.has(i * n + j)) meet.add(i * n + j);
        return permutation(fromInversions(meet, n));
      },
    },
  });
}
