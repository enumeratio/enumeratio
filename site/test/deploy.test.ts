import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vite-plus/test';

const root = new URL('../../', import.meta.url);
const workflow = readFileSync(fileURLToPath(new URL('.github/workflows/ci.yml', root)), 'utf8');

test('the deploy job skips itself without a token', () => {
  expect(workflow).toContain('CLOUDFLARE_API_TOKEN');
  expect(workflow).toContain("steps.token.outputs.present == 'true'");
});

test('production needs main and DEPLOY_PRODUCTION; a preview is never from main', () => {
  const production = workflow.slice(workflow.indexOf('Deploy production'));
  expect(production).toContain("github.ref == 'refs/heads/main'");
  expect(production).toContain("vars.DEPLOY_PRODUCTION == 'true'");
  const preview = workflow.slice(
    workflow.indexOf('Deploy a preview'),
    workflow.indexOf('Deploy production'),
  );
  expect(preview).toContain("github.head_ref != 'main'");
  expect(preview).not.toContain('--branch=main');
});

test('there is no 404.html: Pages serves index.html for unmatched paths', () => {
  expect(existsSync(fileURLToPath(new URL('site/404.html', root)))).toBe(false);
  expect(existsSync(fileURLToPath(new URL('site/public/404.html', root)))).toBe(false);
});
