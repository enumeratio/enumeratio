/**
 * The small part of Epsil a route row writes its expressions in: a call
 * `Head(a, b)`, a list `[a, b]`, a name, an integer. Enough to put a
 * collection's parameters and an element's value into the expression behind a
 * row, and to recognize an answer as an element of a row (the same template,
 * read the other way). Epsil itself is read by the kernel, not here.
 */

export type Template =
  | { kind: 'call'; head: string; args: Template[] }
  | { kind: 'list'; items: Template[] }
  | { kind: 'name'; name: string }
  | { kind: 'integer'; text: string };

const open = '(';
const close = ')';
const listOpen = '[';
const listClose = ']';
const comma = ',';
/** MathJSON's head for a list. */
export const listHead = 'List';

export function parseTemplate(text: string): Template {
  let at = 0;
  const skip = (): void => {
    while (text[at] === ' ') at++;
  };
  const fail = (what: string): never => {
    throw new Error(`cannot read the expression “${text}”: ${what} at ${at}`);
  };
  const sequence = (until: string): Template[] => {
    const out: Template[] = [];
    skip();
    if (text[at] === until) {
      at++;
      return out;
    }
    for (;;) {
      out.push(term());
      skip();
      if (text[at] === comma) at++;
      else if (text[at] === until) {
        at++;
        return out;
      } else fail(`expected “${comma}” or “${until}”`);
    }
  };
  const term = (): Template => {
    skip();
    if (text[at] === listOpen) {
      at++;
      return { kind: 'list', items: sequence(listClose) };
    }
    const number = /^-?\d+/.exec(text.slice(at));
    if (number) {
      at += number[0].length;
      return { kind: 'integer', text: number[0] };
    }
    const word = /^[A-Za-z][A-Za-z0-9]*/.exec(text.slice(at));
    if (!word) return fail('expected a name, an integer or a list');
    at += word[0].length;
    if (text[at] === open) {
      at++;
      return { kind: 'call', head: word[0], args: sequence(close) };
    }
    return { kind: 'name', name: word[0] };
  };
  const out = term();
  skip();
  if (at !== text.length) fail('something is left over');
  return out;
}

/** Every bare name in a template: its variables, and any symbol it names. */
export function namesOf(t: Template, into = new Set<string>()): Set<string> {
  if (t.kind === 'name') into.add(t.name);
  else if (t.kind === 'call') for (const a of t.args) namesOf(a, into);
  else if (t.kind === 'list') for (const a of t.items) namesOf(a, into);
  return into;
}

/** Every head a template calls. */
export function headsOf(t: Template, into = new Set<string>()): Set<string> {
  if (t.kind === 'call') {
    into.add(t.head);
    for (const a of t.args) headsOf(a, into);
  } else if (t.kind === 'list') for (const a of t.items) headsOf(a, into);
  return into;
}

/** The template as Epsil, each variable replaced by the text bound to it. */
export function writeTemplate(t: Template, bound: ReadonlyMap<string, string>): string {
  switch (t.kind) {
    case 'integer':
      return t.text;
    case 'name':
      return bound.get(t.name) ?? t.name;
    case 'list':
      return `${listOpen}${t.items.map((i) => writeTemplate(i, bound)).join(`${comma} `)}${listClose}`;
    case 'call':
      return `${t.head}${open}${t.args.map((a) => writeTemplate(a, bound)).join(`${comma} `)}${close}`;
  }
}

/** MathJSON. */
export type Json = unknown;

const integerOf = (json: Json): string | undefined => {
  if (typeof json === 'number' && Number.isInteger(json)) return String(json);
  if (typeof json === 'bigint') return String(json);
  if (json !== null && typeof json === 'object' && 'num' in json) {
    const num = String((json as { num: unknown }).num);
    return /^-?\d+$/.test(num) ? num : undefined;
  }
  return undefined;
};

/**
 * Reads MathJSON against a template: the value each variable stands for, or
 * undefined when the expression is not of this shape.
 */
export function matchTemplate(
  t: Template,
  json: Json,
  variables: ReadonlySet<string>,
  into = new Map<string, Json>(),
): Map<string, Json> | undefined {
  switch (t.kind) {
    case 'integer':
      return integerOf(json) === t.text ? into : undefined;
    case 'name':
      if (variables.has(t.name)) {
        into.set(t.name, json);
        return into;
      }
      return json === t.name ? into : undefined;
    case 'list':
    case 'call': {
      const head = t.kind === 'list' ? listHead : t.head;
      const parts = t.kind === 'list' ? t.items : t.args;
      if (!Array.isArray(json) || json[0] !== head || json.length !== parts.length + 1) {
        return undefined;
      }
      for (const [i, part] of parts.entries()) {
        if (!matchTemplate(part, json[i + 1], variables, into)) return undefined;
      }
      return into;
    }
  }
}
