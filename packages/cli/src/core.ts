// The I/O-agnostic REPL core. `Repl.eval(line)` takes one input line and returns
// styled text (ANSI) plus any structured side-effect (a graphic to draw, a clear,
// an exit). No streams, no readline, no file system — a Node bin, a browser
// terminal, and the golden tests all drive the same core. Node-only commands
// (:export / :import) are injected by the host via `commands`.

import {
  allFormats,
  exportFormats,
  importFormats,
  mimeTypeToFormatList,
} from "@enumeratio/formats";
import { bold, cyan, dim, red } from "./ansi.ts";
import {
  FORM_LABEL,
  FORMS,
  type PlotPoint,
  resolveForm,
  resolveSyntax,
  Session,
  type SessionDefaults,
  SYNTAXES,
} from "./engine.ts";

export type { PlotPoint };

export type GlyphKind = "permutation" | "partition" | "composition" | "subset" | "dyck";
export const GLYPH_KINDS: readonly GlyphKind[] = [
  "permutation",
  "partition",
  "composition",
  "subset",
  "dyck",
];

/** A graphic the core produced but did not draw — an adapter renders it. */
export type Graphic =
  | { kind: "plot"; expr: string; points: PlotPoint[] }
  | { kind: "glyph"; glyph: GlyphKind; values: number[]; caption: string };

export interface LineOutput {
  /** ANSI-styled text to show for this line (may be empty). */
  text: string;
  /** A figure to draw, if the line produced one. */
  graphic?: Graphic;
  /** The host should clear the screen. */
  clear?: boolean;
  /** The host should end the session. */
  exit?: boolean;
}

export type CommandHandler = (repl: Repl, arg: string) => LineOutput;

export interface ReplOptions {
  /** Emit ANSI colour (default true). */
  color?: boolean;
  /** Extra `:name` commands (e.g. a Node host adds :export / :import). */
  commands?: Record<string, CommandHandler>;
  /** Session defaults (display form, input syntax, precision). */
  defaults?: SessionDefaults;
}

/** Parse `[3,1,2]`, `3 1 2`, or `3,1,2` into an integer list. */
export function parseIntList(src: string): number[] {
  const t = src.trim();
  if (t.startsWith("[")) {
    const parsed = JSON.parse(t);
    if (Array.isArray(parsed)) return parsed.map(Number);
  }
  const nums = t.match(/-?\d+/g);
  if (!nums) throw new Error("expected a list of integers");
  return nums.map(Number);
}

export class Repl {
  readonly session: Session;
  color: boolean;
  private readonly extra: Map<string, CommandHandler>;

  constructor(opts: ReplOptions = {}) {
    this.session = new Session(opts.defaults);
    this.color = opts.color ?? true;
    this.extra = new Map(Object.entries(opts.commands ?? {}));
  }

  /** The 1-based number of the next `In[n]` line. */
  get lineNo(): number {
    return this.session.history.length + 1;
  }

  prompt(): string {
    return bold(`In[${this.lineNo}]:= `, this.color);
  }

  banner(): string {
    return (
      bold("notatio", this.color) +
      dim(" — compute-engine REPL. :help for commands, :quit to exit.", this.color)
    );
  }

  /** Evaluate one input line. */
  eval(line: string): LineOutput {
    const input = line.trim();
    if (!input) return { text: "" };
    try {
      if (input.startsWith(":")) return this.meta(input);
      if (/^let\s/.test(input)) return this.assignment(input);
      const res = this.session.evaluate(input);
      return { text: this.formatOut(res.n, this.session.render(res.expr)) };
    } catch (err) {
      return { text: red(`  error: ${(err as Error).message}`, this.color) };
    }
  }

  /** Style an `Out[n]= …` line (multi-line bodies start on the next line). */
  formatOut(n: number, body: string): string {
    const label = dim(`Out[${n}]= `, this.color);
    return body.includes("\n") ? `${label}\n${body}` : label + body;
  }

  private assignment(input: string): LineOutput {
    const m = /^let\s+([A-Za-z]\w*)\s*=\s*([\s\S]+)$/.exec(input);
    if (!m) throw new Error("usage: let <name> = <expr>");
    const res = this.session.assign(m[1], m[2]);
    return { text: this.formatOut(res.n, `${m[1]} = ${this.session.render(res.expr)}`) };
  }

  private meta(input: string): LineOutput {
    const cmd = input.slice(1).split(/\s+/, 1)[0];
    const arg = input.slice(1 + cmd.length).trim();
    const s = this.session;

    switch (cmd) {
      case "help":
        return { text: HELP };
      case "quit":
      case "exit":
      case "q":
        return { text: dim("bye.", this.color), exit: true };
      case "clear":
        return { text: "", clear: true };
      case "forms":
        return {
          text: FORMS.map(
            (f) =>
              `  ${f === s.form ? cyan("*", this.color) : " "} ${f.padEnd(9)} ${FORM_LABEL[f]}`,
          ).join("\n"),
        };
      case "form": {
        if (!arg) return { text: `  current form: ${s.form}` };
        const form = resolveForm(arg);
        if (!form) throw new Error(`unknown form: ${arg} (${FORMS.join(", ")})`);
        s.form = form;
        return { text: dim(`  form -> ${s.form}`, this.color) };
      }
      case "in": {
        const syntax = resolveSyntax(arg);
        if (!syntax) throw new Error(`unknown syntax: ${arg} (${SYNTAXES.join(", ")})`);
        s.defaultSyntax = syntax;
        return { text: dim(`  default input -> ${s.defaultSyntax}`, this.color) };
      }
      case "vars":
        if (s.vars.size === 0) return { text: dim("  (no variables)", this.color) };
        return {
          text: [...s.vars].map(([k, v]) => `  ${cyan(k, this.color)} = ${s.render(v)}`).join("\n"),
        };
      case "formats":
        return { text: formatsTable(s.form) };
      case "mime": {
        if (!arg) throw new Error("usage: :mime <type>");
        const list = mimeTypeToFormatList(arg);
        return { text: `  ${arg} -> ${list.length ? list.join(", ") : "(none)"}` };
      }
      case "plot":
        return this.plot(arg);
      case "glyph":
        return this.glyph(arg);
      // Syntax prefixes are evals, not meta commands.
      case "wl":
      case "wolfram":
      case "mj":
      case "json":
      case "mathjson":
      case "tex":
      case "latex":
      case "ep":
      case "epsil": {
        const res = s.evaluate(input);
        return { text: this.formatOut(res.n, s.render(res.expr)) };
      }
      default: {
        const handler = this.extra.get(cmd);
        if (handler) return handler(this, arg);
        throw new Error(`unknown command: :${cmd} (try :help)`);
      }
    }
  }

  private plot(arg: string): LineOutput {
    if (!arg) throw new Error("usage: :plot <expr>");
    const points = this.session.sample(arg);
    return {
      text: dim(`  plot(${arg})`, this.color),
      graphic: { kind: "plot", expr: arg, points },
    };
  }

  private glyph(arg: string): LineOutput {
    const [kind, ...rest] = arg.split(/\s+/);
    if (!(GLYPH_KINDS as readonly string[]).includes(kind))
      throw new Error(`usage: :glyph <${GLYPH_KINDS.join("|")}> <list>`);
    const caption = rest.join(" ");
    return {
      text: dim(`  ${kind}(${caption})`, this.color),
      graphic: { kind: "glyph", glyph: kind as GlyphKind, values: parseIntList(caption), caption },
    };
  }
}

/** The format registry as a text table; `current` marks the display form in a footer. */
export function formatsTable(current?: string): string {
  const rows = allFormats().map((f) => {
    const io = [f.encode ? "export" : "", f.decode ? "import" : ""].filter(Boolean).join("/");
    return `  ${f.name.padEnd(13)} .${f.extensions.join(" .").padEnd(9)} ${f.mimeTypes[0]}  [${io}]`;
  });
  const footer = current ? `\n  (display form: ${current})` : "";
  return `${rows.join("\n")}\n\n  export: ${exportFormats().join(", ")}\n  import: ${importFormats().join(", ")}${footer}`;
}

const HELP = `Commands:
  <expr>                 evaluate (Epsil by default; LaTeX goes in $…$ islands)
  :latex / :mathjson / :wolfram / :epsil <expr>   force an input syntax for one line
                         (short aliases: :tex, :mj or :json, :wl, :ep)
  let <name> = <expr>    bind a variable
  %  %%  %n              refer to the last / 2nd-last / n-th result
  :form [name]           show or set the display form (see :forms)
  :in <syntax>           default input syntax: latex | mathjson | wolfram | epsil
  :plot <expr>           plot a one-variable expression in x
  :glyph <kind> <list>   draw a combinatorial glyph: ${GLYPH_KINDS.join(" | ")}
  :export <path>         (node) write the last result / graphic; format from the extension
  :import <path>         (node) read a file as the next result; SVG/PNG load as a graphic
  :mime <type>           formats handling a MIME type (MIMETypeToFormatList)
  :formats  :forms  :vars  :clear  :help  :quit`;
