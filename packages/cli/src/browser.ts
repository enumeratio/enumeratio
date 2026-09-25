// Browser-safe surface of the CLI: the eval core, command runner, ANSI helpers,
// and the demo corpus. No Node builtins on this path (the terminal element and
// any other browser host import from here). Node-only pieces (readline loop,
// file I/O, PNG rasterization) live in ./index.ts and are never reachable here.

export {
  type CommandHandler,
  type Graphic,
  type GlyphKind,
  GLYPH_KINDS,
  type LineOutput,
  parseIntList,
  type PlotPoint,
  Repl,
  type ReplOptions,
} from "./core.ts";
export {
  type CommandResult,
  type EvalError,
  type EvalOk,
  type EvalReply,
  type EvalRequest,
  evaluateCommand,
  formatsJson,
  runCommand,
  splitArgs,
  toWire,
  USAGE,
} from "./command.ts";
export { completionScript, FLAGS, type Shell, SHELLS, SUBCOMMANDS } from "./completion.ts";
export {
  type Classified,
  classifyInput,
  type EvalResult,
  type Form,
  FORM_LABEL,
  FORMS,
  type Parsed,
  renderForm,
  resolveForm,
  resolveSyntax,
  type SampleOptions,
  Session,
  type SessionDefaults,
  type Syntax,
  SYNTAXES,
} from "./engine.ts";
export { type DriveScreen, type Driver, drivable, driver, type Key, keysOf } from "./drive.ts";
export { textOf } from "./textual.ts";
export { type Presented, present, resumeHint } from "./present.ts";
export { blue, bold, cyan, dim, green, magenta, red, stripAnsi, yellow } from "./ansi.ts";
export { CLI_DEMOS, cliDemosByCategory, type Demo, DEMOS, demosByCategory, HIGHLIGHTED } from "./demos.ts";
