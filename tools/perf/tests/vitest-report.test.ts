import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { toPackageRun } from "../src/vitest-report.ts";

const here = dirname(fileURLToPath(import.meta.url));
// A trimmed, real capture: `pnpm --filter @enumeratio/boxed exec vp test --reporter=json
// --outputFile=…` against packages/boxed, with paths rewritten under a fake package root.
const golden = JSON.parse(readFileSync(join(here, "fixtures/boxed-report.golden.json"), "utf8"));

test("toPackageRun reads a real vitest --reporter=json capture", () => {
  const run = toPackageRun(golden.report, golden.packageRoot);
  expect(run).toEqual(golden.expected);
});

test("toPackageRun drops assertions vitest didn't time (duration: null)", () => {
  const run = toPackageRun(
    {
      testResults: [
        {
          name: "/root/tests/a.test.ts",
          startTime: 0,
          endTime: 10,
          assertionResults: [
            { fullName: "timed", title: "timed", duration: 5, status: "passed" },
            { fullName: "untimed", title: "untimed", duration: null, status: "passed" },
          ],
        },
      ],
    },
    "/root",
  );
  expect(run).toEqual({
    wallMs: 10,
    files: { "tests/a.test.ts": 10 },
    tests: [{ file: "tests/a.test.ts", name: "timed", durationMs: 5 }],
  });
});

test("toPackageRun sums wall time across multiple files", () => {
  const run = toPackageRun(
    {
      testResults: [
        { name: "/root/a.test.ts", startTime: 0, endTime: 10, assertionResults: [] },
        { name: "/root/b.test.ts", startTime: 0, endTime: 25, assertionResults: [] },
      ],
    },
    "/root",
  );
  expect(run.wallMs).toBe(35);
});
