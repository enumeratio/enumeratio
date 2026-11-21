import './style.css';
import { start } from './router.ts';

// The kernel and the figures are their own chunks: the shell and the reading of the address
// do not wait for them.
start(window, {
  loadEnv: async () => (await import('./kernel.ts')).env,
  decorate: (drawn) => {
    if (drawn.querySelector('[data-figure]') === null) return;
    void import('./figure.ts').then(
      (m) => m.drawFigures(drawn),
      (error: unknown) => console.error(error),
    );
  },
});
