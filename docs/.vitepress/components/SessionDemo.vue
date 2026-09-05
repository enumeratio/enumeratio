<script setup lang="ts">
// A tiny harness for the SESSION-mode client (makeServiceWorkerDb): the SharedWorker engine + ServiceWorker
// controller. It exists to VERIFY and DEMONSTRATE the shared, observable surface — open this page in two tabs and
// watch one engine serve both, with every query from either tab showing up in a single cross-tab activity log.
// Browser-only (SharedWorker/ServiceWorker/pglite); the client is dynamically imported in onMounted.
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { SessionDb, SessionEvent, ActivityEntry, Notification } from '@enumeratio/client'

const db = shallowRef<SessionDb | null>(null)
const phase = ref('booting')
const clients = ref(0)
const bootMs = ref<number | undefined>()
const transport = ref<string>('…')
const version = ref<string | null>(null)
const swState = ref<string>('—')
const activity = ref<ActivityEntry[]>([])
const toasts = ref<(Notification & { _id: number })[]>([])
const results = ref<string[]>([])
let toastSeq = 0
let unsub: (() => void) | null = null

function toast(note: Notification) {
  const t = { ...note, _id: ++toastSeq }
  toasts.value = [t, ...toasts.value].slice(0, 6)
  if (!note.sticky) setTimeout(() => { toasts.value = toasts.value.filter((x) => x._id !== t._id) }, 4000)
}
function dismiss(id: number) { toasts.value = toasts.value.filter((x) => x._id !== id) }

function onEvent(ev: SessionEvent) {
  if (ev.plane === 'engine') {
    if (ev.kind === 'status') { phase.value = ev.phase; clients.value = ev.clients; bootMs.value = ev.bootMs; transport.value = db.value?.presence.transport ?? '…' }
    else if (ev.kind === 'activity') { activity.value = [ev.entry, ...activity.value].slice(0, 40) }
    else if (ev.kind === 'notification') { toast(ev.note) }
  } else {
    if (ev.kind === 'version') { version.value = ev.version; swState.value = ev.state }
    else if (ev.kind === 'reload') { location.reload() }
    else if (ev.kind === 'notification') { /* controller re-fan; engine already toasted it */ }
  }
}

async function runCard() {
  const r = await db.value!.query<{ c: string }>('SELECT cardinality(permutations(5))::text AS c')
  results.value = [`|permutations(5)| = ${r.rows[0]?.c}`, ...results.value].slice(0, 8)
}
async function runWindow() {
  const r = await db.value!.query<{ el: string }>(
    "SELECT render(e) AS el FROM elements(integer_partitions(7), 12) e ORDER BY e OFFSET 0 LIMIT 12",
  )
  results.value = [`partitions(7)[0..12] = ${r.rows.map((x) => x.el).join('  ')}`, ...results.value].slice(0, 8)
}
async function runSlow() {
  // a heavier group-by to show a longer-running entry on the shared activity log
  const r = await db.value!.query<{ n: string }>(
    'SELECT count(*)::text AS n FROM elements(set_partitions(9), 2147483647) e',
  )
  results.value = [`|set_partitions(9)| via scan = ${r.rows[0]?.n}`, ...results.value].slice(0, 8)
}
function notifyInfo() { db.value!.notify({ level: 'info', title: 'Hello from a tab', body: 'This toast fans out to every open tab.' }) }
function notifySticky() { db.value!.notify({ level: 'warn', title: 'Sticky notice', body: 'Stays until dismissed; can raise an OS notification.', sticky: true, key: 'demo-sticky' }) }
function flush() { db.value!.flush() }
function openTab() { window.open(location.href, '_blank') }
async function askOsPerm() { try { await Notification.requestPermission() } catch { /* unsupported */ } }

onMounted(async () => {
  const m = await import('@enumeratio/client')
  const s = m.makeServiceWorkerDb()
  db.value = s
  unsub = s.on(onEvent)
})
onUnmounted(() => { unsub?.(); void db.value?.close() })
</script>

<template>
  <div class="sw-demo">
    <div class="bar">
      <span class="pill" :data-phase="phase">engine: {{ phase }}</span>
      <span class="pill">transport: {{ transport }}</span>
      <span class="pill">tabs: {{ clients }}</span>
      <span class="pill" v-if="bootMs != null">boot: {{ bootMs }}ms</span>
      <span class="pill">SW: {{ version ?? 'registering…' }} <em v-if="version">({{ swState }})</em></span>
    </div>

    <div class="btns">
      <button @click="runCard">|permutations(5)|</button>
      <button @click="runWindow">partitions(7) window</button>
      <button @click="runSlow">scan set_partitions(9)</button>
      <button @click="notifyInfo">notify (toast)</button>
      <button @click="notifySticky">notify (sticky)</button>
      <button @click="flush">flush SW</button>
      <button @click="openTab">open 2nd tab ↗</button>
      <button @click="askOsPerm">allow OS notifications</button>
    </div>

    <div class="cols">
      <div>
        <h4>results (this tab)</h4>
        <ul class="log"><li v-for="(r, i) in results" :key="i">{{ r }}</li></ul>
      </div>
      <div>
        <h4>activity — the whole session (all tabs)</h4>
        <ul class="log">
          <li v-for="(a, i) in activity" :key="i" :data-ok="a.ok">
            <code>#{{ a.id }}</code> <span class="tag">{{ a.origin }}</span>
            <span v-if="a.phase === 'start'">▶ {{ a.sql }}</span>
            <span v-else>◼ {{ a.ms }}ms<span v-if="a.rows != null"> · {{ a.rows }} rows</span> {{ a.ok ? '✓' : '✗' }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="toaster">
      <div v-for="t in toasts" :key="t._id" class="toast" :data-level="t.level">
        <strong>{{ t.title }}</strong><span v-if="t.body"> — {{ t.body }}</span>
        <button class="x" @click="dismiss(t._id)">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sw-demo { font-size: 14px; }
.bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.pill { background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); border-radius: 999px; padding: 2px 10px; }
.pill[data-phase='ready'] { border-color: #16a34a; }
.pill[data-phase='failed'] { border-color: #dc2626; }
.btns { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.btns button { background: var(--vp-c-brand-1); color: #fff; border: 0; border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 13px; }
.btns button:hover { filter: brightness(1.08); }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 720px) { .cols { grid-template-columns: 1fr; } }
h4 { margin: 4px 0; }
.log { list-style: none; padding: 0; margin: 0; max-height: 260px; overflow: auto; font-family: var(--vp-font-family-mono); font-size: 12px; }
.log li { padding: 2px 0; border-bottom: 1px solid var(--vp-c-divider); }
.log li[data-ok='false'] { color: #dc2626; }
.tag { color: var(--vp-c-text-2); }
.toaster { position: fixed; right: 16px; bottom: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 50; }
.toast { background: var(--vp-c-bg-elv); border: 1px solid var(--vp-c-divider); border-left: 3px solid var(--vp-c-brand-1); border-radius: 6px; padding: 8px 28px 8px 12px; box-shadow: 0 4px 14px rgba(0,0,0,.15); position: relative; max-width: 320px; }
.toast[data-level='warn'] { border-left-color: #d97706; }
.toast[data-level='error'] { border-left-color: #dc2626; }
.toast[data-level='success'] { border-left-color: #16a34a; }
.toast .x { position: absolute; top: 4px; right: 6px; background: none; border: 0; cursor: pointer; font-size: 16px; color: var(--vp-c-text-2); }
</style>
