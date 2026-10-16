import { readFileSync } from "node:fs";
import { expect, test, vi } from "vite-plus/test";

// The batch program goes to the kernel in a file: as an argument it tops out at 128 KiB (spawn E2BIG).
const calls: { args: readonly string[]; program: string }[] = [];
vi.mock("@enumeratio/utils/bounded", async (original) => ({
  ...(await original<typeof import("@enumeratio/utils/bounded")>()),
  runBounded: async (_command: string, args: readonly string[]) => {
    const file = args.at(-1) as string;
    calls.push({ args, program: readFileSync(file, "utf8") });
    return { stdout: "<<0>>\n<<1>>1\n", stderr: "", code: 0, peakMb: 0 };
  },
}));

const { runIn } = await import("../src/run.ts");

test.each([
  ["sympy", "batch.py"],
  ["mpmath", "batch.py"],
  ["sage", "batch.sage"],
] as const)("%s: a program over 200 KB is handed over in a file", async (system, name) => {
  calls.length = 0;
  const big = `1 + 1  # ${"x".repeat(200_000)}`;
  const [result] = await runIn(system, [big]);
  expect(result).toMatchObject({ value: "1" });
  const [call] = calls;
  expect(call?.program.length).toBeGreaterThan(200_000);
  expect(call?.args.every((arg) => arg.length < 100_000)).toBe(true);
  expect(call?.args.at(-1)?.endsWith(name)).toBe(true);
});
