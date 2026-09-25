// Ask the other systems which of our heads they already have.
//
// The Wolfram column in the provenance data used to be read off the transpiler's `HEADS`
// map, and that was misleading: `HEADS` lists RENAMES only. `HurwitzZeta`, `LerchPhi` and
// `PowerModList` are absent from it not because Wolfram lacks them but because the name is
// already right and `toWolfram` passes it through. Reading absence as "no equivalent" got
// the answer backwards on exactly the heads we most want to upstream.
//
// So ask the systems instead of guessing from our own tables:
//
//   Wolfram   `Names["System`" <> name]` — is it a built-in symbol?
//   SymPy     does the module expose a callable of that name, or its snake_case form?
//   mpmath    the same, over the arbitrary-precision numerics we already validate against.
//
// This one DOES need external kernels, so it is never part of `vp test`. It refreshes the
// coverage columns of `src/provenance-data.ts`; the offline collector leaves them alone.
//
//   vp node packages/reference/scripts/collect-coverage.ts
//
// On numpy and Sage, since the question keeps coming up: numpy is a compile TARGET for
// numeric evaluation, not an oracle — it has no zeta at all, and `scipy.special.zeta` is
// the Hurwitz function restricted to real s > 1. Sage bundles mpmath and SymPy, so a Sage lane would subsume both,
// at the cost of a much heavier dependency for no extra coverage. We call mpmath directly.

import { readFileSync, writeFileSync } from "node:fs";
import { KernelKilled, runKernel } from "@enumeratio/oracle/bounded";

const dataPath = new URL("../src/provenance-data.ts", import.meta.url);
const source = readFileSync(dataPath, "utf8");
const names = [...source.matchAll(/"name": "([^"]+)"/g)].map((match) => match[1] as string);

/** Which names Wolfram knows as built-in System` symbols. */
async function askWolfram(heads: readonly string[]): Promise<Set<string>> {
  // A Wolfram list is {a, b, …} — a JSON array would parse as Part and quietly return one
  // match instead of the real answer, which is exactly what it did the first time.
  const list = `{${heads.map((head) => `"${head}"`).join(", ")}}`;
  const code = `Print[StringRiffle[Select[${list}, Length[Names["System\`" <> #]] > 0 &], ","]]`;
  try {
    const out = await runKernel("wolframscript", ["-code", code], { timeoutMs: 120_000 });
    return new Set(out.trim().split(",").filter(Boolean));
  } catch (error) {
    // A missing kernel leaves the column empty; a killed one must not pass for that.
    if (error instanceof KernelKilled) throw error;
    process.stderr.write(`wolframscript unavailable: ${String(error)}\n`);
    return new Set();
  }
}

/** Which names SymPy and mpmath expose, under our spelling or its snake_case form. */
async function askPython(heads: readonly string[]): Promise<{ sympy: Set<string>; mpmath: Set<string> }> {
  const program = `
import json, sys
names = json.loads(sys.stdin.read())
out = {}
for module in ("sympy", "mpmath"):
    try:
        m = __import__(module)
    except ImportError:
        out[module] = []
        continue
    found = []
    for name in names:
        snake = "".join("_" + c.lower() if c.isupper() and i else c.lower()
                        for i, c in enumerate(name))
        for candidate in (name, name[0].lower() + name[1:], snake, name.lower()):
            if callable(getattr(m, candidate, None)):
                found.append(name)
                break
    out[module] = found
print(json.dumps(out))
`;
  try {
    const out = await runKernel("python3", ["-c", program], {
      input: JSON.stringify(heads),
      timeoutMs: 120_000,
    });
    const parsed = JSON.parse(out) as { sympy: string[]; mpmath: string[] };
    return { sympy: new Set(parsed.sympy), mpmath: new Set(parsed.mpmath) };
  } catch (error) {
    if (error instanceof KernelKilled) throw error;
    process.stderr.write(`python3 unavailable: ${String(error)}\n`);
    return { sympy: new Set(), mpmath: new Set() };
  }
}

const wolfram = await askWolfram(names);
const { sympy, mpmath } = await askPython(names);

/** Rewrite one record's coverage arrays in place, preserving everything else. */
const updated = source.replace(
  /(\{\s*"name": "([^"]+)",[\s\S]*?)"elsewhere": \[[^\]]*\]/g,
  (_whole: string, prefix: string, name: string) => {
    const systems = [
      wolfram.has(name) ? '"wolfram"' : "",
      sympy.has(name) ? '"sympy"' : "",
      mpmath.has(name) ? '"mpmath"' : "",
    ].filter(Boolean);
    return `${prefix}"elsewhere": [${systems.join(", ")}]`;
  },
);
writeFileSync(dataPath, updated);

const report = (label: string, found: Set<string>): string => `${label} ${found.size}/${names.length}`;
process.stdout.write(`${report("wolfram", wolfram)}  ${report("sympy", sympy)}  ${report("mpmath", mpmath)}\n`);
process.stdout.write(
  `heads no system has: ${names.filter((n) => !wolfram.has(n) && !sympy.has(n) && !mpmath.has(n)).length}\n`,
);
