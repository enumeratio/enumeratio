// Spike engine: a SharedWorker that claims pending calls, reads each to its canonical form,
// answers from the value records when it can, and otherwise evaluates it, writing its progress
// into the call's record while it runs. Also answers direct postMessage calls, the baseline.

import { CHANNEL, openDb, req, rw, VERSION } from "./bus.js";

const CE_URL = new URL(self.location.href).searchParams.get("ce") ?? "./ce/compute-engine.js";
// Loaded after `onconnect` is set, so no connection arrives before there's a handler for it.
const engine = import(CE_URL).then(({ ComputeEngine }) => new ComputeEngine());
let ce;
const id = self.name || "engine";
const bell = new BroadcastChannel(CHANNEL);
const HEARTBEAT_MS = 250;
let db;
let busy = false;
let evaluated = 0;
let heartbeats = 0;

/** Claim the oldest pending call: read-write transactions on one store run one at a time. */
function claim() {
  return rw(db, ["inputs"], async ({ inputs }, done) => {
    const cursor = await req(inputs.index("status").openCursor(IDBKeyRange.only("pending")));
    if (!cursor) return done(undefined);
    const call = { ...cursor.value, status: "claimed", owner: id, progress: { at: Date.now(), ms: 0 } };
    cursor.update(call);
    return done(call);
  });
}

/** Write to `key` only while this attempt still holds it: a re-run supersedes a stalled one. */
function update(key, attempt, patch) {
  return rw(db, ["inputs"], async ({ inputs }, done) => {
    const call = await req(inputs.get(key));
    if (!call || call.attempt !== attempt || call.owner !== id) return done(false);
    inputs.put({ ...call, ...patch });
    return done(true);
  });
}

async function evaluate(call) {
  const boxed = ce.box(call.json);
  const canonical = `${VERSION}|${JSON.stringify(boxed.json)}`;
  // Equivalent inputs share an answer: the value record is the canonical expression's.
  const known = await rw(db, ["values"], async ({ values }, done) => done(await req(values.get(canonical))));
  if (known) return { canonical, effects: known.effects, value: known.value, ms: 0, shared: true };
  // A stall the test asks for: blocking, so no heartbeat gets written.
  if (call.json[0] === "Stall" && call.mode !== "safe") {
    const until = Date.now() + call.json[1];
    while (Date.now() < until);
  }
  const t0 = performance.now();
  let timer = setInterval(() => {
    heartbeats++;
    void update(call.key, call.attempt, { progress: { at: Date.now(), ms: performance.now() - t0 } });
  }, HEARTBEAT_MS);
  try {
    const value = call.json[0] === "Stall" ? "Stalled" : (await boxed.evaluateAsync()).json;
    return { canonical, effects: boxed.effects ?? [], value, ms: performance.now() - t0, shared: false };
  } finally {
    clearInterval(timer);
  }
}

async function drain() {
  if (busy) return;
  busy = true;
  try {
    for (;;) {
      const call = await claim();
      if (!call) break;
      const { canonical, effects, value, ms, shared } = await evaluate(call);
      if (!shared) evaluated++;
      const keep = effects.length === 0;
      const written = await rw(db, ["inputs", "values"], async ({ inputs, values }, done) => {
        const now = await req(inputs.get(call.key));
        // A re-run has taken this call over: this answer is dropped.
        if (!now || now.attempt !== call.attempt || now.owner !== id) return done(false);
        if (keep && !shared) values.put({ key: canonical, value, effects, ms, by: id, evaluations: 1 });
        inputs.put({
          ...now,
          status: "done",
          canonical: keep ? canonical : undefined,
          value: keep ? undefined : value,
          effects,
          ms,
          by: id,
        });
        return done(true);
      });
      if (written) bell.postMessage({ type: "done", key: call.key });
    }
  } finally {
    busy = false;
  }
}

bell.onmessage = (e) => {
  if (e.data?.type === "call") void drain();
};

self.onconnect = async (event) => {
  const port = event.ports[0];
  ce ??= await engine;
  db ??= await openDb();
  port.onmessage = (e) => {
    const m = e.data;
    if (m.type === "direct") port.postMessage({ type: "direct", n: m.n, value: ce.box(m.json).evaluate().json });
    else if (m.type === "stats") port.postMessage({ type: "stats", id, evaluated, heartbeats });
  };
  port.start();
  port.postMessage({ type: "ready", id });
  void drain();
};
