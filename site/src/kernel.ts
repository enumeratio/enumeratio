/**
 * The page's side of its kernel: one worker per page, started the first time a
 * page asks for something, after the shell is drawn. The worker and the session
 * protocol are notatio's (`@notatio/evaluation`).
 */
import { type Ask, answerOf, askTimeMs } from '@enumeratio/kernel';
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

const ask: Ask = async (epsil, options = {}) => {
  try {
    const answer = await open().evaluate(undefined, {
      source: { text: epsil, format: 'epsil' },
      timeMs: askTimeMs,
    });
    if (answer.reset) {
      return { asked: epsil, status: 'declined', reason: 'The kernel was stopped and restarted.' };
    }
    return answerOf(epsil, answer, options.holds);
  } catch (error) {
    return { asked: epsil, status: 'declined', reason: `No kernel: ${String(error)}` };
  }
};

let descriptions: Promise<Record<string, string>> | undefined;

export const env: Env = {
  ask,
  describe: async (name) => {
    descriptions ??= import('virtual:notatio-descriptions').then((m) => m.default);
    return (await descriptions)[name];
  },
};
