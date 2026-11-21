import './style.css';
import { summaryAttribute } from './live.ts';
import { start } from './router.ts';

// The kernel and the figures are their own chunks: the shell and the reading of the address
// do not wait for them.
start(window, {
  loadEnv: async () => (await import('./kernel.ts')).env,
  decorate: (drawn) => {
    if (drawn.querySelector(`[${summaryAttribute}]`) !== null) {
      void import('./summary.ts').then(
        (m) => m.typesetSummaries(drawn),
        (error: unknown) => console.error(error),
      );
    }
    if (drawn.querySelector('[data-figure]') === null) return;
    void import('./figure.ts').then(
      (m) => m.drawFigures(drawn),
      (error: unknown) => console.error(error),
    );
  },
});
