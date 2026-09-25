// Dev-server-only "review mode": a small REST API in front of a markdown backlog
// file, for working an owner through a backlog of shipped features (see the
// task's AGENTS.md-adjacent spec / lane notes). Registered only for
// `vitepress dev` (see config.mts, matching the design/speculative pattern) and
// gated again here with `apply: "serve"`, so it never runs during
// `vitepress build` / `vitepress preview`.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import {
  applyItemPatch,
  type BacklogItem,
  type Bullet,
  type ItemPatch,
  type ItemStatus,
  parseBacklog,
  upsertItem,
} from "./backlog.ts";

/**
 * `<git common dir>/lanes/REVIEW.md`, resolved from `webDir` so every worktree
 * of the repo shares one file. Overridable with `REVIEW_FILE`.
 */
export function resolveReviewFilePath(webDir: string): string {
  const override = process.env.REVIEW_FILE;
  if (override) return resolve(webDir, override);
  try {
    const gitCommonDir = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      cwd: webDir,
      encoding: "utf8",
    }).trim();
    return resolve(webDir, gitCommonDir, "lanes/REVIEW.md");
  } catch {
    // Not inside a git checkout (unlikely for this repo) -- fall back to a
    // sibling of web/ so the server still has somewhere to point at.
    return resolve(webDir, "../lanes/REVIEW.md");
  }
}

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/** Atomic write: temp file in the same directory, then rename over the target. */
function writeFileAtomic(path: string, contents: string): void {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, path);
}

export function reviewModePlugin(webDir: string): Plugin {
  const reviewPath = resolveReviewFilePath(webDir);

  return {
    name: "enumeratio-review-mode",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/__review/backlog", (req, res) => {
        if (req.method !== "GET") {
          sendJson(res, 405, { error: "method not allowed" });
          return;
        }
        const backlog = existsSync(reviewPath)
          ? parseBacklog(readFileSync(reviewPath, "utf8"))
          : { intro: "", items: [] };
        sendJson(res, 200, { path: reviewPath, ...backlog });
      });

      server.middlewares.use("/__review/item", (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "method not allowed" });
          return;
        }
        void (async () => {
          // `title` + `bullets` present means "create if missing" (an ad-hoc item from
          // a modifier-click, see ReviewPanel.vue) -- otherwise this is a plain patch
          // to an item that must already exist. Either way we re-read the file fresh
          // right before writing, so a change from Dean's own editing in the UI, or
          // from hand-editing REVIEW.md, is never clobbered.
          let payload: { id?: string; title?: string; bullets?: Bullet[] } & ItemPatch;
          try {
            payload = JSON.parse((await readBody(req)) || "{}");
          } catch {
            sendJson(res, 400, { error: "invalid JSON body" });
            return;
          }
          const { id, title, bullets, status, feedback } = payload;
          if (!id) {
            sendJson(res, 400, { error: "missing id" });
            return;
          }
          const raw = existsSync(reviewPath) ? readFileSync(reviewPath, "utf8") : "";

          let result: { raw: string; item: BacklogItem } | undefined;
          if (title !== undefined && bullets !== undefined) {
            const item: BacklogItem = {
              id,
              title,
              status: (status as ItemStatus) ?? "open",
              bullets,
              feedback: feedback ?? "",
            };
            const known = new Set(["link", "pr", "check", "note"]);
            for (const b of bullets)
              if (known.has(b.key)) (item as unknown as Record<string, string>)[b.key] = b.value;
            result = upsertItem(raw, item);
          } else if (!existsSync(reviewPath)) {
            sendJson(res, 409, { error: "backlog file not found", path: reviewPath });
            return;
          } else {
            result = applyItemPatch(raw, id, { status, feedback });
          }
          if (!result) {
            sendJson(res, 409, { error: `item ${id} not found`, path: reviewPath });
            return;
          }
          writeFileAtomic(reviewPath, result.raw);
          sendJson(res, 200, { item: result.item });
        })();
      });

      // Broadcast an HMR custom event when the file changes on disk (e.g. a Claude
      // session editing it by hand), so the panel can refetch -- see
      // ReviewMode.vue, which keeps the current selection and any unsaved draft.
      server.watcher.add(reviewPath);
      server.watcher.on("change", (file) => {
        if (resolve(file) === reviewPath)
          server.ws.send({ type: "custom", event: "review:changed" });
      });
      server.watcher.on("add", (file) => {
        if (resolve(file) === reviewPath)
          server.ws.send({ type: "custom", event: "review:changed" });
      });
    },
  };
}
