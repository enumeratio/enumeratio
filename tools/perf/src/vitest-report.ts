// Adapts vitest's `--reporter=json` output (Jest-compatible shape) into a PackageRun.
// Confirmed against a real run: `pnpm --filter @enumeratio/boxed exec vp test --reporter=json
// --outputFile=out.json` — testResults[].{name,startTime,endTime}, assertionResults[].{fullName,duration}.

import type { PackageRun, TestDuration } from "./history.ts";

export interface VitestAssertionResult {
  fullName?: string;
  title: string;
  duration: number | null;
  status: string;
}

export interface VitestFileResult {
  name: string; // absolute path to the test file
  startTime: number;
  endTime: number;
  assertionResults: VitestAssertionResult[];
}

export interface VitestJsonReport {
  testResults: VitestFileResult[];
}

/** `name` relativizes the file path to the package root so history stays portable across machines. */
export function toPackageRun(report: VitestJsonReport, packageRoot: string): PackageRun {
  const files: Record<string, number> = {};
  const tests: TestDuration[] = [];

  for (const fileResult of report.testResults) {
    const file = relativize(fileResult.name, packageRoot);
    files[file] = fileResult.endTime - fileResult.startTime;
    for (const assertion of fileResult.assertionResults) {
      if (typeof assertion.duration !== "number") continue;
      tests.push({
        file,
        name: assertion.fullName ?? assertion.title,
        durationMs: assertion.duration,
      });
    }
  }

  const wallMs = Object.values(files).reduce((sum, ms) => sum + ms, 0);
  return { wallMs, files, tests };
}

function relativize(absolutePath: string, root: string): string {
  const normalizedRoot = root.endsWith("/") ? root : `${root}/`;
  return absolutePath.startsWith(normalizedRoot)
    ? absolutePath.slice(normalizedRoot.length)
    : absolutePath;
}
