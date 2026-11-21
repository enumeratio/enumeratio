import type { Answer, Ask } from '@enumeratio/kernel';
import { createNodeKernel } from '@enumeratio/kernel/node';
import descriptions from 'virtual:notatio-descriptions';
import type { Env } from '../src/live.ts';
import { type Page, renderPage } from '../src/pages.ts';

/** One kernel for a test file, as a page has one. */
const kernel = createNodeKernel();

/** The same kernel, asked directly. */
export const askKernel: Ask = kernel;

export interface Computed {
  page: Page;
  /** Every expression the page asked, with its answer, in order. */
  asked: Answer[];
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
  const ask: Ask = async (epsil, options) => {
    const answer = await kernel(epsil, options);
    asked.push(answer);
    return answer;
  };
  const env: Env = { ask, describe: async (name) => descriptions[name] };
  const movedTo = await page.moveTo?.(env);
  const nonMember = (await page.nonMember?.(env)) ?? false;
  const sections = new Map<string, string>();
  for (const section of page.sections ?? []) {
    sections.set(section.id, (await section.run(env)).value);
  }
  return {
    page,
    asked,
    nonMember,
    sections,
    ...(movedTo === undefined ? {} : { movedTo }),
    html: page.body.value + [...sections.values()].join('\n'),
  };
}

/** The answer a page got for one expression, as text: the value in Epsil, or the status when there is none. */
export function valueOf(computed: Computed, epsil: string): string | undefined {
  const answer = computed.asked.find((a) => a.asked === epsil);
  if (!answer) return undefined;
  return answer.status === 'value' ? answer.epsil : answer.status;
}
