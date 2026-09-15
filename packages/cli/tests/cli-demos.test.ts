import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, expect, test } from "vite-plus/test";
import { CLI_DEMOS, runCommand, splitArgs } from "../src/browser.ts";

// The command-line demo corpus as golden transcripts: each demo line is the argv
// typed after `$ notatio `, run through the command runner. Goldens live in a
// committed JSON file compared with `toEqual` -- deliberately NOT `toMatchSnapshot`,
// whose client isn't set up when the `test` task runs through `vp run` (the path
// `vp run -r test` / CI uses), only under a bare `vp test`. Regenerate with
// `UPDATE_CLI_DEMOS=1 vp test` after an intended output change.
function transcript(demo: (typeof CLI_DEMOS)[number]) {
  return demo.lines.map((cmd) => {
    const r = runCommand(splitArgs(cmd));
    return {
      cmd: `notatio ${cmd}`,
      out: (r.stdout || `[stderr] ${r.stderr}`).trimEnd(),
      code: r.code,
    };
  });
}

const GOLDEN = fileURLToPath(new URL("./cli-demos.golden.json", import.meta.url));
const updating = process.env.UPDATE_CLI_DEMOS === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

for (const demo of CLI_DEMOS) {
  test(`cli demo: ${demo.id}`, () => {
    const t = transcript(demo);
    if (updating) {
      fresh[demo.id] = t;
      return;
    }
    expect(t).toEqual(golden[demo.id]);
  });
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});

test("splitArgs respects quotes", () => {
  expect(splitArgs('-f wolfram "x^2 + 1"')).toEqual(["-f", "wolfram", "x^2 + 1"]);
  expect(splitArgs("--help")).toEqual(["--help"]);
});
