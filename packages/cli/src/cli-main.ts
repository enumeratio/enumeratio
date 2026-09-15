// The bin's entry logic, as a function so both the tsx dev entry (main.ts) and
// the built bin (bin/notatio.mjs, via ./index.ts) call the same thing. With an
// expression (arg, -c, or piped stdin) it runs command — evaluate, print, exit;
// on a bare interactive TTY it starts the REPL. The config file's defaults feed
// both paths.

import { readFileSync } from "node:fs";
import { runCommand } from "./command.ts";
import { loadConfig } from "./config.ts";
import type { SessionDefaults } from "./engine.ts";
import { runRepl } from "./repl.ts";
import { DEFAULT_PORT, runServe } from "./serve.ts";

export function main(argv: readonly string[] = process.argv.slice(2)): void {
  let defaults: SessionDefaults;
  try {
    defaults = loadConfig();
  } catch (err) {
    process.stderr.write(`config: ${(err as Error).message}\n`);
    process.exit(2);
  }

  if (argv[0] === "serve") {
    const i = argv.indexOf("--port");
    const port = i >= 0 ? Number(argv[i + 1]) : DEFAULT_PORT;
    runServe({ port });
    return;
  }

  const stdinPiped = !process.stdin.isTTY;
  const hasArgs = argv.length > 0;

  if (!hasArgs && !stdinPiped) {
    runRepl(defaults);
    return;
  }

  // Read piped stdin unconditionally; runCommand uses it only when argv carries
  // no expression (so `notatio -f numpy <<EOF …` and `echo … | notatio` both work).
  let stdin: string | undefined;
  if (stdinPiped) {
    try {
      stdin = readFileSync(0, "utf8");
    } catch {
      stdin = undefined;
    }
  }
  const { stdout, stderr, code } = runCommand(argv, stdin, defaults);
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  process.exit(code);
}
