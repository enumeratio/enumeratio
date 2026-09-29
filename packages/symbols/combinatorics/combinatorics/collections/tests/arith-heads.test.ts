import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// ─── Rationalize(x, 0) ──────────────────────────────────────────────────────────────

// Independent cross-check: the returned p/q must equal x bit-for-bit when converted back
// to a double, and its denominator must be a power of 2 (every double is dyadic).
test("Rationalize(x, 0) is the exact dyadic rational a double denotes", () => {
  for (const x of [0.1, 0.5, 2.5, -0.125, 1 / 3, Math.PI, 6.75]) {
    const json = run(["Rationalize", x, 0]);
    // An integer past 2^53 serialises as {num: "…"}; read either form exactly.
    const int = (j: unknown): bigint =>
      BigInt(typeof j === "object" && j !== null ? (j as { num: string }).num : (j as number));
    const [p, q] = Array.isArray(json) && json[0] === "Rational" ? [int(json[1]), int(json[2])] : [int(json), 1n];
    expect(Number(p) / Number(q)).toBe(x);
    expect((q & (q - 1n)) === 0n, `denominator ${q} should be a power of 2`).toBe(true);
  }
});
