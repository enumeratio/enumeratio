// Spike engine: a SharedWorker that claims pending calls a batch at a time, reads each to its
// canonical form, answers from the value records when it can, and otherwise evaluates it.
// Answers are written a batch at a time too, flushed at the end of the batch or once a flush
// interval has passed, so a long batch still answers its first calls early. Its liveness is
// its own heartbeat, on the bell, not each call's. Also answers direct postMessage calls, the
// baseline.

import { CHANNEL, openDb, req, tx, VERSION } from "./bus.js";

const CE_URL = new URL(self.location.href).searchParams.get("ce") ?? "./ce/compute-engine.js";
// Loaded after `onconnect` is set, so no connection arrives before there's a handler for it.
const engine = import(CE_URL).then(({ ComputeEngine }) => new ComputeEngine());
let ce;
const id = self.name || "engine";
const bell = new BroadcastChannel(CHANNEL);
const HEARTBEAT_MS = 250;
// Answers wait at most this long for the rest of their batch.
const FLUSH_MS = 16;
let db;
let opening;
let batch = 1;
let busy = false;
const stats = { evaluated: 0, heartbeats: 0, claims: 0, flushes: 0, refused: 0 };

/** Claim up to `batch` of the oldest pending calls, in one transaction: read-write
 *  transactions on one store run one at a time, so each call is claimed once. */
function claim() {
  return tx(db, ["inputs"], async ({ inputs }, done) => {
    const calls = [];
    // `continue()` fires the same request's success again, with the next cursor.
    const r = inputs.index("status").openCursor(IDBKeyRange.only("pending"));
    let cursor = await req(r);
    while (cursor) {
      const call = { ...cursor.value, status: "claimed", owner: id, order: calls.length, claimedAt: Date.now() };
      cursor.update(call);
      calls.push(call);
      if (calls.length === batch) break;
      cursor.continue();
      cursor = await req(r);
    }
    return done(calls);
  });
}

// Evaluation options change the answer (a numeric approximation), so they're part of the key.
const canonicalOf = (call) =>
  `${VERSION}|${JSON.stringify(call.options ?? {})}|${JSON.stringify(ce.box(call.json).json)}`;

async function evaluate(call, known) {
  const boxed = ce.box(call.json);
  const canonical = canonicalOf(call);
  const shared = known.get(canonical);
  if (shared) return { canonical, effects: shared.effects, value: shared.value, ms: 0, shared: true };
  // A stall the test asks for: blocking, so no heartbeat gets written.
  if (call.json[0] === "Stall" && call.mode !== "safe") {
    const until = Date.now() + call.json[1];
    while (Date.now() < until);
  }
  const t0 = performance.now();
  const value = call.json[0] === "Stall" ? "Stalled" : (await boxed.evaluateAsync(call.options ?? {})).json;
  return { canonical, effects: boxed.effects ?? [], value, ms: performance.now() - t0, shared: false };
}

/** Write a batch of answers in one transaction, each only while its attempt still holds the
 *  call: a re-run supersedes a stalled one. An answer with effects isn't kept: its call's
 *  record goes, and the answer travels only in the bell. */
async function flush(answers) {
  if (answers.length === 0) return;
  stats.flushes++;
  const written = await tx(db, ["inputs", "values"], async ({ inputs, values }, done) => {
    const out = [];
    for (const { call, canonical, effects, value, ms, shared } of answers) {
      const now = await req(inputs.get(call.key));
      if (!now || now.attempt !== call.attempt || now.owner !== id) {
        stats.refused++;
        continue;
      }
      const keep = effects.length === 0;
      if (keep && !shared) values.put({ key: canonical, value, effects, ms, by: id });
      const record = { ...now, status: "done", canonical: keep ? canonical : undefined, effects, ms, by: id };
      if (keep) inputs.put(record);
      else inputs.delete(call.key);
      out.push({ ...record, value, shared });
    }
    return done(out);
  });
  // The bell carries the answers, so a page needn't read them back.
  if (written.length > 0) bell.postMessage({ type: "done", records: written });
}

async function drain() {
  if (busy) return;
  busy = true;
  try {
    for (;;) {
      const calls = await claim();
      if (calls.length === 0) break;
      stats.claims++;
      // The value records the batch's canonical forms already have, read in one transaction.
      const keys = new Set(calls.map(canonicalOf));
      const known = await tx(
        db,
        ["values"],
        async ({ values }, done) => {
          const found = new Map();
          for (const k of keys) {
            const v = await req(values.get(k));
            if (v) found.set(k, v);
          }
          return done(found);
        },
        "readonly",
      );
      let answers = [];
      let since = performance.now();
      for (const call of calls) {
        const answer = { call, ...(await evaluate(call, known)) };
        if (!answer.shared) stats.evaluated++;
        // Later calls in the batch share what this one evaluated.
        if (answer.effects.length === 0) known.set(answer.canonical, answer);
        answers.push(answer);
        if (performance.now() - since > FLUSH_MS) {
          const sending = answers;
          answers = [];
          since = performance.now();
          await flush(sending);
        }
      }
      await flush(answers);
    }
  } finally {
    busy = false;
  }
}

// The heartbeat goes on the bell, not in the store: a write issued just before a blocking
// evaluation can't commit until the worker comes back, and its lock would hold up every
// watchdog that reads the store.
function heartbeat() {
  stats.heartbeats++;
  bell.postMessage({ type: "beat", id, at: Date.now(), busy });
}

bell.onmessage = (e) => {
  if (e.data?.type === "call") void drain();
};

self.onconnect = async (event) => {
  const port = event.ports[0];
  ce ??= await engine;
  // Several ports connect at once: the store opens, and the heartbeat starts, once.
  db ??= await (opening ??= openDb().then((opened) => {
    db = opened;
    heartbeat();
    setInterval(heartbeat, HEARTBEAT_MS);
    return opened;
  }));
  port.onmessage = (e) => {
    const m = e.data;
    if (m.type === "direct") port.postMessage({ type: "direct", n: m.n, value: ce.box(m.json).evaluate().json });
    else if (m.type === "config") {
      batch = m.batch;
      port.postMessage({ type: "config", id, batch });
    } else if (m.type === "stats") port.postMessage({ type: "stats", id, ...stats });
  };
  port.start();
  port.postMessage({ type: "ready", id });
  void drain();
};
