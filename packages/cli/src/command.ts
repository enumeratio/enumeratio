// Command mode: parse argv, run one thing, return what to print. Pure — argv
// (+ piped stdin, + host defaults) in, {stdout, stderr, code} out — so the Node
// bin is a thin wrapper and the behaviour is golden-testable. Subcommands:
// `eval` (the default), `convert`, `forms`, `formats`, `completion`; `serve` is
// Node-only and handled by the bin before it gets here.

import type { BoxedExpression } from "@cortex-js/compute-engine";
import { allFormats } from "@enumeratio/formats";
import {
  can,
  type Environment,
  ENVIRONMENTS,
  environmentNamed,
  PIPE,
} from "../../notatio/src/environment.ts";
import { evaluateReadouts, reduce } from "../../notatio/src/reduce.ts";
import { completionScript, type Shell, SHELLS, SUBCOMMANDS } from "./completion.ts";
import { formatsTable } from "./core.ts";
import {
  type Form,
  FORM_LABEL,
  FORMS,
  renderForm,
  resolveForm,
  resolveSyntax,
  Session,
  type SessionDefaults,
  type Syntax,
  SYNTAXES,
} from "./engine.ts";

const VERSION = "0.0.0";

export const USAGE = `notatio — evaluate compute-engine expressions

Usage:
  notatio [options] <expr>       evaluate <expr> and print the result
  notatio eval [options] <expr>  same, explicit
  notatio convert [options] <expr>
                                 re-render <expr> in another form without evaluating
  echo <expr> | notatio          read the expression from stdin (or pass "-")
  notatio                        (a TTY, no expr) start the interactive REPL
  notatio forms | formats        list the output forms | the format registry
  notatio completion <shell>     print a completion script: ${SHELLS.join(", ")}
  notatio serve [--port N]       run the local HTTP compute host

Options:
  -f, --form <name>   output form: ${FORMS.join(", ")}
                      (repeatable; Wolfram names like TeXForm, InputForm, FullForm work too)
  -i, --in <syntax>   input syntax: ${SYNTAXES.join(", ")} (default epsil)
  -c <expr>           the expression to evaluate
  -N, --numeric       numeric approximation of the result
  -p, --precision <n> working precision in significant digits
      --env <name>    reduce the result for an environment: ${ENVIRONMENTS.map((e) => e.name).join(", ")}
                      (text output defaults to pipe: controls pin, with a caption)
      --json          print a structured result: { ok, input, syntax, form, result, forms }
  -h, --help          show this help
  -V, --version       show the version

Defaults for --form, --in, and --precision can live in a config file
($NOTATIO_CONFIG, ~/.config/notatio/config.json, or ~/.notatiorc).
`;

export interface EvalRequest {
  input: string;
  /** Input syntax (default: the session default, Epsil). */
  syntax?: Syntax;
  /** Forms to render, in order; the first is the primary `form`/`result`. Default `["notatio"]`. */
  forms?: readonly Form[];
  /** Evaluate the parsed expression (default true); false converts it as written. */
  evaluate?: boolean;
  /** Force a numeric approximation of the result (`N`). */
  numeric?: boolean;
  /** Working precision in significant digits. */
  precision?: number;
  /**
   * Reduce the result for an environment that cannot drive it (a pipe pins the
   * controls, captions the declarations); omitted, the result is left as it is.
   */
  environment?: Environment;
}

export interface EvalOk {
  ok: true;
  input: string;
  syntax: Syntax;
  form: Form;
  /** The result rendered in the primary form. */
  result: string;
  /** Every requested form, rendered. */
  forms: Partial<Record<Form, string>>;
}

export interface EvalError {
  ok: false;
  input: string;
  error: string;
}

export type EvalReply = EvalOk | EvalError;

/**
 * One structured evaluation: a request in, a plain reply out. The seam under
 * every command surface — `eval`/`convert` (text or `--json`) and `POST /eval`
 * on the serve host — so they agree on what a result looks like.
 */
export function evaluateCommand(req: EvalRequest, defaults: SessionDefaults = {}): EvalReply {
  const forms = req.forms?.length ? [...new Set(req.forms)] : [defaults.form ?? "notatio"];
  const session = new Session({
    ...defaults,
    syntax: req.syntax ?? defaults.syntax,
    precision: req.precision ?? defaults.precision,
  });
  try {
    let expr: BoxedExpression;
    let syntax: Syntax;
    if (req.evaluate === false) {
      ({ raw: expr, syntax } = session.parse(req.input));
    } else {
      ({ expr, syntax } = session.evaluate(req.input));
    }
    if (req.environment !== undefined && !can.drive(req.environment) && req.evaluate !== false) {
      // Only a result with something to reduce is re-evaluated; the rest stays as evaluated.
      const reduced = evaluateReadouts(
        reduce(expr.json as never, req.environment),
        (e) => session.ce.box(e as never).evaluate().json as never,
      );
      if (JSON.stringify(reduced) !== JSON.stringify(expr.json)) {
        expr = session.ce.box(reduced as never).evaluate();
      }
    }
    if (req.numeric) expr = expr.N();
    // The primary form must render; a secondary one that can't is just left out.
    const result = render(expr, forms[0]);
    const rendered: Partial<Record<Form, string>> = { [forms[0]]: result };
    for (const f of forms.slice(1)) {
      try {
        rendered[f] = render(expr, f);
      } catch {
        // not every expression has every form (code targets need numeric input)
      }
    }
    return { ok: true, input: req.input, syntax, form: forms[0], result, forms: rendered };
  } catch (err) {
    return { ok: false, input: req.input, error: (err as Error).message };
  }
}

function render(expr: BoxedExpression, form: Form): string {
  const out = renderForm(expr, form);
  if (out === "") throw new Error(`no ${FORM_LABEL[form]} for this expression`);
  return out;
}

/**
 * The wire shape (`--json`, `/eval`): the same object, with `forms.mathjson`
 * carried as JSON rather than a string of JSON (`result` stays text).
 */
export function toWire(res: EvalReply): Record<string, unknown> {
  if (!res.ok) return { ...res };
  const forms: Record<string, unknown> = { ...res.forms };
  if (typeof forms.mathjson === "string") forms.mathjson = JSON.parse(forms.mathjson);
  return { ...res, forms };
}

/** The format registry as plain data (`formats --json`, `GET /formats`). */
export function formatsJson(): Record<string, unknown>[] {
  return allFormats().map((f) => ({
    name: f.name,
    aliases: f.aliases,
    mimeTypes: f.mimeTypes,
    extensions: f.extensions,
    binary: f.binary,
    import: f.decode !== undefined,
    export: f.encode !== undefined,
  }));
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

/** Split a command line into argv, respecting single/double quotes. */
export function splitArgs(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null = re.exec(line);
  while (m !== null) {
    out.push(m[1] ?? m[2] ?? m[3] ?? "");
    m = re.exec(line);
  }
  return out;
}

const ok = (stdout: string): CommandResult => ({ stdout, stderr: "", code: 0 });
const usageError = (msg: string): CommandResult => ({ stdout: "", stderr: `${msg}\n`, code: 2 });

interface ParsedArgs {
  subcommand: (typeof SUBCOMMANDS)[number];
  positional: string[];
  expr?: string;
  forms: string[];
  syntax?: string;
  numeric: boolean;
  precision?: string;
  json: boolean;
  /** `--env <name>`: the environment to reduce the result for. */
  env?: string;
  /** `-` was given: the expression is on stdin even if a positional exists. */
  stdin: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs | CommandResult {
  const args = [...argv];
  const p: ParsedArgs = {
    subcommand: "eval",
    positional: [],
    forms: [],
    numeric: false,
    json: false,
    stdin: false,
  };
  if ((SUBCOMMANDS as readonly string[]).includes(args[0]))
    p.subcommand = args.shift() as ParsedArgs["subcommand"];

  while (args.length > 0) {
    const a = args.shift() as string;
    if (a === "-h" || a === "--help") return ok(USAGE);
    if (a === "-V" || a === "--version") return ok(`${VERSION}\n`);
    if (a === "-") p.stdin = true;
    else if (a === "-c") p.expr = args.shift();
    else if (a === "-f" || a === "--form") p.forms.push(args.shift() ?? "");
    else if (a.startsWith("--form=")) p.forms.push(a.slice("--form=".length));
    else if (a === "-i" || a === "--in") p.syntax = args.shift();
    else if (a.startsWith("--in=")) p.syntax = a.slice("--in=".length);
    else if (a === "-N" || a === "--numeric") p.numeric = true;
    else if (a === "-p" || a === "--precision") p.precision = args.shift();
    else if (a.startsWith("--precision=")) p.precision = a.slice("--precision=".length);
    else if (a === "--env") p.env = args.shift();
    else if (a.startsWith("--env=")) p.env = a.slice("--env=".length);
    else if (a === "--json") p.json = true;
    else if (a.startsWith("-") && a.length > 1) return usageError(`unknown option: ${a}`);
    else p.positional.push(a);
  }
  return p;
}

/**
 * Parse argv (already sliced past `node bin`) and run once. `stdin` is the
 * piped input, if any; `defaults` come from the host (a config file).
 */
export function runCommand(
  argv: readonly string[],
  stdin?: string,
  defaults: SessionDefaults = {},
): CommandResult {
  const parsed = parseArgs(argv);
  if ("code" in parsed) return parsed;

  switch (parsed.subcommand) {
    case "forms":
      return listForms(parsed.json, defaults.form ?? "notatio");
    case "formats":
      return parsed.json ? ok(`${JSON.stringify(formatsJson())}\n`) : ok(`${formatsTable()}\n`);
    case "completion": {
      const shell = parsed.positional[0];
      if (!(SHELLS as readonly string[]).includes(shell))
        return usageError(`usage: notatio completion <${SHELLS.join("|")}>`);
      return ok(completionScript(shell as Shell));
    }
    case "serve":
      return usageError("serve needs a Node host (run the notatio bin)");
    case "eval":
    case "convert":
      return evaluate(parsed, stdin, defaults);
  }
}

function evaluate(
  p: ParsedArgs,
  stdin: string | undefined,
  defaults: SessionDefaults,
): CommandResult {
  const expr = p.stdin ? stdin?.trim() : (p.expr ?? p.positional[0] ?? stdin?.trim());
  if (!expr) return usageError(USAGE.trimEnd());

  const chosen = p.env === undefined ? undefined : environmentNamed(p.env);
  if (p.env !== undefined && chosen === undefined)
    return usageError(
      `unknown environment: ${p.env} (${ENVIRONMENTS.map((e) => e.name).join(", ")})`,
    );

  const forms: Form[] = [];
  for (const name of p.forms) {
    const form = resolveForm(name);
    if (!form) return usageError(`unknown form: ${name} (${FORMS.join(", ")})`);
    forms.push(form);
  }
  // Structured output carries the interchange forms too, unless forms were named.
  if (p.json && forms.length === 0)
    forms.push(defaults.form ?? "notatio", "tex", "mathjson", "wolfram");

  let syntax: Syntax | undefined;
  if (p.syntax !== undefined) {
    syntax = resolveSyntax(p.syntax);
    if (!syntax) return usageError(`unknown syntax: ${p.syntax} (${SYNTAXES.join(", ")})`);
  }

  let precision: number | undefined;
  if (p.precision !== undefined) {
    precision = Number(p.precision);
    if (!Number.isInteger(precision) || precision < 1)
      return usageError(`--precision expects a positive integer, got ${p.precision}`);
  }

  const res = evaluateCommand(
    {
      input: expr,
      syntax,
      forms,
      evaluate: p.subcommand !== "convert",
      numeric: p.numeric,
      precision,
      // Text on stdout is going to a pipe or a page, never a reader with keys; the
      // structured reply keeps the expression whole for whoever asked. `--env` names
      // another one to reduce for -- `print` samples a control into small multiples.
      environment: chosen ?? (p.json ? undefined : PIPE),
    },
    defaults,
  );
  if (p.json)
    return { stdout: `${JSON.stringify(toWire(res))}\n`, stderr: "", code: res.ok ? 0 : 1 };
  if (!res.ok) return { stdout: "", stderr: `error: ${res.error}\n`, code: 1 };
  // One line per requested form, in the order asked; a form that couldn't render is noted.
  const lines = (forms.length ? forms : [res.form]).map(
    (f) => res.forms[f] ?? `(no ${FORM_LABEL[f]} for this expression)`,
  );
  return ok(`${lines.join("\n")}\n`);
}

function listForms(json: boolean, current: Form): CommandResult {
  if (json)
    return ok(
      `${JSON.stringify(FORMS.map((f) => ({ name: f, label: FORM_LABEL[f], default: f === current })))}\n`,
    );
  const rows = FORMS.map((f) => `  ${f === current ? "*" : " "} ${f.padEnd(9)} ${FORM_LABEL[f]}`);
  return ok(`${rows.join("\n")}\n`);
}
