/**
 * The page's kernel: notatio's session worker over this site's catalogue of
 * libraries. The loop and the catalogue are imported here, statically, so the
 * build bundles them into the worker; each library is its own chunk, loaded
 * when an expression first names one of its heads.
 */
import { ComputeEngine } from '@cortex-js/compute-engine';
import { catalogue } from '@enumeratio/kernel/catalogue';
import { startSessionWorker } from '@notatio/evaluation/session-worker-core';
import { NOTEBOOK_KERNEL } from '@notatio/frontend/kernel-host';

startSessionWorker(undefined, {
  catalogue,
  createEngine: () => new ComputeEngine(),
  ...NOTEBOOK_KERNEL,
});
