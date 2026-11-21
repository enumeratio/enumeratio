import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vite-plus/test';
import { parse } from 'yaml';

const root = new URL('../../', import.meta.url);
const source = readFileSync(fileURLToPath(new URL('.github/workflows/ci.yml', root)), 'utf8');

interface Step {
  id?: string;
  name?: string;
  if?: string;
  env?: Record<string, string>;
  run?: string;
}
interface Workflow {
  on: { push: { branches: string[] }; pull_request: unknown };
  concurrency: { group: string; 'cancel-in-progress': string | boolean };
  jobs: { deploy: { env: Record<string, string>; steps: Step[] } };
}

const workflow = parse(source) as Workflow;
const steps = workflow.jobs.deploy.steps;
const named = (name: string): Step => {
  const step = steps.find((s) => s.name === name);
  if (!step) throw new Error(`no step called ${name}`);
  return step;
};
const flat = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const conditions = (step: Step) => flat(step.if).split(' && ');
const wrangler = 'wrangler@4.45.0';

test('the deploy job skips itself without a token', () => {
  expect(workflow.jobs.deploy.env.CLOUDFLARE_API_TOKEN).toBe('${{ secrets.CLOUDFLARE_API_TOKEN }}');
  const token = steps.find((s) => s.id === 'token');
  expect(token?.run).toContain('-n "$CLOUDFLARE_API_TOKEN"');
});

test('a preview needs the token, a pull request from this repository, and is branch pr-<number>', () => {
  const preview = named('Deploy a preview');
  expect(conditions(preview)).toEqual([
    "steps.token.outputs.present == 'true'",
    "github.event_name == 'pull_request'",
    'github.event.pull_request.head.repo.full_name == github.repository',
  ]);
  expect(preview.env?.PREVIEW_BRANCH).toBe('pr-${{ github.event.pull_request.number }}');
  expect(preview.run).toContain('--branch="$PREVIEW_BRANCH"');
  expect(preview.run).not.toContain('head_ref');
  expect(preview.run).not.toContain('--branch=main');
});

test('production needs the token, a push, main, and DEPLOY_PRODUCTION', () => {
  const production = named('Deploy production');
  expect(conditions(production)).toEqual([
    "steps.token.outputs.present == 'true'",
    "github.event_name == 'push'",
    "github.ref == 'refs/heads/main'",
    "vars.DEPLOY_PRODUCTION == 'true'",
  ]);
  expect(production.run).toContain('--branch=main');
});

test('both deploys use one exact wrangler version', () => {
  for (const name of ['Deploy a preview', 'Deploy production']) {
    expect(named(name).run).toContain(`npx --yes ${wrangler} pages deploy`);
  }
  expect(source.match(/wrangler@\S+/g)).toEqual([wrangler, wrangler]);
});

test('push runs on main only, and a run on main is never cancelled', () => {
  expect(workflow.on.push.branches).toEqual(['main']);
  expect(workflow.on).toHaveProperty('pull_request');
  expect(workflow.concurrency['cancel-in-progress']).toBe("${{ github.ref != 'refs/heads/main' }}");
  expect(workflow.concurrency.group).toBe('ci-${{ github.ref }}');
});

test('there is no 404.html: Pages serves index.html for unmatched paths', () => {
  expect(existsSync(fileURLToPath(new URL('site/404.html', root)))).toBe(false);
  expect(existsSync(fileURLToPath(new URL('site/public/404.html', root)))).toBe(false);
});
