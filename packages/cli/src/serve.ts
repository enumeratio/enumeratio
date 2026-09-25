// A minimal compute host: `notatio serve` stands up a local HTTP endpoint over
// the same eval core the REPL and bin use. Stateless — each request evaluates in
// a fresh Session. Bound to localhost by default (single trusted user, no auth);
// evaluating arbitrary expressions is only as safe as the machine it runs on.

import { createServer } from "node:http";
import { mimeTypeToFormatList } from "@enumeratio/formats";
import { type Form, resolveForm, resolveSyntax, type Syntax } from "./engine.ts";
import { evaluateCommand, formatsJson, toWire } from "./command.ts";

export interface ServeOptions {
  port?: number;
  host?: string;
}

export const DEFAULT_PORT = 7373;

export interface Reply {
  status: number;
  json: unknown;
}

/** Evaluate `input` in a fresh session and return a few useful forms. */
function evaluate(body: Record<string, unknown>): Reply {
  const input = body.input;
  if (typeof input !== "string") return bad("`input` (string) is required");

  let outForm: Form | undefined;
  if (body.form !== undefined) {
    outForm = typeof body.form === "string" ? resolveForm(body.form) : undefined;
    if (!outForm) return bad(`unknown form: ${JSON.stringify(body.form)}`);
  }
  let syntax: Syntax | undefined;
  if (body.syntax !== undefined) {
    syntax = typeof body.syntax === "string" ? resolveSyntax(body.syntax) : undefined;
    if (!syntax) return bad(`unknown syntax: ${JSON.stringify(body.syntax)}`);
  }

  // The primary form first, then the interchange forms every reply carries.
  const forms: Form[] = [outForm ?? "notatio", "notatio", "tex", "mathjson", "wolfram"];
  const res = evaluateCommand({ input, syntax, forms });
  return { status: 200, json: toWire(res) };
}

function formatsList(): Reply {
  return { status: 200, json: { formats: formatsJson() } };
}

function bad(error: string): Reply {
  return { status: 400, json: { ok: false, error } };
}

/**
 * Read one query parameter from a raw query string. Unlike form decoding, `+`
 * and `/` are kept literally — they are valid in a URL's query component — so a
 * MIME type like `image/svg+xml` needs no escaping (`%2B`/`%2F` still decode too).
 */
function queryParam(rawQuery: string, key: string): string | undefined {
  const q = rawQuery.startsWith("?") ? rawQuery.slice(1) : rawQuery;
  for (const pair of q.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const k = eq === -1 ? pair : pair.slice(0, eq);
    if (decodeURIComponent(k) === key) return decodeURIComponent(eq === -1 ? "" : pair.slice(eq + 1));
  }
  return undefined;
}

/**
 * Route one request to a JSON reply. Pure (no sockets) so it is unit-testable;
 * `runServe` wraps it in an HTTP server.
 */
export function handleRequest(method: string, path: string, query: string, body: Record<string, unknown>): Reply {
  if (method === "GET" && (path === "/" || path === "/health"))
    return {
      status: 200,
      json: {
        ok: true,
        service: "notatio",
        endpoints: ["POST /eval", "GET /formats", "GET /mime?type="],
      },
    };
  if (method === "POST" && path === "/eval") return evaluate(body);
  if (method === "GET" && path === "/formats") return formatsList();
  if (method === "GET" && path === "/mime") {
    const type = queryParam(query, "type");
    if (!type) return bad("`type` query parameter is required");
    return { status: 200, json: { mimeType: type, formats: mimeTypeToFormatList(type) } };
  }
  return { status: 404, json: { ok: false, error: `no route for ${method} ${path}` } };
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

/** Start the HTTP compute host (localhost by default). */
export function runServe(opts: ServeOptions = {}): void {
  const port = opts.port ?? DEFAULT_PORT;
  const host = opts.host ?? "127.0.0.1";

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${host}`);
    const send = (reply: Reply): void => {
      res.writeHead(reply.status, { "content-type": "application/json", ...CORS });
      res.end(JSON.stringify(reply.json));
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      let body: Record<string, unknown> = {};
      if (chunks.length > 0) {
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          send(bad("invalid JSON body"));
          return;
        }
      }
      send(handleRequest(req.method ?? "GET", url.pathname, url.search, body));
    });
  });

  server.listen(port, host, () => {
    console.log(`notatio compute host on http://${host}:${port}`);
    console.log('  POST /eval  {"input","syntax?","form?"}   GET /formats   GET /mime?type=');
  });
}
