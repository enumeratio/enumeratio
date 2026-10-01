// Spike page: measures the IndexedDB store against a direct postMessage, and tries what the
// design leans on: shared canonical answers, effects deciding what's kept, progress written by
// the engine, and a stalled call re-run elsewhere in a safer mode.

import { CHANNEL, DB, openDb, req, rw, VERSION } from "./bus.js";

const STALL_MS = 1000;
const bell = new BroadcastChannel(CHANNEL);
const waiting = new Map();
bell.onmessage = (e) => {
  if (e.data?.type === "done") waiting.get(e.data.key)?.();
};

const median = (xs) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)];
const p95 = (xs) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length * 0.95)];
const keyOf = (json) => `${VERSION}|mathjson|${JSON.stringify(json)}`;

function engine(name, ce) {
  const url = new URL("./engine.js", import.meta.url);
  if (ce) url.searchParams.set("ce", ce);
  const w = new SharedWorker(url, { type: "module", name });
  return new Promise((resolve) => {
    w.port.onmessage = (e) => e.data.type === "ready" && resolve(w.port);
    w.port.start();
  });
}

const read = (db, key) => rw(db, ["inputs"], async ({ inputs }, done) => done(await req(inputs.get(key))));

/** The answer for a done call: its own value, or its value record's. */
async function answer(db, call) {
  if (call.canonical === undefined) return call;
  const value = await rw(db, ["values"], async ({ values }, done) => done(await req(values.get(call.canonical))));
  return { ...call, value: value.value, evaluatedBy: value.by, evaluatedMs: value.ms };
}

/** Submit `json`: answered from the store when it can be, otherwise wait, watching for a stall. */
async function submit(db, json, observe = () => {}) {
  const key = keyOf(json);
  const existing = await rw(db, ["inputs"], async ({ inputs }, done) => {
    const hit = await req(inputs.get(key));
    if (hit?.status === "done") return done(hit);
    if (!hit) inputs.put({ key, json, status: "pending", attempt: 1, at: Date.now() });
    return done(undefined);
  });
  if (existing) return { ...(await answer(db, existing)), hit: true };
  const answered = new Promise((resolve) => waiting.set(key, resolve));
  bell.postMessage({ type: "call", key });
  // The watchdog: a claimed call whose progress goes quiet is re-run, in the safer mode.
  const watch = setInterval(async () => {
    const call = await read(db, key);
    if (call?.status !== "claimed") return;
    observe(call);
    if (Date.now() - call.progress.at <= STALL_MS) return;
    const requeued = await rw(db, ["inputs"], async ({ inputs }, done) => {
      const now = await req(inputs.get(key));
      // Only the attempt seen stalled is superseded: it may have answered since the read.
      if (now?.status !== "claimed" || now.attempt !== call.attempt) return done(false);
      // A safe re-run that stalls too is left running and reported, not re-run again.
      if (now.mode === "safe") {
        if (!now.stalled) inputs.put({ ...now, stalled: Date.now() });
        return done(false);
      }
      inputs.put({
        ...now,
        status: "pending",
        owner: undefined,
        attempt: now.attempt + 1,
        mode: "safe",
        stalledBy: now.owner,
      });
      return done(true);
    });
    if (requeued) bell.postMessage({ type: "call", key });
  }, 200);
  await answered;
  clearInterval(watch);
  waiting.delete(key);
  const call = await read(db, key);
  // An answer with effects isn't kept: the call's record goes once it's read.
  if (call.canonical === undefined) await rw(db, ["inputs"], ({ inputs }) => inputs.delete(key));
  return answer(db, call);
}

export async function run({ engines = 4, sequential = 100, concurrent = 200, ce } = {}) {
  indexedDB.deleteDatabase(DB);
  await new Promise((r) => setTimeout(r, 200));
  const db = await openDb();
  const ports = await Promise.all(Array.from({ length: engines }, (_, i) => engine(`engine-${i}`, ce)));
  const out = { userAgent: navigator.userAgent };

  const direct = [];
  for (let n = 0; n < sequential; n++) {
    const t0 = performance.now();
    await new Promise((resolve) => {
      ports[0].onmessage = (e) => e.data.type === "direct" && e.data.n === n && resolve();
      ports[0].postMessage({ type: "direct", n, json: ["Add", n, 1] });
    });
    direct.push(performance.now() - t0);
  }
  out.directMs = { median: median(direct), p95: p95(direct) };

  const miss = [];
  for (let n = 0; n < sequential; n++) {
    const t0 = performance.now();
    const call = await submit(db, ["Add", n, 1]);
    miss.push(performance.now() - t0);
    if (call.value !== n + 1) throw new Error(`wrong answer for ${n}: ${JSON.stringify(call.value)}`);
  }
  out.storeMissMs = { median: median(miss), p95: p95(miss) };

  const hit = [];
  for (let n = 0; n < sequential; n++) {
    const t0 = performance.now();
    const call = await submit(db, ["Add", n, 1]);
    hit.push(performance.now() - t0);
    if (!call.hit) throw new Error(`not a hit: ${n}`);
  }
  out.storeHitMs = { median: median(hit), p95: p95(hit) };

  // Two inputs, one canonical expression: the second is answered from the first's value record.
  const a = await submit(db, ["Add", 1000, 7]);
  const b = await submit(db, ["Add", 7, 1000]);
  out.canonical = {
    first: a.value,
    second: b.value,
    secondShared: b.ms === 0,
    sameRecord: a.canonical === b.canonical,
  };

  // Effects: a seeded draw is kept, an unseeded one and a print aren't.
  const seeded = [
    await submit(db, ["WithRandomSeed", 42, ["Random"]]),
    await submit(db, ["WithRandomSeed", 42, ["Random"]]),
  ];
  const unseeded = await submit(db, ["Random"]);
  const printed = await submit(db, ["Print", 1]);
  out.effects = {
    seeded: {
      effects: seeded[0].effects,
      secondHit: seeded[1].hit === true,
      same: seeded[0].value === seeded[1].value,
    },
    unseeded: { effects: unseeded.effects, kept: (await read(db, keyOf(["Random"]))) !== undefined },
    print: { effects: printed.effects, kept: (await read(db, keyOf(["Print", 1]))) !== undefined },
  };

  // Progress: a longer evaluation writes its progress into the call's record as it runs.
  const seen = [];
  const t0 = performance.now();
  const long = await submit(db, ["N", ["Sum", ["Divide", 1, ["Power", "k", 2]], ["Tuple", "k", 1, 400000]]], (call) =>
    seen.push(call.progress.ms),
  );
  out.progress = {
    ms: performance.now() - t0,
    value: long.value,
    progressSeen: seen.length,
    lastProgressMs: seen.at(-1),
    attempt: long.attempt,
    stalled: long.stalled !== undefined,
  };

  // A stall: the engine blocks, writes no progress, and the call is re-run elsewhere in the safer
  // mode; the stalled engine's late answer is refused.
  const s0 = performance.now();
  const stalled = await submit(db, ["Stall", 2500]);
  await new Promise((r) => setTimeout(r, 2000));
  const after = await read(db, keyOf(["Stall", 2500]));
  out.stall = {
    answeredMs: performance.now() - s0 - 2000,
    value: stalled.value,
    stalledBy: stalled.stalledBy,
    answeredBy: stalled.by,
    attempt: stalled.attempt,
    lateAnswerRefused: after === undefined || after.by === stalled.by,
  };

  // Contention: many calls at once, every engine claiming; each evaluated exactly once.
  const c0 = performance.now();
  const calls = await Promise.all(Array.from({ length: concurrent }, (_, n) => submit(db, ["Multiply", n, 7])));
  out.concurrent = {
    calls: concurrent,
    totalMs: performance.now() - c0,
    wrong: calls.filter((c, n) => c.value !== n * 7).length,
    byEngine: Object.fromEntries(Object.entries(Object.groupBy(calls, (c) => c.by)).map(([k, v]) => [k, v.length])),
  };
  out.engines = await Promise.all(
    ports.map(
      (p) =>
        new Promise((resolve) => {
          p.onmessage = (e) => e.data.type === "stats" && resolve(e.data);
          p.postMessage({ type: "stats" });
        }),
    ),
  );
  return out;
}
