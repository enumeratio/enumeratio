// BooleanPermutations defined in Epsil as completion counts over the symmetric group's lex order,
// against an independent reading: the permutations avoiding 321 and 3412, filtered from all of S_n.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { COMPILED_FAMILIES } from "../../collections/src/families/compiled-families.generated.js";
import { epsilKernelOn, kernelOn } from "../../collections/src/families/epsil.ts";
import { Factorial, PermutationUnrank } from "../../collections/src/families/kernels.ts";
import { booleanPermutations } from "../src/families/restrictions.ts";

const kernel = epsilKernelOn(bareEngine(), booleanPermutations);

/** The pattern of `values`: each entry's rank among them. */
const pattern = (values: number[]): string => {
  const sorted = values.toSorted((a, b) => a - b);
  return values.map((v) => sorted.indexOf(v) + 1).join("");
};

function avoids321And3412(p: number[]): boolean {
  const n = p.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        if (pattern([p[i], p[j], p[k]]) === "321") return false;
        for (let l = k + 1; l < n; l++) if (pattern([p[i], p[j], p[k], p[l]]) === "3412") return false;
      }
  return true;
}

for (const n of [0, 1, 2, 3, 4, 5, 6, 7]) {
  test(`BooleanPermutations(${n}) is S_${n} filtered by Av(321, 3412), in lex order`, () => {
    const all = Array.from({ length: Factorial(n) }, (_, r) => PermutationUnrank(n, r));
    const members = all.filter(avoids321And3412);
    expect(kernel.count([n])).toBe(BigInt(members.length));
    // Membership over every permutation, then round trips over the members.
    for (const p of all) expect([p, kernel.valid(p, [n])]).toEqual([p, avoids321And3412(p)]);
    members.forEach((p, r) => {
      expect(kernel.unrank([n], BigInt(r))).toEqual(p);
      expect(kernel.rank(p, [n])).toBe(BigInt(r));
    });
  });
}

test("F(2n − 1) of them, exactly past 2^53, where unrank and rank decline", () => {
  const fibonacci = [0n, 1n];
  for (let i = 2; i <= 90; i++) fibonacci.push(fibonacci[i - 1] + fibonacci[i - 2]);
  for (const n of [1, 5, 30, 45]) expect(kernel.count([n])).toBe(fibonacci[2 * n - 1]);
  expect(fibonacci[2 * 45 - 1] > 2n ** 53n).toBe(true);
  expect(() => kernel.unrank([45], 0n)).toThrow(RangeError);
});

test("a large member round-trips", () => {
  const p = kernel.unrank([30], 123456789n);
  expect(kernel.valid(p, [30])).toBe(true);
  expect(kernel.rank(p, [30])).toBe(123456789n);
});

test("the table is built once per n, not per call", () => {
  const built: string[] = [];
  const counted = kernelOn(bareEngine(), booleanPermutations, COMPILED_FAMILIES, {
    onTables: (p, precision) => built.push(`${p.join(",")}:${precision}`),
  });
  for (let i = 0; i < 5; i++) {
    const p = counted.unrank([9], BigInt(i));
    expect(counted.valid(p, [9])).toBe(true);
    expect(counted.rank(p, [9])).toBe(BigInt(i));
  }
  expect(built.length).toBeLessThanOrEqual(1);
});
