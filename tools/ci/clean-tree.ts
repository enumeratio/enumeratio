#!/usr/bin/env node
// Fails when a build left files that are neither tracked nor ignored: output beside a source
// (a stray `.d.ts`), or generated data that is not gitignored.
//
//   node tools/ci/clean-tree.ts

import { git } from "./workspace.ts";

const stray = git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean);
if (stray.length > 0) {
  console.error(`The build left untracked, unignored files:\n${stray.map((f) => `  ${f}`).join("\n")}`);
  console.error("Fix what writes them (output belongs in dist/), or gitignore generated data.");
  process.exit(1);
}
