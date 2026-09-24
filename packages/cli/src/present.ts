// One expression as a terminal in a given environment shows it -- what the
// environments page's tty and pipe previews print. The same REPL, reduction and text
// surface as `:env`, and, where the environment can drive its controls, the same
// keyboard driver the Node REPL hands a result to.

import { can, type Environment } from "../../notatio/src/environment.ts";
import { dim, red } from "./ansi.ts";
import { Repl } from "./core.ts";
import { type DriveScreen, type Driver, drivable, driver } from "./drive.ts";
import { textOf } from "./textual.ts";

type Json = Parameters<typeof driver>[0];

export interface Presented {
  /** `In[1]:= …`, as the reader typed it. */
  echo: string;
  /** The result as text, or the error. */
  out: string;
  /** A driver for the controls, when the environment has an engine and keys for them. */
  driver?: Driver;
  /** The `Out` line for where a driver left the controls. */
  settle(pinned: Json): string;
}

/** Evaluate `input` for `env`; `screen` is where a driver, if there is one, draws. */
export function present(
  input: string,
  env: Environment,
  screen: Omit<DriveScreen, "show" | "color">,
): Presented {
  const color = env.colour !== "mono";
  const repl = new Repl({ color, environment: env });
  const echo = repl.prompt() + input;
  const { session } = repl;
  const out = repl.eval(input);
  const last = session.history.at(-1);
  const settle = (pinned: Json): string =>
    repl.formatOut(
      last?.n ?? 1,
      textOf(session, session.ce.box(pinned as never).evaluate().json as never),
    );
  if (last === undefined) return { echo, out: out.text || red("  no result", color), settle };
  const json = last.expr.json as Json;
  if (can.drive(env) && drivable(json)) {
    const d = driver(json, { ...screen, color, show: (e) => textOf(session, e as never) });
    if (d !== undefined) return { echo, out: "", driver: d, settle };
  }
  const reduced = repl.reduced(last.expr).json as Json;
  return { echo, out: repl.formatOut(last.n, textOf(session, reduced as never)), settle };
}

/** The line under a driven result that says how to pick the controls back up. */
export const resumeHint = (color: boolean): string => dim("  enter: drive again", color);
