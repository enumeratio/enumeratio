// Fast paths for the RSK maps (RskInsertion, RskRecording, RskShape). Their Epsil stays the meaning:
// tests/map-kernels.test.ts holds each kernel to it. One row-insertion pass serves all three.

/** Whether `word` is a permutation of 1..n. */
export function isPermutationWord(word: readonly number[]): boolean {
  const n = word.length;
  return new Set(word).size === n && word.every((x) => Number.isInteger(x) && x >= 1 && x <= n);
}

interface Pair {
  readonly insertion: readonly (readonly number[])[];
  readonly recording: readonly (readonly number[])[];
}

/** RSK by row insertion: the insertion tableau, and the recording tableau of which row each step grew. */
function rskPass(word: readonly number[]): Pair {
  const insertion: number[][] = [];
  const recording: number[][] = [];
  word.forEach((entry, k) => {
    let carried = entry;
    let r = 0;
    for (; r < insertion.length; r++) {
      const row = insertion[r]!;
      const bumped = row.findIndex((x) => x > carried);
      if (bumped < 0) {
        row.push(carried);
        recording[r]!.push(k + 1);
        return;
      }
      [row[bumped], carried] = [carried, row[bumped]!];
    }
    insertion.push([carried]);
    recording.push([k + 1]);
  });
  return { insertion, recording };
}

/** The last pass, kept: the three maps are tried on the same object one after another. */
let last: { key: string; pair: Pair } | undefined;
function rskOf(word: readonly number[]): Pair | undefined {
  if (!isPermutationWord(word)) return undefined;
  const key = word.join(",");
  if (last?.key !== key) last = { key, pair: rskPass(word) };
  return last.pair;
}

const copy = (rows: readonly (readonly number[])[]): number[][] => rows.map((row) => [...row]);

export const rskInsertionKernel = (word: readonly number[]): number[][] | undefined => {
  const pair = rskOf(word);
  return pair && copy(pair.insertion);
};

export const rskRecordingKernel = (word: readonly number[]): number[][] | undefined => {
  const pair = rskOf(word);
  return pair && copy(pair.recording);
};

export const rskShapeKernel = (word: readonly number[]): number[] | undefined =>
  rskOf(word)?.insertion.map((row) => row.length);
