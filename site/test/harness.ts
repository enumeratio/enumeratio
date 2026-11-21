import { type Answer, type Ask, type AskText, plain, sameJson } from '@enumeratio/kernel';
import { parseCell } from '@enumeratio/kernel/parse-cells';
import { createNodeKernel } from '@enumeratio/kernel/node';
import { renderSummary } from '@notatio/formats/typeset';
import descriptions from 'virtual:notatio-descriptions';
import type { Env } from '../src/live.ts';
import { type Page, renderPage } from '../src/pages.ts';

/** One kernel for a test file, as a page has one. */
const kernel = createNodeKernel();

/** The same kernel, asked directly. */
export const askKernel: Ask = kernel.ask;
/** The same kernel, asked what a person typed: Epsil as text. */
export const askKernelText = kernel.askText;
/** notatio's printer, as the page reaches it. */
export const printJson = kernel.print;

export interface Computed {
  page: Page;
  /** Every expression the page asked, with its answer, in order. */
  asked: Answer[];
  /** Every expression the page had the kernel print without asking it, with its MathJSON. */
  printed: { json: unknown; text: string }[];
  /** Each computed section's markup, by id. */
  sections: Map<string, string>;
  /** True when the kernel found the element is not a member: the page then has no canonical form. */
  nonMember: boolean;
  /** Where the page moved once the kernel had answered. */
  movedTo?: string;
  /** The shell and every section, as one string. */
  html: string;
}

/** Draws a page as the router does, then computes its sections with the kernel in Node. */
export async function compute(pathname: string, search = ''): Promise<Computed> {
  const page = renderPage(pathname, search);
  const asked: Answer[] = [];
  const printed: Computed['printed'] = [];
  const ask: Ask = async (json, options) => {
    const answer = await kernel.ask(json, options);
    asked.push(answer);
    return answer;
  };
  const askText: AskText = async (text, options) => {
    const answer = await kernel.askText(text, options);
    asked.push(answer);
    return answer;
  };
  const env: Env = {
    ask,
    askText,
    print: async (json) => {
      const text = await kernel.print(json);
      printed.push({ json, text });
      return text;
    },
    describe: async (name) => descriptions[name],
    typeset: renderSummary,
  };
  const movedTo = await page.moveTo?.(env);
  const nonMember = (await page.nonMember?.(env)) ?? false;
  const sections = new Map<string, string>();
  for (const section of page.sections ?? []) {
    sections.set(section.id, (await section.run(env)).value);
  }
  return {
    page,
    asked,
    printed,
    nonMember,
    sections,
    ...(movedTo === undefined ? {} : { movedTo }),
    html: page.body.value + [...sections.values()].join('\n'),
  };
}

/** An expression written here as Epsil text, as the MathJSON notatio's parser reads it. */
export const jsonOf = (epsil: string): unknown => plain(parseCell(epsil).json);

/**
 * Whether an answer is to this expression, written here as Epsil text: the text is read by
 * notatio's parser and compared as MathJSON with what the page sent, so a test does not depend on
 * how the printer spells it.
 */
export const isTo = (answer: Answer, epsil: string): boolean =>
  answer.question === undefined
    ? answer.asked === epsil
    : sameJson(plain(answer.question), jsonOf(epsil));

/** The answer a page got for one expression, as text: the value in Epsil, or the status when there is none. */
export function valueOf(computed: Computed, epsil: string): string | undefined {
  const answer = computed.asked.find((a) => isTo(a, epsil));
  if (!answer) return undefined;
  return answer.status === 'value' ? answer.epsil : answer.status;
}
