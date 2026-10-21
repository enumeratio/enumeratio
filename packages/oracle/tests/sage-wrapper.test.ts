import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";

// The Sage and Wolfram lanes run their kernel in docker, and the batch program is a file in the temp dir
// (withFile). A wrapper that mounts only $PWD hides that file: Sage exits 2 and every item reads `KernelDied`.
test("each docker kernel wrapper in the nightly workflow mounts the temp dir", () => {
  const workflow = readFileSync(new URL("../../../.github/workflows/nightly.yml", import.meta.url), "utf8");
  const wrappers = workflow.split("\n").filter((line) => line.includes("docker run") && line.includes("--entrypoint"));
  expect(wrappers.length).toBeGreaterThanOrEqual(2);
  for (const wrapper of wrappers) expect(wrapper).toContain('-v "${TMPDIR:-/tmp}:${TMPDIR:-/tmp}"');
});
