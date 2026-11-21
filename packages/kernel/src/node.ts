/**
 * The kernel in Node, for tests: the same catalogue and the same host options
 * as the page's worker, without the worker.
 */
import { ComputeEngine } from '@cortex-js/compute-engine';
import { createKernel, declareEvaluation } from '@notatio/evaluation';
import { NOTEBOOK_KERNEL } from '@notatio/frontend/kernel-host';
import { catalogue } from './catalogue.ts';
import { type Json, type Kernel, answerOf, askTimeMs, printedAs } from './index.ts';

/** A kernel in this process. Each call to `ask` runs in a scope of its own. */
export function createNodeKernel(): Kernel {
  const ce = new ComputeEngine();
  declareEvaluation(ce);
  const kernel = createKernel(ce, catalogue, NOTEBOOK_KERNEL);
  const raw = (result: Awaited<ReturnType<typeof kernel.evaluate>>) => ({
    value: result.json,
    boxes: result.boxes,
    input: result.input,
    ...(result.error === undefined ? {} : { error: result.error }),
    ...(result.messages === undefined ? {} : { messages: result.messages }),
  });
  const print = async (json: Json): Promise<string> => {
    const result = await kernel.evaluate({ json, write: 'epsil' });
    return printedAs(json, result.ok ? result.written : undefined);
  };
  return {
    print,
    ask: async (json, options = {}) => ({
      ...answerOf(
        await print(json),
        raw(await kernel.evaluate({ json, timeMs: askTimeMs })),
        options.holds,
      ),
      question: json,
    }),
    askText: async (text, options = {}) =>
      answerOf(
        text,
        raw(await kernel.evaluate({ source: { text, format: 'epsil' }, timeMs: askTimeMs })),
        options.holds,
      ),
  };
}
