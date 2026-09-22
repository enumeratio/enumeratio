// Interactive Node adapter: a thin readline loop over the core Repl (via NodeHost).
// Numbered In[n] prompts, persisted line history, Ctrl+C to cancel a line, Ctrl+D
// to exit. All evaluation, styling, and commands live in the core / host.

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { dim } from "./ansi.ts";
import { drivable, drive } from "./drive.ts";
import type { SessionDefaults } from "./engine.ts";
import { NodeHost } from "./node-host.ts";
import { textOf } from "./textual.ts";

const HISTORY_FILE = join(homedir(), ".notatio_history");

export function runRepl(defaults: SessionDefaults = {}): void {
  const color = Boolean(process.stdout.isTTY);
  const host = new NodeHost(color, defaults);
  const lines = loadHistory();
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    history: [...lines].reverse(), // readline's history option is newest-first
    historySize: 500,
    terminal: color,
  });

  const setPrompt = (): void => rl.setPrompt(host.repl.prompt());
  console.log(`${host.repl.banner()}\n`);
  setPrompt();
  rl.prompt();

  rl.on("line", (line: string) => {
    void (async () => {
      const input = line.trim();
      if (input) {
        lines.push(input);
        const { session } = host.repl;
        const before = session.history.length;
        const out = host.eval(input);
        if (out.clear) console.clear();
        if (out.inline) process.stdout.write(`${out.inline}\n`);
        const last = session.history.at(-1);
        // A result with controls in it is driven at the keyboard, then printed where it was left.
        if (color && session.history.length > before && last && drivable(last.expr.json)) {
          const left = await drive(last.expr.json, {
            color,
            stdin: process.stdin,
            stdout: process.stdout,
            show: (expr) => textOf(session, expr),
          });
          // `Out[n]` is what the reader left on the screen, so a later line that
          // references it gets the state they stopped at, not the undriven controls.
          last.expr = session.ce.box(left).evaluate();
          console.log(`${host.repl.formatOut(last.n, textOf(session, last.expr.json))}\n`);
        } else if (out.text) console.log(`${out.text}\n`);
        else if (!out.clear) console.log("");
        if (out.exit) {
          rl.close();
          return;
        }
      }
      setPrompt();
      rl.prompt();
    })();
  });

  rl.on("close", () => {
    saveHistory(lines);
    console.log(dim("\nbye.", color));
    process.exit(0);
  });
}

function loadHistory(): string[] {
  try {
    return readFileSync(HISTORY_FILE, "utf8").split("\n").filter(Boolean); // oldest-first
  } catch {
    return [];
  }
}

function saveHistory(lines: readonly string[]): void {
  try {
    writeFileSync(HISTORY_FILE, lines.slice(-500).join("\n"), "utf8");
  } catch {
    // history is a convenience -- never fail the session over it
  }
}
