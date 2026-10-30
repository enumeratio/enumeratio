// The verdict memo (scripts/stamp.ts `verdictCache`): reused while nothing moved, sampled and
// carried when only the engine's dists moved, and fully re-checked on any other change.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "vite-plus/test";
import { SAMPLE_MIN, verdictCache, type Verdicts } from "../scripts/stamp.ts";

let dir: string;
const put = (file: string, text: string): void => {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), text);
};
const open = (): Verdicts =>
  verdictCache("t", { dir, roots: [join(dir, "src")], imports: ["@enumeratio/dep"], omitDists: [] });

const labels = Array.from({ length: 40 }, (_, i) => `item${i}`);

/** One run over every label; `verdict` is what a check answers. Returns the labels it checked. */
function runOver(verdicts: Verdicts, verdict: (label: string) => unknown = () => true): string[] {
  const checked: string[] = [];
  verdicts.plan(labels);
  for (const label of labels)
    verdicts.remember(
      { label },
      () => {
        checked.push(label);
        return verdict(label);
      },
      label,
    );
  return checked;
}

beforeAll(() => {
  // The memo then lives beside the stamps, which beforeEach clears.
  delete process.env.DIST_CACHE_DIR;
  dir = mkdtempSync(join(tmpdir(), "verdicts-"));
  put("package.json", '{"name":"t"}');
  put("pnpm-lock.yaml", "lockfileVersion: 9\n");
  put("node_modules/@enumeratio/dep/package.json", '{"name":"@enumeratio/dep"}');
});
beforeEach(() => {
  put("src/a.ts", "a");
  put("node_modules/@enumeratio/dep/dist/a.js", "engine 1");
  rmSync(join(dir, "node_modules/.cache"), { recursive: true, force: true });
});
afterEach(() => {
  delete process.env.RECHECK_ALL;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("an unchanged engine reuses every answer", () => {
  const first = open();
  expect(runOver(first)).toHaveLength(labels.length);
  first.save();
  expect(runOver(open())).toEqual([]);
});

test("a moved engine re-checks a sample and carries the rest", () => {
  const first = open();
  runOver(first);
  first.save();
  put("node_modules/@enumeratio/dep/dist/a.js", "engine 2");
  const second = open();
  const checked = runOver(second);
  expect(checked.length).toBeGreaterThanOrEqual(SAMPLE_MIN);
  expect(checked.length).toBeLessThan(labels.length / 2);
  expect(second.share().carried).toBe(labels.length - checked.length);
  second.save();
  // The same engine again: what was carried is still carried, not taken as checked, and not
  // re-sampled (the sample is the engine's).
  const third = open();
  expect(runOver(third)).toEqual([]);
  expect(third.share().carried).toBe(labels.length - checked.length);
  // Another engine samples other items.
  put("node_modules/@enumeratio/dep/dist/a.js", "engine 3");
  expect(runOver(open())).not.toEqual(checked);
});

test("a sampled answer that differs re-checks everything", () => {
  const first = open();
  runOver(first);
  first.save();
  put("node_modules/@enumeratio/dep/dist/a.js", "engine 2");
  const second = open();
  let passes = 0;
  second.settle(() => {
    passes++;
    return runOver(second, () => passes > 1);
  });
  expect(passes).toBe(2);
  expect(second.share().carried).toBe(0);
  expect(second.share().misses).toBe(labels.length);
});

test("a carried answer is never a disagreement", () => {
  const first = open();
  runOver(first, (label) => label !== "item3");
  first.save();
  put("node_modules/@enumeratio/dep/dist/a.js", "engine 2");
  expect(runOver(open(), () => true)).toContain("item3");
});

test("unlabelled and changed items are always checked", () => {
  const first = open();
  first.remember({ k: 1 }, () => true);
  first.remember({ k: 2 }, () => true, "x");
  first.save();
  put("node_modules/@enumeratio/dep/dist/a.js", "engine 2");
  const second = open();
  second.plan(Array.from({ length: 100 }, (_, i) => `y${i}`).concat("x"));
  let ran = 0;
  second.remember({ k: 1 }, () => ++ran, "x");
  second.remember({ k: 1 }, () => ++ran);
  second.remember({ k: 3 }, () => ++ran, "x");
  expect(ran).toBeGreaterThanOrEqual(2);
});

test("a changed checker re-checks everything", () => {
  const first = open();
  runOver(first);
  first.save();
  put("src/a.ts", "b");
  expect(runOver(open())).toHaveLength(labels.length);
});

test("RECHECK_ALL checks everything", () => {
  const first = open();
  runOver(first);
  first.save();
  process.env.RECHECK_ALL = "1";
  expect(runOver(open())).toHaveLength(labels.length);
});
