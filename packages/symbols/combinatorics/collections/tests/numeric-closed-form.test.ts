import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { afterAll, expect, test } from "vite-plus/test";
import { entries } from "../src/families/numeric-closed-form.ts";
import { entries as numericSets } from "../src/families/numeric-sets.ts";
import { declareCollections } from "../src/library.ts";

const byHead = new Map(entries.map((e) => [e.head, e]));

// ─── OEIS first terms, used both to certify the kernels and to ground the CE-level checks
// further down. Every value here stays within Number.MAX_SAFE_INTEGER, so plain numbers are
// fine (the exactness-past-2^53 checks live in their own section below). ───────────────────
const OEIS: Record<string, { anum: string; terms: number[] }> = {
  TriangularNumbers: { anum: "A000217", terms: [1, 3, 6, 10, 15, 21, 28, 36, 45, 55] },
  PentagonalNumbers: { anum: "A000326", terms: [1, 5, 12, 22, 35, 51, 70, 92, 117, 145] },
  HexagonalNumbers: { anum: "A000384", terms: [1, 6, 15, 28, 45, 66, 91, 120, 153, 190] },
  HeptagonalNumbers: { anum: "A000566", terms: [1, 7, 18, 34, 55, 81, 112, 148, 189, 235] },
  OctagonalNumbers: { anum: "A000567", terms: [1, 8, 21, 40, 65, 96, 133, 176, 225, 280] },
  CenteredTriangularNumbers: {
    anum: "A005448",
    terms: [1, 4, 10, 19, 31, 46, 64, 85, 109, 136],
  },
  CenteredSquareNumbers: { anum: "A001844", terms: [1, 5, 13, 25, 41, 61, 85, 113, 145, 181] },
  CenteredHexagonalNumbers: {
    anum: "A003215",
    terms: [1, 7, 19, 37, 61, 91, 127, 169, 217, 271],
  },
  StarNumbers: { anum: "A003154", terms: [1, 13, 37, 73, 121, 181, 253, 337, 433, 541] },
  PronicNumbers: { anum: "A002378", terms: [2, 6, 12, 20, 30, 42, 56, 72, 90, 110] },
  CubeNumbers: { anum: "A000578", terms: [1, 8, 27, 64, 125, 216, 343, 512, 729, 1000] },
  TetrahedralNumbers: { anum: "A000292", terms: [1, 4, 10, 20, 35, 56, 84, 120, 165, 220] },
  PentatopeNumbers: { anum: "A000332", terms: [1, 5, 15, 35, 70, 126, 210, 330, 495, 715] },
  SquarePyramidalNumbers: {
    anum: "A000330",
    terms: [1, 5, 14, 30, 55, 91, 140, 204, 285, 385],
  },
  PowersOfTwo: { anum: "A000079", terms: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512] },
  FactorialNumbers: { anum: "A000142", terms: [1, 2, 6, 24, 120, 720, 5040, 40320, 362880] },
  DoubleFactorialNumbers: {
    anum: "A001147",
    terms: [1, 3, 15, 105, 945, 10395, 135135, 2027025, 34459425],
  },
  PrimorialNumbers: {
    anum: "A002110",
    terms: [2, 6, 30, 210, 2310, 30030, 510510, 9699690, 223092870],
  },
  AllOnes: { anum: "A000012", terms: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
};

// Sets whose OEIS offset (per the task's rules: document where it differs) is 1 term earlier
// than ours -- we always start `At(S, 1)` at n=1 in each closed form, which for these
// families is one term past OEIS's own a(0). See the comment on each family in
// numeric-closed-form.ts.
const OFFSET_NOTE: Record<string, string> = {
  PronicNumbers: "A002378 a(0)=0; we start at n=1 (value 2)",
  PowersOfTwo: "A000079 a(0)=1 already matches our n=1 term (2^0)",
  FactorialNumbers: "A000142 a(0)=a(1)=1; we start at n=1, skipping the duplicate",
  DoubleFactorialNumbers: "A001147 a(0)=a(1)=1; we start at n=1, skipping the duplicate",
  PrimorialNumbers: "A002110 a(0)=1 (empty product); we start at n=1 (value 2)",
};
void OFFSET_NOTE; // documented for readers of this file, not asserted mechanically

for (const [head, { anum, terms }] of Object.entries(OEIS)) {
  const entry = byHead.get(head);

  test(`${head} matches ${anum} for its first terms`, () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    const got = terms.map((_, r) => Number(entry.unrank([], r)));
    expect(got).toEqual(terms);
  });

  // AllOnes is degenerate: every term is the same value, so `rank` (the first, 0-indexed
  // match) is 0 regardless of which position `unrank` produced it at.
  test(`${head} rank/unrank/valid round-trip over its first terms`, () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    for (let r = 0; r < terms.length; r++) {
      const element = entry.unrank([], r);
      expect(Number(element)).toBe(terms[r]);
      expect(entry.valid(element, [])).toBe(true);
      expect(entry.rank(element, [])).toBe(head === "AllOnes" ? 0 : r);
    }
  });
}

// AllOnes is degenerate (every term is the same value), so it skips the generic
// "adjacent value is never a member" check below.
for (const [head, { terms }] of Object.entries(OEIS)) {
  if (head === "AllOnes") continue;
  const entry = byHead.get(head);
  test(`${head} rejects a non-member`, () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    const nonMember = Math.max(...terms) + 1;
    if (!terms.includes(nonMember)) {
      expect(entry.valid(nonMember, [])).toBe(false);
      expect(entry.rank(nonMember, [])).toBe(-1);
    }
  });
}

// ─── independent brute-force certification: for every polynomial-formula family, regenerate
// its first 30 terms from an independently-written closed-form expression (not the kernel's
// own quadraticTerm/bisectRank machinery) and cross-check both the term list and membership
// of every integer in range against a plain "is it in the generated set" predicate. ─────────
const N = 30;
const MAX_TERM_RANGE = 2000; // covers the first 30 terms of every polynomial family here

const INDEPENDENT_FORMULA: Record<string, (n: number) => number> = {
  TriangularNumbers: (n) => (n * (n + 1)) / 2,
  PentagonalNumbers: (n) => (n * (3 * n - 1)) / 2,
  HexagonalNumbers: (n) => n * (2 * n - 1),
  HeptagonalNumbers: (n) => (n * (5 * n - 3)) / 2,
  OctagonalNumbers: (n) => n * (3 * n - 2),
  CenteredTriangularNumbers: (n) => (3 * n * n - 3 * n + 2) / 2,
  CenteredSquareNumbers: (n) => 2 * n * n - 2 * n + 1,
  CenteredHexagonalNumbers: (n) => 3 * n * n - 3 * n + 1,
  StarNumbers: (n) => 6 * n * n - 6 * n + 1,
  PronicNumbers: (n) => n * (n + 1),
  CubeNumbers: (n) => n ** 3,
  TetrahedralNumbers: (n) => (n * (n + 1) * (n + 2)) / 6,
  PentatopeNumbers: (n) => (n * (n + 1) * (n + 2) * (n + 3)) / 24,
  SquarePyramidalNumbers: (n) => (n * (n + 1) * (2 * n + 1)) / 6,
  PowersOfTwo: (n) => 2 ** (n - 1),
};

for (const [head, f] of Object.entries(INDEPENDENT_FORMULA)) {
  const entry = byHead.get(head);

  test(`${head}: first ${N} terms match an independent closed form`, () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    for (let r = 0; r < N; r++) {
      expect(Number(entry.unrank([], r))).toBe(f(r + 1));
    }
  });

  test(`${head}: membership over [1, ${MAX_TERM_RANGE}] matches the independent formula`, () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    const expectedMembers = new Set<number>();
    for (let n = 1; f(n) <= MAX_TERM_RANGE; n++) expectedMembers.add(f(n));
    for (let x = 1; x <= MAX_TERM_RANGE; x++) {
      expect(entry.valid(x, [])).toBe(expectedMembers.has(x));
    }
  });
}

// ─── the no-closed-form-inverse families (Factorial, DoubleFactorial, Primorial): grow fast
// enough that 30 terms would blow well past double precision, so certify fewer terms but do
// it with exact BigInt arithmetic end to end -- an independent recomputation, not a reuse of
// the kernel's own growingSequence caches. ──────────────────────────────────────────────────
function independentFactorial(n: number): bigint {
  let f = 1n;
  for (let i = 2; i <= n; i++) f *= BigInt(i);
  return f;
}
function independentDoubleFactorial(n: number): bigint {
  let f = 1n;
  for (let i = 1; i <= n; i++) f *= BigInt(2 * i - 1);
  return f;
}
function isPrimeSimple(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}
function independentPrimorial(n: number): bigint {
  let p = 1n;
  let candidate = 1;
  for (let i = 0; i < n; i++) {
    candidate++;
    while (!isPrimeSimple(candidate)) candidate++;
    p *= BigInt(candidate);
  }
  return p;
}

const GROWING: Record<string, (n: number) => bigint> = {
  FactorialNumbers: independentFactorial,
  DoubleFactorialNumbers: independentDoubleFactorial,
  PrimorialNumbers: independentPrimorial,
};

for (const [head, f] of Object.entries(GROWING)) {
  const entry = byHead.get(head);
  const terms = 15; // 15! ~ 1.3e12, (2*15-1)!! ~ 2.1e17, primorial(15) ~ 6.1e17: exact bigint checks either way

  test(`${head}: first ${terms} terms match an independent bigint recomputation`, () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    for (let r = 0; r < terms; r++) {
      const got = BigInt(entry.unrank([], r) as unknown as bigint | number);
      expect(got).toBe(f(r + 1));
    }
  });

  test(`${head}: rank/valid round-trip over its first ${terms} terms`, () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    for (let r = 0; r < terms; r++) {
      const element = entry.unrank([], r);
      expect(entry.valid(element, [])).toBe(true);
      expect(entry.rank(element, [])).toBe(r);
    }
  });
}

// ─── exactness past Number.MAX_SAFE_INTEGER: the whole point of computing every term over
// bigint. 20! and 2^59 both exceed 2^53, so a float-based unrank would silently round them. ─
test("FactorialNumbers: At(20) is exact past Number.MAX_SAFE_INTEGER", () => {
  const entry = byHead.get("FactorialNumbers");
  expect(entry).toBeDefined();
  if (!entry) return;
  const v = entry.unrank([], 19); // 20!
  expect(typeof v).toBe("bigint");
  expect(v as unknown as bigint).toBe(2432902008176640000n);
  expect(entry.valid(v, [])).toBe(true);
  expect(entry.rank(v, [])).toBe(19);
});

test("PowersOfTwo: At(60) is exact past Number.MAX_SAFE_INTEGER", () => {
  const entry = byHead.get("PowersOfTwo");
  expect(entry).toBeDefined();
  if (!entry) return;
  const v = entry.unrank([], 59); // 2^59
  expect(typeof v).toBe("bigint");
  expect(v as unknown as bigint).toBe(576460752303423488n);
  expect(entry.valid(v, [])).toBe(true);
  expect(entry.rank(v, [])).toBe(59);
});

// ─── PolygonalNumbers(k): the selector. k=4 must reproduce SquareNumbers (numeric-sets.ts)
// termwise, and k=3,5,6,7,8 must reproduce the fixed-k families above. ─────────────────────
test("PolygonalNumbers is a one-parameter operator", () => {
  const entry = byHead.get("PolygonalNumbers");
  expect(entry).toBeDefined();
  if (!entry) return;
  expect(entry.paramCount).toBe(1);
});

const FIXED_K: Record<number, string> = {
  3: "TriangularNumbers",
  5: "PentagonalNumbers",
  6: "HexagonalNumbers",
  7: "HeptagonalNumbers",
  8: "OctagonalNumbers",
};
for (const [k, head] of Object.entries(FIXED_K)) {
  test(`PolygonalNumbers(${k}) agrees with ${head}`, () => {
    const poly = byHead.get("PolygonalNumbers");
    const fixed = byHead.get(head);
    expect(poly).toBeDefined();
    expect(fixed).toBeDefined();
    if (!poly || !fixed) return;
    for (let r = 0; r < N; r++) {
      expect(poly.unrank([Number(k)], r)).toBe(fixed.unrank([], r));
    }
    const midpoint = Number(fixed.unrank([], 10));
    expect(poly.valid(midpoint, [Number(k)])).toBe(fixed.valid(midpoint, []));
    expect(poly.rank(midpoint, [Number(k)])).toBe(fixed.rank(midpoint, []));
  });
}

test("PolygonalNumbers(4) agrees with SquareNumbers (numeric-sets.ts)", () => {
  const poly = byHead.get("PolygonalNumbers");
  const square = numericSets.find((e) => e.head === "SquareNumbers");
  expect(poly).toBeDefined();
  expect(square).toBeDefined();
  if (!poly || !square) return;
  for (let r = 0; r < N; r++) {
    expect(poly.unrank([4], r)).toBe(square.unrank([], r));
  }
});

// ─── engine-level: At / Take / Count / Element through the declared CE collection handlers,
// as in numeric-sets.test.ts. Kept to values well within the safe-integer decode range that
// declare.ts's `intOf` caps membership checks to (see the file header in
// numeric-closed-form.ts). ──────────────────────────────────────────────────────────────────
const ce = new ComputeEngine();
declareCollections(ce);

test("TriangularNumbers is declared as an indexed_collection<integer>", () => {
  expect(ce.box("TriangularNumbers").type.toString()).toBe("indexed_collection<integer>");
});

test("At(TriangularNumbers, n) gives the n-th triangular number, 1-indexed", () => {
  expect(ce.box(["At", "TriangularNumbers", 5]).evaluate().re).toBe(15);
});

test("Take(CubeNumbers, 5) gives the first five cubes", () => {
  expect(ce.box(["Take", "CubeNumbers", 5]).evaluate().toString()).toBe("[1,8,27,64,125]");
});

test("Count(FactorialNumbers) is +oo", () => {
  expect(ce.box(["Count", "FactorialNumbers"]).evaluate().toString()).toBe("+oo");
});

test("Element membership on TriangularNumbers", () => {
  expect(ce.box(["Element", 15, "TriangularNumbers"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", 14, "TriangularNumbers"]).evaluate().toString()).toBe('"False"');
});

test("Element membership on PowersOfTwo", () => {
  expect(ce.box(["Element", 64, "PowersOfTwo"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", 48, "PowersOfTwo"]).evaluate().toString()).toBe('"False"');
});

test("Take(FactorialNumbers, 6) gives the first six factorials", () => {
  expect(ce.box(["Take", "FactorialNumbers", 6]).evaluate().toString()).toBe("[1,2,6,24,120,720]");
});

test("PolygonalNumbers(k) is a one-parameter operator through the engine", () => {
  expect(ce.box(["At", ["PolygonalNumbers", 5], 3]).evaluate().re).toBe(12);
  expect(
    ce
      .box(["Take", ["PolygonalNumbers", 6], 5])
      .evaluate()
      .toString(),
  ).toBe("[1,6,15,28,45]");
});

test("AllOnes is the constant sequence", () => {
  expect(ce.box(["Take", "AllOnes", 5]).evaluate().toString()).toBe("[1,1,1,1,1]");
  expect(ce.box(["Element", 1, "AllOnes"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", 2, "AllOnes"]).evaluate().toString()).toBe('"False"');
});

// ─── Golden JSON (AGENTS.md); regenerate with `UPDATE_NUMERIC_CLOSED_FORM_GOLDEN=1 vp test`.
// Stored as decimal strings (not numbers) so the fast-growing families stay exact through
// JSON, which has no bigint of its own. ────────────────────────────────────────────────────
const GOLDEN = fileURLToPath(new URL("./numeric-closed-form.golden.json", import.meta.url));
const updating = process.env.UPDATE_NUMERIC_CLOSED_FORM_GOLDEN === "1";
const golden: Record<string, string[]> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, string[]> = {};

const GOLDEN_TERM_COUNT = 25;

for (const entry of entries) {
  const key = entry.head === "PolygonalNumbers" ? undefined : entry.head;
  if (!key) continue; // PolygonalNumbers is covered by its own golden cases below (needs k)
  test(`golden: ${key}`, () => {
    const terms = Array.from({ length: GOLDEN_TERM_COUNT }, (_, r) => String(entry.unrank([], r)));
    if (updating) {
      fresh[key] = terms;
      return;
    }
    expect(terms).toEqual(golden[key]);
  });
}

for (const k of [3, 4, 5, 6, 7, 8, 12]) {
  const key = `PolygonalNumbers(${k})`;
  test(`golden: ${key}`, () => {
    const poly = byHead.get("PolygonalNumbers");
    expect(poly).toBeDefined();
    if (!poly) return;
    const terms = Array.from({ length: GOLDEN_TERM_COUNT }, (_, r) => String(poly.unrank([k], r)));
    if (updating) {
      fresh[key] = terms;
      return;
    }
    expect(terms).toEqual(golden[key]);
  });
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
