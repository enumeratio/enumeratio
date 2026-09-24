import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "./index.ts";

// Messages, the way Wolfram does them: a head that declines to evaluate still returns
// `undefined` -- the call stays unevaluated, it is not an ["Error", …] -- but it can say
// WHY, as `Head::code` with arguments spliced into a template the head defined
// (`PowerMod::ninv: 2 is not invertible modulo 4.`).
//
// Everything lives on the engine, not in this module, so two bundled copies of this
// package still meet: templates are per engine like any other definition, and a caller
// collects what one evaluation emitted by wrapping it in `collectMessages`. An emit with
// no collector open goes nowhere.

export interface Message {
  readonly head: string;
  readonly code: string;
  /** The arguments, as text, in template order. */
  readonly args: readonly string[];
  /** The template with its arguments spliced in. */
  readonly text: string;
  /** A follow-up: a did-you-mean, or what would have worked. */
  readonly hint?: string;
}

interface Channel {
  readonly templates: Map<string, string>;
  readonly sinks: Message[][];
}

const CHANNEL = Symbol.for("@enumeratio/boxed/messages");

function channelOf(ce: ComputeEngine): Channel {
  const host = ce as unknown as { [CHANNEL]?: Channel };
  return (host[CHANNEL] ??= { templates: new Map(), sinks: [] });
}

/** `head::code = template`, for each code. Slots are `` `1` ``, `` `2` ``, … as in Wolfram. */
export function defineMessages(
  ce: ComputeEngine,
  head: string,
  templates: Readonly<Record<string, string>>,
): void {
  const { templates: table } = channelOf(ce);
  for (const [code, template] of Object.entries(templates)) table.set(`${head}::${code}`, template);
}

const isBoxed = (x: unknown): x is BoxedExpression =>
  typeof x === "object" && x !== null && "operator" in x && "json" in x;

/** An argument as text: a symbol by name, a list bracketed, anything else as the engine prints it. */
export function formatArgument(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(formatArgument).join(", ")}]`;
  if (!isBoxed(x)) return String(x);
  if (x.operator === "List") return formatArgument([...operandsOf(x)]);
  return symbolNameOf(x) ?? x.toString();
}

const splice = (template: string, args: readonly string[]): string =>
  template.replace(/`(\d+)`/g, (slot, n: string) => args[Number(n) - 1] ?? slot);

/** Say why `head` declined, to whoever is collecting on `ce`. */
export function emit(
  ce: ComputeEngine,
  head: string,
  code: string,
  args: readonly unknown[] = [],
  hint?: string,
): void {
  const { templates, sinks } = channelOf(ce);
  if (sinks.length === 0) return;
  const texts = args.map(formatArgument);
  const template = templates.get(`${head}::${code}`);
  const message: Message = {
    head,
    code,
    args: texts,
    text: template === undefined ? texts.join(", ") : splice(template, texts),
    ...(hint === undefined ? {} : { hint }),
  };
  // Evaluation can revisit a subexpression (a lazy head evaluates its operands, then the
  // result is evaluated again), so the same message arrives more than once.
  for (const sink of sinks) {
    if (!sink.some((m) => m.head === head && m.code === code && m.text === message.text)) {
      sink.push(message);
    }
  }
}

/** Run `fn`, returning what it returned and every message emitted on `ce` meanwhile. */
export function collectMessages<T>(
  ce: ComputeEngine,
  fn: () => T,
): { value: T; messages: readonly Message[] } {
  const { sinks } = channelOf(ce);
  const sink: Message[] = [];
  sinks.push(sink);
  try {
    return { value: fn(), messages: sink };
  } finally {
    sinks.splice(sinks.lastIndexOf(sink), 1);
  }
}

/** `Head::code: text` -- the one-line form a terminal prints. */
export const messageLine = (m: Message): string =>
  `${m.head}::${m.code}: ${m.text}${m.hint === undefined ? "" : ` ${m.hint}`}`;
