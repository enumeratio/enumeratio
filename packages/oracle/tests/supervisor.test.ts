import { execFileSync } from "node:child_process";
import { expect, test } from "vite-plus/test";
import { SUPERVISOR } from "../src/run.ts";

const supervise = (script: string): string =>
  execFileSync("python3", ["-c", SUPERVISOR, String(4096 * 2 ** 20), "0", "python3", "-c", script], {
    encoding: "utf8",
  });

test("a SIGKILL from outside is a memory kill, pinned after the last printed item", () => {
  const out = supervise('import os, signal; print("<<1>>7", flush=True); os.kill(os.getpid(), signal.SIGKILL)');
  expect(out).toContain("<<2>>!!MemoryError: over 4096 MiB");
});

test("any other bad exit stays KernelDied", () => {
  expect(supervise("import sys; sys.exit(3)")).toContain("<<1>>!!KernelDied: exit 3");
});
