// Collect mpmath's true images for the heads whose Interval images are proven over balls
// (src/interval-balls.ts), and write them to tests/image.golden.json. Each image is the least
// and greatest of the head's values at the interval's ends and at every critical point inside,
// each critical point found by root-finding on the derivative from a sign change on a grid of
// 400 steps, fine enough to separate every turning point these intervals hold. The tests
// check that the proven image holds this one, and how tightly.
//
// Requires python3 + mpmath on PATH. Run from the package:
//   node scripts/collect-image-goldens.ts

import { writeFileSync } from "node:fs";
import { runKernel } from "@enumeratio/oracle/bounded";

export interface ImageGolden {
  /** The head, with `null` where the interval goes. */
  readonly call: readonly (string | number | null)[];
  readonly interval: readonly [number, number];
  /** mpmath's least and greatest values on the interval, to 30 digits. */
  readonly least: string;
  readonly greatest: string;
}

// Monotonic stretches, and intervals holding G's maximum (x ≈ 1.39), its minimum (≈ 2.56) or
// both; the negative axis between two of G's zeros; Li₂ on both sides of 0; orders whose Li
// turns inside the disk; and nearly all of it.
const cases: [(string | number | null)[], [number, number]][] = [
  [
    ["BarnesG", null],
    [1.17, 1.18],
  ],
  [
    ["BarnesG", null],
    [1, 3],
  ],
  [
    ["BarnesG", null],
    [0.5, 1.5],
  ],
  [
    ["BarnesG", null],
    [2.2, 2.9],
  ],
  [
    ["BarnesG", null],
    [-1.9, -1.1],
  ],
  [
    ["LogBarnesG", null],
    [0.111, 0.112],
  ],
  [
    ["LogBarnesG", null],
    [0.3, 4],
  ],
  [
    ["PolyLog", 2, null],
    [0.7, 0.8],
  ],
  [
    ["PolyLog", 2, null],
    [-0.9, 0.9],
  ],
  [
    ["PolyLog", 0.5, null],
    [-0.5, 0.95],
  ],
  [
    ["PolyLog", -1.5, null],
    [-0.3, 0.3],
  ],
  [
    ["PolyLog", -3, null],
    [-0.5, 0.2],
  ],
  [
    ["PolyLog", 5, null],
    [-0.99, 0.99],
  ],
];

const py = `
from mpmath import mp, mpf, re, barnesg, log, polylog, diff, findroot, nstr, linspace
mp.dps = 40
heads = {
    "BarnesG": lambda x: barnesg(x),
    "LogBarnesG": lambda x: log(barnesg(x)),
    "PolyLog": lambda s, z: polylog(s, z),
}
cases = [
${cases.map(([call, [l, h]]) => `    (${JSON.stringify(call).replace(/null/g, "None")}, "${l}", "${h}"),`).join("\n")}
]
for call, l, h in cases:
    f = lambda x: re(heads[call[0]](*[x if a is None else mpf(a) for a in call[1:]]))
    l, h = mpf(l), mpf(h)
    values = [f(l), f(h)]
    grid = linspace(l, h, 401)
    slopes = [diff(f, x) for x in grid]
    for i in range(len(grid) - 1):
        if slopes[i] == 0 or slopes[i] * slopes[i + 1] < 0:
            values.append(f(findroot(lambda x: diff(f, x), (grid[i], grid[i + 1]), solver="anderson")))
    print(nstr(min(values), 30), nstr(max(values), 30))
`;
const out = (await runKernel("python3", ["-c", py], { timeoutMs: 600_000 })).trim().split("\n");
if (out.length !== cases.length)
  throw new Error(`mpmath gave ${out.length} images for ${cases.length} cases`);

const goldens: ImageGolden[] = cases.map(([call, interval], k) => {
  const [least, greatest] = out[k]!.split(" ") as [string, string];
  return { call, interval, least, greatest };
});
writeFileSync(
  new URL("../tests/image.golden.json", import.meta.url),
  JSON.stringify(goldens, null, 2) + "\n",
);
console.log(`cases ${goldens.length}`);
