// Writes a generated module as `vp fmt` lays it out (so a rerun with nothing changed changes
// nothing), and moves it into place whole: the compile steps run side by side and import one
// another's outputs, so none may ever see a half-written file.

import { execFileSync } from "node:child_process";
import { renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export function writeGenerated(target: string, text: string): void {
  // Still named `*.generated.js`, so a step hashing the package meanwhile skips it, as it skips the target.
  const tmp = join(dirname(target), `tmp-${process.pid}-${basename(target)}`);
  try {
    writeFileSync(tmp, text);
    execFileSync("vp", ["fmt", tmp], { stdio: "ignore" });
    renameSync(tmp, target);
  } finally {
    rmSync(tmp, { force: true });
  }
}
