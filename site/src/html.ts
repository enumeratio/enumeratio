/** Markup that is already safe to insert. Everything else interpolated by `h` is escaped. */
export class Safe {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

export type Part = string | number | Safe | null | undefined | false | readonly Part[];

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function render(part: Part): string {
  if (part === null || part === undefined || part === false) return '';
  if (part instanceof Safe) return part.value;
  if (Array.isArray(part)) return part.map(render).join('');
  return escapeHtml(String(part));
}

/** A tagged template: `h\`<p>${text}</p>\`` escapes `text`, and trusts nested `h` results. */
export function h(strings: TemplateStringsArray, ...values: Part[]): Safe {
  let out = strings[0] ?? '';
  values.forEach((value, i) => {
    out += render(value) + (strings[i + 1] ?? '');
  });
  return new Safe(out);
}

export const code = (text: string): Safe => h`<code>${text}</code>`;
