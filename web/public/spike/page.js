// Spike page: measures the IndexedDB store against a direct postMessage, with calls batched
// at every step, and tries what the design leans on: shared canonical answers, effects
// deciding what's kept, worker heartbeats, and a stalled call re-run elsewhere in a safer
// mode.

import { CHANNEL, DB, openDb, req, tx, VERSION } from "./bus.js";

const STALL_MS = 1000;
const WATCH_MS = 200;
const bell = new BroadcastChannel(CHANNEL);
/** Calls asked for and not yet answered, by key: `{ resolve, observe }`. */
const waiting = new Map();
/** Each worker's last heartbeat, as the bell brings it. */
const beats = new Map();
bell.onmessage = (e) => {
  if (e.data?.type === "beat") beats.set(e.data.id, e.data.at);
  if (e.data?.type !== "done") return;
  for (const record of e.data.records) waiting.get(record.key)?.resolve(record);
};

const median = (xs) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)];
const p95 = (xs) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length * 0.95)];
const keyOf = (json, options) => `${VERSION}|mathjson|${JSON.stringify(options ?? {})}|${JSON.stringify(json)}`;

function engine(name, ce) {
  const url = new URL("./engine.js", import.meta.url);
  if (ce) url.searchParams.set("ce", ce);
  const w = new SharedWorker(url, { type: "module", name });
  return new Promise((resolve) => {
    w.port.onmessage = (e) => e.data.type === "ready" && resolve(w.port);
    w.port.start();
  });
}

const ask = (port, message, type) =>
  new Promise((resolve) => {
    port.onmessage = (e) => e.data.type === type && resolve(e.data);
    port.postMessage(message);
  });

let db;
let queue = [];
const stats = { submits: 0, watches: 0, requeues: 0 };

/** Submit `json`: answered from the store when it can be, otherwise when an engine rings.
 *  Every call asked for in one tick goes in one transaction, with one ring. */
function submit(json, { options, observe } = {}) {
  return new Promise((resolve) => {
    queue.push({ key: keyOf(json, options), json, options, resolve, observe });
    if (queue.length === 1) queueMicrotask(flushSubmits);
  });
}

async function flushSubmits() {
  const sending = queue;
  queue = [];
  stats.submits++;
  const hits = await tx(db, ["inputs", "values"], async ({ inputs, values }, done) => {
    const found = new Map();
    for (const s of sending) {
      const hit = await req(inputs.get(s.key));
      if (hit?.status === "done") {
        const value = await req(values.get(hit.canonical));
        found.set(s.key, { ...hit, value: value?.value, hit: true });
      } else if (!hit) inputs.put({ key: s.key, json: s.json, options: s.options, status: "pending", attempt: 1 });
    }
    return done(found);
  });
  let rung = false;
  for (const s of sending) {
    const hit = hits.get(s.key);
    if (hit) {
      s.resolve(hit);
      continue;
    }
    const prior = waiting.get(s.key);
    waiting.set(s.key, {
      observe: s.observe,
      resolve: (record) => {
        waiting.delete(s.key);
        prior?.resolve(record);
        s.resolve(record);
      },
    });
    rung = true;
  }
  if (rung) {
    bell.postMessage({ type: "call" });
    watch();
  }
}

let watching;

/** One watchdog for every call this page waits on: one read of the claimed calls a tick,
 *  against the heartbeats the bell brought. A worker whose heartbeat goes quiet has its calls re-run: the
 *  first it hadn't answered (the one it's stuck on) in the safer mode, the rest as they were. */
function watch() {
  watching ??= setInterval(async () => {
    if (waiting.size === 0) {
      clearInterval(watching);
      watching = undefined;
      return;
    }
    stats.watches++;
    const now = Date.now();
    const requeued = await tx(db, ["inputs"], async ({ inputs }, done) => {
      const claimed = await req(inputs.index("status").getAll(IDBKeyRange.only("claimed")));
      for (const call of claimed) waiting.get(call.key)?.observe?.(call, beats.get(call.owner));
      const stuck = new Map();
      for (const call of claimed) {
        const at = beats.get(call.owner);
        if (at === undefined || now - at <= STALL_MS) continue;
        stuck.set(call.owner, [...(stuck.get(call.owner) ?? []), call]);
      }
      let n = 0;
      for (const calls of stuck.values()) {
        calls.sort((a, b) => a.claimedAt - b.claimedAt || a.order - b.order);
        for (const [i, call] of calls.entries()) {
          // A safe re-run that stalls too is left running and reported, not re-run again.
          if (i === 0 && call.mode === "safe") {
            if (!call.stalled) inputs.put({ ...call, stalled: now });
            continue;
          }
          const mode = i === 0 ? "safe" : call.mode;
          inputs.put({
            ...call,
            status: "pending",
            owner: undefined,
            attempt: call.attempt + 1,
            mode,
            stalledBy: call.owner,
          });
          n++;
        }
      }
      return done(n);
    });
    if (requeued > 0) {
      stats.requeues += requeued;
      bell.postMessage({ type: "call" });
    }
  }, WATCH_MS);
}

const refused = async (ports) =>
  (await Promise.all(ports.map((p) => ask(p, { type: "stats" }, "stats")))).reduce((n, s) => n + s.refused, 0);

/** `n` calls asked for at once, each timed from asking to its answer. */
async function burst(ports, n, batch, salt) {
  await Promise.all(ports.map((p) => ask(p, { type: "config", batch }, "config")));
  const t0 = performance.now();
  const times = [];
  const calls = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      submit(["Multiply", i, salt]).then((c) => {
        times.push(performance.now() - t0);
        return c;
      }),
    ),
  );
  return {
    batch,
    totalMs: Math.round(performance.now() - t0),
    firstMs: Math.round(Math.min(...times)),
    medianMs: Math.round(median(times)),
    wrong: calls.filter((c, i) => c.value !== i * salt).length,
    byEngine: Object.fromEntries(Object.entries(Object.groupBy(calls, (c) => c.by)).map(([k, v]) => [k, v.length])),
  };
}

export async function run({ engines = 4, sequential = 100, concurrent = 200, ce } = {}) {
  indexedDB.deleteDatabase(DB);
  await new Promise((r) => setTimeout(r, 200));
  db = await openDb();
  const ports = await Promise.all(Array.from({ length: engines }, (_, i) => engine(`engine-${i}`, ce)));
  const out = { userAgent: navigator.userAgent, crossOriginIsolated, visibility: document.visibilityState };

  const direct = [];
  for (let n = 0; n < sequential; n++) {
    const t0 = performance.now();
    await ask(ports[0], { type: "direct", n, json: ["Add", n, 1] }, "direct");
    direct.push(performance.now() - t0);
  }
  out.directMs = { median: median(direct), p95: p95(direct) };

  const miss = [];
  for (let n = 0; n < sequential; n++) {
    const t0 = performance.now();
    const call = await submit(["Add", n, 1]);
    miss.push(performance.now() - t0);
    if (call.value !== n + 1) throw new Error(`wrong answer for ${n}: ${JSON.stringify(call.value)}`);
  }
  out.storeMissMs = { median: median(miss), p95: p95(miss) };

  const hit = [];
  for (let n = 0; n < sequential; n++) {
    const t0 = performance.now();
    const call = await submit(["Add", n, 1]);
    hit.push(performance.now() - t0);
    if (!call.hit) throw new Error(`not a hit: ${n}`);
  }
  out.storeHitMs = { median: median(hit), p95: p95(hit) };

  // The same burst, claimed one, 8 and 32 at a time.
  out.bursts = [];
  for (const [i, batch] of [1, 8, 32].entries()) out.bursts.push(await burst(ports, concurrent, batch, 7 + i));

  // Two inputs, one canonical expression: the second is answered from the first's value record.
  await Promise.all(ports.map((p) => ask(p, { type: "config", batch: 8 }, "config")));
  const a = await submit(["Add", 1000, 7]);
  const b = await submit(["Add", 7, 1000]);
  out.canonical = {
    first: a.value,
    second: b.value,
    secondShared: b.shared === true,
    sameRecord: a.canonical === b.canonical,
  };

  // Effects: a seeded draw is kept, an unseeded one and a print aren't.
  const seeded = [await submit(["WithRandomSeed", 42, ["Random"]]), await submit(["WithRandomSeed", 42, ["Random"]])];
  const [unseeded, printed] = await Promise.all([submit(["Random"]), submit(["Print", 1])]);
  const kept = (json) =>
    tx(
      db,
      ["inputs"],
      async ({ inputs }, done) => done((await req(inputs.get(keyOf(json)))) !== undefined),
      "readonly",
    );
  out.effects = {
    seeded: {
      effects: seeded[0].effects,
      secondHit: seeded[1].hit === true,
      same: seeded[0].value === seeded[1].value,
    },
    unseeded: { effects: unseeded.effects, kept: await kept(["Random"]) },
    print: { effects: printed.effects, kept: await kept(["Print", 1]) },
  };

  // Progress: a long numeric sum yields (Sum's async handler), so its worker's heartbeat keeps
  // it alive; under `N` it doesn't (N has none: compute-engine#392), and it's re-run.
  const sum = ["Sum", ["Divide", 1, ["Power", "k", 2]], ["Tuple", "k", 1, 400000]];
  for (const [name, json, options] of [
    ["sumNumeric", sum, { numericApproximation: true }],
    ["nOfSum", ["N", sum], undefined],
  ]) {
    const beats = [];
    const t0 = performance.now();
    const call = await submit(json, { options, observe: (_, at) => at !== undefined && beats.push(Date.now() - at) });
    out[name] = {
      ms: Math.round(performance.now() - t0),
      // How long the engine took, apart from the store and the watchdog.
      evaluateMs: Math.round(call.ms),
      attempt: call.attempt,
      stalled: call.stalled !== undefined,
      watched: beats.length,
      maxBeatAgeMs: Math.max(0, ...beats),
    };
  }

  // A stall in a batch: the engine blocks on the first call it claimed, writing no heartbeat.
  // That call is re-run in the safer mode; the three claimed behind it are re-run as they
  // were; the stalled engine's late answers are refused.
  const refusedBefore = await refused(ports);
  const s0 = performance.now();
  const [stalled, ...behind] = await Promise.all([
    submit(["Stall", 2500]),
    ...[1, 2, 3].map((n) => submit(["Subtract", 100, n])),
  ]);
  const answeredAt = performance.now();
  await new Promise((r) => setTimeout(r, 2000));
  out.stall = {
    answeredMs: Math.round(answeredAt - s0),
    value: stalled.value,
    stalledBy: stalled.stalledBy,
    answeredBy: stalled.by,
    attempt: stalled.attempt,
    mode: stalled.mode,
    behind: behind.map((c) => ({ value: c.value, attempt: c.attempt, mode: c.mode ?? "normal", by: c.by })),
    effects: stalled.effects,
    // The stalled engine's four late answers, each refused by the attempt fence.
    lateAnswersRefused: (await refused(ports)) - refusedBefore,
  };

  out.page = stats;
  out.engines = await Promise.all(ports.map((p) => ask(p, { type: "stats" }, "stats")));
  return out;
}
