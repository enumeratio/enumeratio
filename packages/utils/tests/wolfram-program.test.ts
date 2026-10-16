import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { expect, test, vi } from "vite-plus/test";

// A program rides in a file, not in one argument: past 128 KiB Linux refuses the spawn (E2BIG).
// The spawn is faked, so no kernel runs; it reads the file the way the kernel would.
const seen: { args: string[]; program: string }[] = [];

vi.mock("node:child_process", () => ({
  execFileSync: () => "",
  spawn: (_command: string, args: string[]) => {
    const file = /Get\["(.*)", CharacterEncoding/.exec(args[1] ?? "")![1]!;
    seen.push({ args, program: readFileSync(file, "utf8") });
    const child = Object.assign(new EventEmitter(), {
      pid: 1,
      stdin: { end: () => {} },
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
    });
    queueMicrotask(() => {
      child.stdout.emit("data", Buffer.from("<<1>>ok\n"));
      child.emit("close", 0);
    });
    return child;
  },
}));

const { runWolframKernel } = await import("../src/bounded.ts");

test("an oversize Wolfram program reaches the kernel through a file, not an argument", async () => {
  const program = `Print["<<1>>ok"]; (* ${"x".repeat(300 * 1024)} *) 1`;
  expect(await runWolframKernel(program)).toBe("<<1>>ok\n");
  const [call] = seen;
  expect(call!.program).toBe(program);
  expect(call!.args.every((arg) => arg.length < 1024)).toBe(true);
});
