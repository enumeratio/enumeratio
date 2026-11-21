/**
 * The page's side of its kernel: one worker per page, started the first time a
 * page asks for something, after the shell is drawn. The worker and the session
 * protocol are notatio's (`@notatio/evaluation`). The page sends MathJSON; the
 * Epsil a page shows is written in the worker, by notatio's printer.
 */
import {
  type Answer,
  type AskOptions,
  type Json,
  type Kernel,
  answerOf,
  askTimeMs,
  printedAs,
} from '@enumeratio/kernel';
import { type BrowserSession, type WorkerLike, openSession } from '@notatio/evaluation/browser';
import type { Env } from './live.ts';

let session: BrowserSession | undefined;

function open(): BrowserSession {
  // The URL and the options are literals here so that the build finds the worker and bundles it.
  session ??= openSession({
    createWorker: () =>
      new Worker(new URL('./kernel-worker.ts', import.meta.url), {
        type: 'module',
      }) as unknown as WorkerLike,
  });
  return session;
}

const print = async (json: Json): Promise<string> => {
  try {
    const written = await open().evaluate(json, { write: 'epsil' });
    return printedAs(json, written.error === undefined ? written.written : undefined);
  } catch {
    return printedAs(json, undefined);
  }
};

/** One request, evaluated; `asked` is what the page shows as the expression behind the answer. */
async function evaluate(
  asked: string,
  json: Json,
  source: { text: string; format: string } | undefined,
  holds: boolean | undefined,
): Promise<Answer> {
  try {
    const answer = await open().evaluate(json, {
      ...(source === undefined ? {} : { source }),
      timeMs: askTimeMs,
    });
    if (answer.reset) {
      return { asked, status: 'declined', reason: 'The kernel was stopped and restarted.' };
    }
    return answerOf(asked, answer, holds);
  } catch (error) {
    return { asked, status: 'declined', reason: `No kernel: ${String(error)}` };
  }
}

const kernel: Kernel = {
  print,
  ask: async (json: Json, options: AskOptions = {}) => ({
    ...(await evaluate(await print(json), json, undefined, options.holds)),
    question: json,
  }),
  askText: (text: string, options: AskOptions = {}) =>
    evaluate(text, undefined, { text, format: 'epsil' }, options.holds),
};

let descriptions: Promise<Record<string, string>> | undefined;

export const env: Env = {
  ...kernel,
  describe: async (name) => {
    descriptions ??= import('virtual:notatio-descriptions').then((m) => m.default);
    return (await descriptions)[name];
  },
};
