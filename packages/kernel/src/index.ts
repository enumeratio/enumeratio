/**
 * What a page asks of the kernel and what it gets back, whichever side of a
 * worker the kernel runs on.
 */

/** MathJSON. */
export type Json = unknown;

/** How long one request may run before the kernel gives up on it, in milliseconds. */
export const askTimeMs = 5000;

export interface Answer {
  /**
   * The Epsil that was asked: written by notatio's printer in the kernel, from the MathJSON the
   * page sent (or, for what a visitor typed, the text as typed). Nothing here writes Epsil.
   */
  asked: string;
  /** The MathJSON the page sent, as it sent it; absent for what a visitor typed. */
  question?: Json;
  /**
   * `value`: the kernel answered. `declined`: it left the expression as it was
   * asked, or ran out of time; a page says "not computed" and never shows an
   * empty result or a zero in its place. `error`: the text could not be read,
   * or the kernel reported an error.
   */
  status: 'value' | 'declined' | 'error';
  /** The answer as MathJSON (for `declined`, the expression as it was left). */
  json?: Json;
  /** The answer written in Epsil. */
  epsil?: string;
  /** The input as the kernel parsed it. */
  input?: Json;
  /** Why there is no value. */
  reason?: string;
}

/** Evaluates MathJSON. Never rejects: a failure is an answer with a status. */
export type Ask = (json: Json, options?: AskOptions) => Promise<Answer>;

/** Evaluates the text a visitor typed (Epsil, read by notatio's parser). Never rejects. */
export type AskText = (text: string, options?: AskOptions) => Promise<Answer>;

/** MathJSON as Epsil, written by notatio's own InputForm printer, as one line. Never rejects. */
export type Print = (json: Json) => Promise<string>;

/** What a page has of its kernel. */
export interface Kernel {
  ask: Ask;
  askText: AskText;
  print: Print;
}

/** A printer's reply as text: one line, or the MathJSON itself when the printer declined. */
export const printedAs = (json: Json, written: string | undefined): string =>
  written === undefined ? JSON.stringify(json) : oneLine(written);

export interface AskOptions {
  /** The expression is expected to stand as written (an element's constructor): not a decline. */
  holds?: boolean;
}

/** What either kind of kernel returns for one request. */
export interface RawAnswer {
  value?: Json;
  boxes?: unknown;
  input?: Json;
  error?: string;
  messages?: readonly unknown[];
}

const aborted = 'Aborted';
/** Heads and symbols that say "no value" rather than being one. */
const noValue = new Set(['Missing', 'Undefined', 'Nothing', 'NaN', 'Error', aborted]);

export const headOf = (json: Json): string | undefined =>
  Array.isArray(json) && typeof json[0] === 'string' ? json[0] : undefined;

export const operandsOf = (json: Json): Json[] => (Array.isArray(json) ? json.slice(1) : []);

export function sameJson(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => sameJson(x, b[i]));
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function hasError(json: Json): boolean {
  if (!Array.isArray(json)) return false;
  return json[0] === 'Error' || json.some(hasError);
}

/**
 * MathJSON without its bookkeeping: the kernel returns the parsed input with
 * source offsets and numbers as `{ num }`, and an answer without them.
 */
export function plain(json: Json): Json {
  if (Array.isArray(json)) return json.map(plain);
  if (json !== null && typeof json === 'object') {
    const o = json as { fn?: Json; num?: unknown; sym?: unknown; str?: unknown };
    if (o.fn !== undefined) return plain(o.fn);
    if (o.num !== undefined) {
      const n = Number(o.num);
      return Number.isSafeInteger(n) ? n : { num: String(o.num) };
    }
    if (typeof o.sym === 'string') return o.sym;
    if (typeof o.str === 'string') return `'${o.str}'`;
  }
  return json;
}

interface KernelMessage {
  code?: string;
  text?: string;
}
/** Message codes that say the kernel refused the arguments rather than computed. */
const refusals = new Set(['argtype', 'argcount', 'argx', 'argrx', 'argt']);

interface DisplayText {
  text?: { inputform?: string };
}

/**
 * Epsil as one line. The kernel breaks a long list over several lines with a trailing comma
 * (`[\n  1,\n  2,\n]`); every list prints as `[1, 2, 3]` through this one function.
 */
export function oneLine(text: string): string {
  if (!text.includes('\n')) return text;
  return text
    .replaceAll(/\s*\n\s*/g, ' ')
    .replaceAll(/([[({])\s+/g, '$1')
    .replaceAll(/,?\s+([\])}])/g, '$1')
    .replaceAll(/,([\])}])/g, '$1')
    .trim();
}

/**
 * Reads a kernel's reply. An answer equal to its own input was left
 * unevaluated: that is a decline, unless the caller says the expression is
 * expected to stand as written (`holds`: an element's constructor does).
 */
export function answerOf(asked: string, raw: RawAnswer, holds = false): Answer {
  if (raw.error !== undefined) return { asked, status: 'error', reason: raw.error };
  const json = raw.value;
  const shownForm = (raw.boxes as DisplayText | undefined)?.text?.inputform;
  const epsil = shownForm === undefined ? undefined : oneLine(shownForm);
  const base = {
    asked,
    json,
    ...(epsil === undefined ? {} : { epsil }),
    ...(raw.input === undefined ? {} : { input: raw.input }),
  };
  if (json === undefined || json === aborted) {
    return { asked, status: 'declined', reason: 'The kernel ran out of time.' };
  }
  if (hasError(json)) return { ...base, status: 'error', reason: 'The kernel reported an error.' };
  const head = headOf(json);
  if (
    (typeof json === 'string' && noValue.has(json)) ||
    (head !== undefined && noValue.has(head))
  ) {
    return { ...base, status: 'declined', reason: 'The kernel has no value for this.' };
  }
  if (!holds && Array.isArray(json)) {
    const refusal = (raw.messages as readonly KernelMessage[] | undefined)?.find(
      (m) => m.code !== undefined && refusals.has(m.code),
    );
    if (refusal) {
      return { ...base, status: 'declined', reason: refusal.text ?? 'The kernel refused it.' };
    }
    if (raw.input !== undefined && sameJson(plain(json), plain(raw.input))) {
      return { ...base, status: 'declined', reason: 'The kernel left the expression unevaluated.' };
    }
  }
  return { ...base, status: 'value' };
}
