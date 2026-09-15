// The CLI's own surface, read out of @enumeratio/cli's SOURCE rather than retyped here:
// the USAGE text, the subcommand and flag lists the completion scripts advertise, and
// the form / syntax names the parser resolves. USAGE is the prose source of truth, so the
// per-row descriptions are parsed back out of it instead of being duplicated.

import { USAGE } from "../../../packages/cli/src/command.ts";
import { FLAGS, SHELLS, SUBCOMMANDS } from "../../../packages/cli/src/completion.ts";
import { FORM_LABEL, FORMS, SYNTAXES } from "../../../packages/cli/src/engine.ts";

export interface CliRow {
  /** The invocation or flag spelling, as USAGE writes it. */
  readonly spec: string;
  readonly description: string;
}

export interface CliForm {
  readonly name: string;
  readonly label: string;
}

export interface CliData {
  readonly usage: string;
  readonly subcommands: readonly CliRow[];
  readonly flags: readonly CliRow[];
  readonly shells: readonly string[];
  readonly forms: readonly CliForm[];
  readonly syntaxes: readonly string[];
}

/** The indented lines of one `Heading:` block, up to the blank line that ends it. */
function block(text: string, heading: string): string[] {
  const lines = text.split("\n");
  const start = lines.indexOf(heading);
  if (start < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") break;
    out.push(line);
  }
  return out;
}

/**
 * Fold a block into rows. `head` recognises the start of a row and splits it into spec
 * and first description line; anything else continues the row above it.
 */
function rows(lines: string[], head: (line: string) => CliRow | undefined): CliRow[] {
  const out: CliRow[] = [];
  for (const line of lines) {
    const started = head(line);
    if (started) out.push(started);
    else if (out.length > 0) {
      const last = out[out.length - 1];
      const cont = line.trim();
      out[out.length - 1] = {
        spec: last.spec,
        description: last.description ? `${last.description} ${cont}` : cont,
      };
    }
  }
  return out;
}

// `  notatio serve [--port N]       run the local HTTP compute host` -- an invocation at
// indent 2, its description after the column gap (or on the next, deeper-indented line).
const USAGE_ROW = /^ {2}(\S.*?)(?: {2,}(.*))?$/;
// `  -p, --precision <n> working precision in significant digits` -- one column gap is
// not reliable here, so the flag spelling itself is what gets matched.
const FLAG_ROW = /^\s*((?:-{1,2}[A-Za-z][\w-]*(?:,\s*)?)+(?:\s+<[^>]+>)?)\s+(\S.*)$/;

const invocations = rows(block(USAGE, "Usage:"), (line) => {
  const m = USAGE_ROW.exec(line);
  return m ? { spec: m[1].trimEnd(), description: m[2]?.trim() ?? "" } : undefined;
});

const flags = rows(block(USAGE, "Options:"), (line) => {
  const m = FLAG_ROW.exec(line);
  return m ? { spec: m[1].replace(/\s+/g, " ").trim(), description: m[2].trim() } : undefined;
});

// Generated docs are only worth having if they break when they drift: every flag the
// completion scripts offer must be documented in USAGE, and every subcommand too.
const documented = new Set(flags.flatMap((f) => f.spec.split(/[,\s]+/)));
const undocumented = FLAGS.filter((f) => !documented.has(f));
if (undocumented.length > 0)
  throw new Error(`cli.ts: flags missing from USAGE Options: ${undocumented.join(", ")}`);

/** `notatio forms | formats` documents two subcommands on one line, description included. */
function share(name: string, row: CliRow): string {
  const names = row.spec.replace(/^notatio\s+/, "").split(" | ");
  const parts = row.description.split(" | ");
  const i = names.indexOf(name);
  return i >= 0 && parts.length === names.length ? parts[i] : row.description;
}

const subcommands = SUBCOMMANDS.map((name) => {
  const row = invocations.find((r) => new RegExp(`^notatio\\b.*\\b${name}\\b`).test(r.spec));
  if (!row) throw new Error(`cli.ts: subcommand "${name}" missing from USAGE`);
  return { spec: name, description: share(name, row) };
});

export const cliData: CliData = {
  usage: USAGE,
  subcommands,
  flags,
  shells: [...SHELLS],
  forms: FORMS.map((name) => ({ name, label: FORM_LABEL[name] })),
  syntaxes: [...SYNTAXES],
};
