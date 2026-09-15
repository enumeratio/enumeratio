// Delete Cloudflare Pages preview deployments — CF never expires them on its own.
//
//   node .github/scripts/sweep-previews.ts pr <number>       everything stamped [preview-PR-<number>]
//   node .github/scripts/sweep-previews.ts age [days=30]     untagged previews older than <days>
//
// Env: CF_API_TOKEN, CF_ACCOUNT_ID, CF_PROJECT (default enumeratio), DRY_RUN=1 to only report.
// "Tagged" is decided against the checkout this runs in (`git tag --points-at`), so the age sweep
// needs the tags fetched; a commit git no longer knows counts as untagged. The most recent
// preview of main is kept whatever its age, and production deployments are never touched.

import { execFileSync } from "node:child_process";

const token = process.env.CF_API_TOKEN;
const account = process.env.CF_ACCOUNT_ID;
const project = process.env.CF_PROJECT ?? "enumeratio";
const dryRun = process.env.DRY_RUN === "1";
if (!token || !account) throw new Error("CF_API_TOKEN and CF_ACCOUNT_ID are required");

const [mode, argument] = process.argv.slice(2);
const api = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}/deployments`;
const headers = { Authorization: `Bearer ${token}` };

interface Deployment {
  readonly id: string;
  readonly created_on: string;
  readonly environment: "preview" | "production";
  readonly deployment_trigger: {
    readonly metadata: {
      readonly branch: string;
      readonly commit_hash: string;
      readonly commit_message: string;
    };
  };
}

async function listAll(): Promise<Deployment[]> {
  const all: Deployment[] = [];
  for (let page = 1; ; page++) {
    const response = await fetch(`${api}?per_page=25&page=${page}`, { headers });
    if (!response.ok) throw new Error(`list page ${page}: HTTP ${response.status}`);
    const { result } = (await response.json()) as { result: Deployment[] };
    all.push(...result);
    if (result.length < 25) return all;
  }
}

function isTagged(sha: string): boolean {
  try {
    return (
      execFileSync("git", ["tag", "--points-at", sha], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() !== ""
    );
  } catch {
    return false; // git does not know the commit (force-pushed away) — nothing points at it
  }
}

function select(deployments: Deployment[]): Deployment[] {
  const previews = deployments.filter((d) => d.environment === "preview");
  if (mode === "pr") {
    if (!argument) throw new Error("pr mode needs the PR number");
    const stamp = `[preview-PR-${argument}]`;
    return previews.filter((d) => d.deployment_trigger.metadata.commit_message.includes(stamp));
  }
  if (mode === "age") {
    const days = Number(argument ?? 30);
    const cutoff = Date.now() - days * 86_400_000;
    const latestMain = previews
      .filter((d) => d.deployment_trigger.metadata.commit_message.includes("[preview-main]"))
      .sort((a, b) => b.created_on.localeCompare(a.created_on))[0];
    return previews.filter(
      (d) =>
        d.id !== latestMain?.id &&
        Date.parse(d.created_on) < cutoff &&
        !isTagged(d.deployment_trigger.metadata.commit_hash),
    );
  }
  throw new Error(`unknown mode ${JSON.stringify(mode)} — expected pr or age`);
}

const deployments = await listAll();
const doomed = select(deployments);
let deleted = 0;
for (const d of doomed) {
  const { branch, commit_message } = d.deployment_trigger.metadata;
  const label = `${d.id.slice(0, 8)}  ${d.created_on.slice(0, 10)}  ${branch}  ${commit_message.split("\n")[0].slice(0, 72)}`;
  if (dryRun) {
    console.log(`would delete  ${label}`);
    continue;
  }
  const response = await fetch(`${api}/${d.id}?force=true`, { method: "DELETE", headers });
  if (response.ok) {
    deleted++;
    console.log(`deleted  ${label}`);
  } else {
    console.error(`warn: could not delete ${label}: HTTP ${response.status}`);
  }
}
console.log(
  `${dryRun ? "would delete" : "deleted"} ${dryRun ? doomed.length : deleted} of ${deployments.length} deployments (${mode}${argument ? ` ${argument}` : ""})`,
);
