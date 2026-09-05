<script setup lang="ts">
// THE COLLECTION EXPLORER — the query view with the FROM pinned to a named collection, plus the SELECT editor.
// One RowQuery is the whole view state: the pinned handle (axis chips), WHERE / GROUP BY / HAVING / ORDER BY as
// statement segments, and the Properties list as the SELECT list. planRows() turns it into accelerated requests.
//
// Two table modes (#198 §0). An INTERNAL collection (the catalog's own registries — `collections`, `carriers`,
// `traits`, `glyphs`) or a small bounded one is EAGER: one planRows call for the whole table, and the header and
// column menus become one-way EDITORS of the statement. Everything else STREAMS: element windows with Load more,
// no header sort (a stat sort needs a bounded handle — the statement's own error says so).
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Panel from 'primevue/panel'
import Select from 'primevue/select'
import StatementBar from './StatementBar.vue'
import RowTable from './RowTable.vue'
import PropertiesPane from './PropertiesPane.vue'
import DetailPane from './DetailPane.vue'
import ElementPane from './ElementPane.vue'
import IdentityPane from './IdentityPane.vue'
import AlgebraEvaluator from './AlgebraEvaluator.vue'
import { distributionOf } from './distribution'
import type { Facet, FacetOption } from './PredChips.vue'
import { type PropRow, type PropDef, buildPropDefs, nextPropRowUid, seedRows } from './propRows'
import { parseRoute, routeFor, resolveCollectionAlias, type ParsedRoute } from './route'
import { useRowWindow, isFiberArchetype } from './rowWindow'
import {
  provideDb, makeWorkerDb, setPerf, describe, Handle, planRows, planDeferred, parseHandle, handleText, parsePreds, predsToSql,
  parseGroupBy, policyResolved,
  collectionMeta as loadCollMeta, aliases as loadAliases, polytopeCollections, carriers as loadCarriers,
  svgCarriers as loadSvgCarriers, tags as loadTags, collectionTags as loadCollTags, traits as loadTraits,
  collectionTraits as loadCollTraits, categories as loadCategories, collectionCategories as loadCollCats,
  type CollectionCategory, type DataResult, type MapInfo, type Pred, type RowQuery, type RowTable as RowTableData, type Stat, type CollectionMeta,
  type PolicyResolved,
} from '@enumeratio/client'

provideDb(() => makeWorkerDb()) // off-thread: enumeration runs in a Web Worker so the UI never blocks
if (import.meta.env.DEV) setPerf(true)

// ── the statement ─────────────────────────────────────────────────────────────────────────────────────────────
const coll = ref<string | null>(null)
const axes = ref<string[]>([])                  // the collection's grade chain — the FROM's axis chips
const q = ref<RowQuery>({ from: '' })
const table = ref<RowTableData | null>(null)
const card = ref<number | null>(null)
const category = ref<CollectionCategory>('mathematical')
const error = ref<string | null>(null)
const loading = ref(false)
const booting = ref(true)
const rowWindow = useRowWindow()   // element/fiber page sizes — reset per collection (openCollection), grown by more()

const collMeta = ref<Record<string, CollectionMeta>>({})
const aliasMap = ref<Record<string, string>>({})
const titleOf = (id: string | null) => (id && collMeta.value[id]?.title) || id || ''
const descOf = (id: string | null) => (id && collMeta.value[id]?.description) || null
const atRoot = computed(() => coll.value === 'collections')

// the collection's opening statement (base_policy_resolved, environment 'web', #245) — one registry roundtrip per
// navigation, cached alongside the rest of the shape in loadDerived; drives eager / the binding fallback / group_by
const policy = ref<PolicyResolved | null>(null)
const defaultGroupBy = ref('')   // the policy's own group_by (or '') — an unchanged group_by stays out of the URL

// the fiber binding, read back off the FROM text (the chips write it there)
const bindings = computed<Record<string, number>>(() => {
  if (!coll.value) return {}
  let p
  try { p = parseHandle(q.value.from) } catch { return {} }
  const out: Record<string, number> = {}
  p.positional.forEach((v, i) => { if (axes.value[i] && typeof v === 'number') out[axes.value[i]] = v })
  for (const [k, v] of Object.entries(p.named)) if (typeof v === 'number') out[k] = v
  return out
})
const boundN = computed<number | null>(() => bindings.value[axes.value[0]] ?? null)
/** the opening binding (policy_resolve('binding'), #245): '<name> = <int>'; '<axis>' means the first grade axis —
 *  this never reaches the handle, only the side panels' displayN */
function parseBindingN(text: string | null | undefined, ax: string[]): number | null {
  if (!text) return null
  const m = text.replace('<axis>', ax[0] ?? '').match(/^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*(-?\d+)\s*$/)
  return m ? Number(m[1]) : null
}
const displayN = computed(() => boundN.value ?? parseBindingN(policy.value?.binding, axes.value) ?? 4)
/** "this page opens as …" (#246): the archetype + whichever resolved clauses are non-null, off the SAME `policy`
 *  ref loadDerived already cached — no second base_policy_resolved query. */
const openingSummary = computed(() => {
  const p = policy.value
  if (!p) return null
  const clauses = [
    p.selectList != null && `select ${p.selectList}`,
    p.binding != null && `binding ${p.binding}`,
    p.groupBy != null && `group by ${p.groupBy}`,
    p.windowSize != null && `window ${p.windowSize}`,
    p.eager != null && `eager ${p.eager}`,
  ].filter((x): x is string => !!x)
  return `this page opens as ${p.archetype}${clauses.length ? ' — ' + clauses.join(' · ') : ''}`
})

// eager vs streamed (§0, #245): 'always' fetches regardless of size (the seeds make category internal resolve it);
// otherwise the policy's own cardinality threshold applies — category is no longer consulted here
const eager = computed(() => {
  const e = policy.value?.eager
  if (e === 'always') return true
  if (!e) return false
  return card.value !== null && card.value <= Number(e)
})
const sortable = computed(() => eager.value && table.value?.archetype === 'elements')
const filterable = computed(() => eager.value)

// ── the SELECT list: the Properties rows ARE the projected columns ────────────────────────────────────────────
const stats = ref<Stat[]>([])
const mapList = ref<MapInfo[]>([])
const properties = ref<PropRow[]>([])
/** the seeded list — an unchanged one stays out of the URL (§3: defaults are implicit) */
const defaultSelect = ref<string[]>([])
// the "+ add" menu follows the archetype: element rows take positions / element / stats / maps, grouped rows the
// fiber sources — one list, filtered by level (§5)
const allDefs = computed<PropDef[]>(() => buildPropDefs({
  stats: stats.value, maps: mapList.value, reprs: reprs.value, axes: axes.value,
  glyph: hasPageGlyph.value, meta: category.value === 'internal',
}))
/** the flat, deduped GROUP BY keys of a clause's text, first-appearance order, minus rank/element — mirrors
 *  rows.ts's own `<keys>` expansion (keysTemplate); shared by the fiber-level column filter and the seed's `<keys>` */
function groupByKeys(text: string | undefined): string[] {
  if (!text?.trim()) return []
  const seen = new Set<string>(); const out: string[] = []
  for (const k of parseGroupBy(text).sets.flat()) {
    if (k === 'rank' || k === 'element' || seen.has(k)) continue
    seen.add(k); out.push(k)
  }
  return out
}
// the STATEMENT decides the level, not the table it produced — reading the archetype back would loop the select
// list through its own result
const groupedQ = computed(() => !!q.value.groupBy?.trim())
// #245 (F2): an axis in the CURRENT grouping is a key column of the fiber rows — it must stay selectable/visible
// alongside the fiber sources, not fall out because buildPropDefs tags every axis 'element' unconditionally
const groupKeySet = computed(() => new Set(groupByKeys(q.value.groupBy)))
const propDefs = computed<PropDef[]>(() => allDefs.value.filter((d) =>
  groupedQ.value ? (d.level === 'fiber' || (d.kind === 'axis' && groupKeySet.value.has(d.id))) : d.level !== 'fiber'))
/** the visible rows OF THIS LEVEL, in order, ARE `select=` — a grouped statement has no element to project from */
const selectList = computed<string[]>(() =>
  properties.value.filter((p) => p.visible && propDefs.value.some((d) => d.id === p.propId)).map((p) => p.propId))
/** the per-column printer config the table draws with — presentation, kept local (fork 8a) */
const printers = computed(() => Object.fromEntries(properties.value.map((p) => [p.propId, p])))
const repr = ref('')
const reprs = ref<string[]>([])
const selRow = ref<DataResult | null>(null)
const selRank = ref<number | null>(null)
const elementEnabled = computed(() => selRank.value != null && !!selRow.value)

// ── collection-wide detail ────────────────────────────────────────────────────────────────────────────────────
const polyColls = ref<Record<string, string>>({})
const carrierMap = ref<Record<string, string>>({})
const svgCarrierSet = ref<Set<string>>(new Set())
const isPolytope = computed(() => !!coll.value && coll.value in polyColls.value)
const polyTitle = computed(() => (coll.value && polyColls.value[coll.value]) || 'Polytope')
const carrierOf = computed(() => (coll.value && carrierMap.value[coll.value]) || null)
const hasPageGlyph = computed(() => !!carrierOf.value && svgCarrierSet.value.has(carrierOf.value))
const detailEnabled = computed(() => isPolytope.value || hasPageGlyph.value)
const showChart = ref(true)
const whereFace = ref<'chips' | 'raw'>('raw')

// ── meta facets (#198 chunk 5): on `collections`, WHERE can ask a MEMBERSHIP question — is this collection tagged
// `lattice_paths`, does it carry `indexable`? Each is one chip term, spelled as the subquery it means.
type Vocab = { id: string; title: string }[]
const tagVocab = ref<Vocab>([]); const traitVocab = ref<Vocab>([]); const catVocab = ref<Vocab>([])
const collTags = ref<Record<string, string[]>>({}); const collTraits = ref<Record<string, string[]>>({})
const collCats = ref<Record<string, string>>({}); const allCarriers = ref<Record<string, string>>({})
const counted = (m: Record<string, string[]>) => { const c: Record<string, number> = {}; for (const v of Object.values(m)) for (const x of v) c[x] = (c[x] ?? 0) + 1; return c }
const countedOne = (m: Record<string, string>) => { const c: Record<string, number> = {}; for (const v of Object.values(m)) c[v] = (c[v] ?? 0) + 1; return c }
const byCount = (a: FacetOption, b: FacetOption) => (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label)
const opts = (vocab: Vocab, counts: Record<string, number>): FacetOption[] =>
  vocab.map((t) => ({ value: t.id, label: t.title, count: counts[t.id] ?? 0 })).filter((o) => o.count).sort(byCount)
const facets = computed<Facet[]>(() => {
  if (!atRoot.value) return []   // the facets are questions about a COLLECTION — only the catalog's own table has them
  const cs = countedOne(allCarriers.value)
  return ([
    { field: 'tag', label: 'tag', options: opts(tagVocab.value, counted(collTags.value)) },
    { field: 'trait', label: 'trait', options: opts(traitVocab.value, counted(collTraits.value)) },
    { field: 'category', label: 'category', options: opts(catVocab.value, countedOne(collCats.value)) },
    { field: 'carrier', label: 'carrier', options: Object.keys(cs).map((v) => ({ value: v, label: v, count: cs[v] })).sort(byCount) },
  ] as Facet[]).filter((f) => f.options.length)
})
const distribution = computed(() => distributionOf(table.value))

// ── routing (§3): the PATH is the address, the query string the view-config ───────────────────────────────────
const inElementView = ref(false)
const pinned = ref('')
const pendingSel = ref<string | null>(null)
let pendingView: ParsedRoute | null = null

function currentRoute(): ParsedRoute {
  const b = { ...bindings.value }
  const primary = axes.value[0]
  const n = primary != null && b[primary] != null ? b[primary] : null
  if (primary) delete b[primary]
  // §3: an empty or unchanged list is the archetype's default — implicit, so it stays out of the URL
  const curCols = selectList.value
  const defCols = defaultSelect.value
  const colsAtDefault = !curCols.length || (curCols.length === defCols.length && curCols.every((id, i) => id === defCols[i]))
  // #245: same for group_by — unchanged from the collection's own policy default stays implicit; an explicit clear
  // (the field emptied while a policy grouping applies) still needs `group_by=` written to win back over it on reload
  const gbAtDefault = (q.value.groupBy ?? '').trim() === defaultGroupBy.value.trim()
  return {
    address: { collection: coll.value, fiberBinding: { n, axes: b }, element: inElementView.value ? pinned.value : null },
    viewQuery: {
      repr: repr.value || undefined,
      groupBy: gbAtDefault ? undefined : (q.value.groupBy ?? ''),
      select: colsAtDefault ? undefined : curCols,
      where: q.value.where || undefined,
      having: q.value.having || undefined,
      orderBy: q.value.orderBy || undefined,
      // `ord` is retired (#198): ordinality and address are always columns of the row half
    },
  }
}
const writeUrl = () => history.replaceState({}, '', routeFor(currentRoute()))

/** the FROM text for a collection + a route's fiber binding — the core's own handle spelling */
function fromFor(c: string, chain: string[], n: number | null, ax: Record<string, number>): string {
  const args: Record<string, number> = { ...ax }
  if (n != null && chain[0]) args[chain[0]] = n
  return handleText(c, args, chain)
}

function readUrl() {
  const r = parseRoute(location)
  pendingView = r
  if (r.address.element !== null) { inElementView.value = true; pendingSel.value = r.address.element }
  else { inElementView.value = false; pendingSel.value = null; selRank.value = null; selRow.value = null; pinned.value = '' }
  return r
}

// ── the per-collection shape, memoized (the core DB never changes under us) ───────────────────────────────────
type Derived = { stats: Stat[]; axes: string[]; reprs: string[]; maps: MapInfo[]; category: CollectionCategory; policy: PolicyResolved | null }
const derivedCache = new Map<string, Derived>()
async function loadDerived(c: string): Promise<Derived> {
  let d = derivedCache.get(c)
  if (!d) {
    const info = await describe(c)
    const maps = await new Handle(c, {}).maps()
    const pol = await policyResolved(c, 'web')   // one registry roundtrip (#245) — cached alongside the rest of the shape
    d = { stats: info.stats, axes: info.axes, reprs: info.reprs.map((x) => x.id), maps, category: info.category, policy: pol }
    derivedCache.set(c, d)
  }
  return d
}

/** Open a collection: load its shape, seed the SELECT list, then apply whatever the URL carried. */
async function openCollection(c: string, route: ParsedRoute | null) {
  const canonical = resolveCollectionAlias(c, aliasMap.value)   // #101 — an alias has no realized surface
  coll.value = canonical
  if (typeof document !== 'undefined') document.title = `${titleOf(canonical)} · enumeratio explorer`
  const d = await loadDerived(canonical)
  stats.value = d.stats
  mapList.value = d.maps
  reprs.value = d.reprs
  axes.value = d.axes
  category.value = d.category
  policy.value = d.policy
  rowWindow.reset(d.policy?.windowSize ?? 100)
  const vq = route?.viewQuery
  // §6/#245: the URL's own group_by always wins (an explicit empty ?group_by= included); absent falls to the
  // collection's own policy default — a triangle (k_subsets) opens as its (n, k) fiber table. EXCEPT when the URL
  // carries element-level view config (select= / order_by= / where=) with no group_by: that URL predates or opts out
  // of the policy grouping — its author meant the element view, so the policy default stands down.
  const elementLevelUrl = vq?.groupBy === undefined && (vq?.select !== undefined || !!vq?.orderBy || !!vq?.where)
  const groupBy = vq?.groupBy !== undefined ? vq.groupBy : elementLevelUrl ? undefined : (d.policy?.groupBy ?? undefined)
  defaultGroupBy.value = elementLevelUrl ? '' : (d.policy?.groupBy ?? '')   // suppressed ⇒ ungrouped IS this URL's default
  // q.value goes FIRST (F1/F2): propDefs/groupedQ/groupKeySet read q.value.groupBy, and seeding + the defaultSelect
  // snapshot below must see the statement we're actually opening, not the previous collection's leftover grouping
  q.value = {
    from: fromFor(canonical, d.axes, route?.address.fiberBinding.n ?? null, route?.address.fiberBinding.axes ?? {}),
    where: vq?.where, groupBy, having: vq?.having, orderBy: vq?.orderBy,
  }
  properties.value = seedRows({ stats: d.stats, maps: d.maps, axes: d.axes, selectText: openingSelectText(d.policy, groupBy) })
  defaultSelect.value = selectList.value
  restorePrinters(canonical)
  repr.value = vq?.repr && d.reprs.includes(vq.repr) ? vq.repr : ''
  if (vq?.select !== undefined) applyColumns(vq.select)
  else if (vq?.maps !== undefined) { const want = new Set(vq.maps); for (const p of properties.value) if (p.propId.startsWith('map:')) p.visible = want.has(p.propId.slice(4)) }
  pendingView = null
  await run()
}
/** the seeded select text (policy_resolve('select'), #245): '<keys>' expands to the opening statement's own GROUP BY
 *  keys (mirrors rows.ts's own selectTextFor expansion) — the same fields the resolved page is about to open with */
function openingSelectText(pol: PolicyResolved | null, groupBy: string | undefined): string | undefined {
  const sel = pol?.selectList
  if (!sel) return undefined
  return sel.includes('<keys>') ? sel.replace('<keys>', groupByKeys(groupBy).join(', ')) : sel
}
/** the `?select=` order + visibility (#174, #205 — `?columns=` parses into the same list), over the freshly seeded rows */
function applyColumns(cs: string[]) {
  const order = new Map(cs.map((id, i) => [id, i]))
  const have = new Set(properties.value.map((p) => p.propId))
  // a spec the seed never listed (a repr, a glyph, a fiber aggregate) still names a column — give it a row
  // no printer is chosen for it — the column's kind picks one under the environment's grants
  const added = cs.filter((id) => !have.has(id)).map((id) => ({ uid: nextPropRowUid(), propId: id, visible: true }))
  properties.value = [...properties.value, ...added]
    .map((p) => ({ ...p, visible: order.has(p.propId) }))
    .sort((a, b) => (order.get(a.propId) ?? Infinity) - (order.get(b.propId) ?? Infinity) || a.uid - b.uid)
}

// ── printer config: per column, per collection, in localStorage — never in the URL (fork 8a) ──────────────────
type PrinterCfg = Pick<PropRow, 'format' | 'name' | 'width' | 'showLink'>
const printerKey = (c: string) => `enumeratio.printers.${c}`
function restorePrinters(c: string) {
  if (typeof localStorage === 'undefined') return
  try {
    const saved = JSON.parse(localStorage.getItem(printerKey(c)) ?? '{}') as Record<string, PrinterCfg>
    properties.value = properties.value.map((p) => (saved[p.propId] ? { ...p, ...saved[p.propId] } : p))
  } catch { /* a corrupt entry just means the defaults */ }
}
function savePrinters() {
  const c = coll.value
  if (!c || typeof localStorage === 'undefined') return
  const out: Record<string, PrinterCfg> = {}
  for (const p of properties.value) {
    const cfg: PrinterCfg = { format: p.format, name: p.name, width: p.width, showLink: p.showLink }
    if (cfg.format || cfg.name || cfg.width || cfg.showLink === false) out[p.propId] = cfg
  }
  try { localStorage.setItem(printerKey(c), JSON.stringify(out)) } catch { /* private mode, quota — presentation only */ }
}
watch(properties, savePrinters, { deep: true })

// ── the plan ──────────────────────────────────────────────────────────────────────────────────────────────────
let handle: Handle | null = null
async function run() {
  if (!coll.value || !q.value.from.trim()) return
  loading.value = true
  try {
    handle = new Handle(coll.value, boundN.value == null ? {} : boundN.value)
    for (const [ax, v] of Object.entries(bindings.value)) if (ax !== axes.value[0]) handle = handle.withGrade(ax, v)
    card.value = await handle.card()
    // eager: ONE call for the whole table; streamed: an element/fiber window sized by the policy (#245)
    const win = eager.value
      ? { first: 0, count: Math.max(1, card.value ?? rowWindow.count.value), fiberLimit: 2000 }
      : { first: 0, count: rowWindow.count.value, fiberLimit: rowWindow.fiberLimit.value }
    const sel = { select: selectList.value, repr: repr.value || undefined, eager: eager.value }
    table.value = await planRows(q.value, win, sel)
    // §4: the heavy columns (glyph) skipped the window — fetch them for the rows on screen and merge by address
    if (table.value.deferred.length) {
      const keyed = await planDeferred(q.value, table.value.rows.map((r) => String(r.address)), win, sel)
      const byAddr = new Map(keyed.map((r) => [String(r.address), r]))
      table.value = { ...table.value, rows: table.value.rows.map((r) => ({ ...r, ...(byAddr.get(String(r.address)) ?? {}) })) }
    }
    error.value = null
    if (!pendingView) writeUrl()
    await applyPendingSel()
  } catch (e) {
    error.value = (e as Error).message
  } finally { loading.value = false }
}
let timer: ReturnType<typeof setTimeout> | undefined
function schedule() { clearTimeout(timer); timer = setTimeout(() => void run(), 400) }
watch(q, schedule, { deep: true })
watch([selectList, repr], () => { if (table.value) void run() }, { deep: true })

/** Load more (#208): grow whichever window the current archetype streams from, then fetch just the NEW slice and
 *  append it — 'elements'/'rowgroup' page via first+count (no re-plan of the prefix already on screen). A
 *  fiber-shaped table (fibers/rollup/distribution) has no offset into `fibers(handle, n)`, so there growing
 *  fiberLimit means re-running the whole plan from zero — that's inherent to the fiber route, not this view. */
async function more() {
  const t = table.value
  if (!t || !coll.value) return
  const page = policy.value?.windowSize ?? 100
  const arch = t.archetype
  rowWindow.grow(arch, page, 200)
  if (isFiberArchetype(arch)) { await run(); return }
  loading.value = true
  try {
    const win = { first: t.rows.length, count: page, fiberLimit: rowWindow.fiberLimit.value }
    const sel = { select: selectList.value, repr: repr.value || undefined, eager: false }
    const next = await planRows(q.value, win, sel)
    let rows = next.rows
    if (next.deferred.length) {
      const keyed = await planDeferred(q.value, rows.map((r) => String(r.address)), win, sel)
      const byAddr = new Map(keyed.map((r) => [String(r.address), r]))
      rows = rows.map((r) => ({ ...r, ...(byAddr.get(String(r.address)) ?? {}) }))
    }
    table.value = { ...next, rows: [...t.rows, ...rows] }
    error.value = null
  } catch (e) {
    error.value = (e as Error).message
  } finally { loading.value = false }
}

// ── the table's one-way editors (eager mode) ──────────────────────────────────────────────────────────────────
function onSort(orderBy: string) { q.value = { ...q.value, orderBy: orderBy || undefined } }
/** the column menu WRITES chip terms into WHERE; the chips face stays the truth */
function onFilter(preds: Pred[]) {
  const cur = q.value.where?.trim() ?? ''
  const chips = parsePreds(cur, table.value?.available)
  const next = chips ? predsToSql([...chips, ...preds]) : [cur, predsToSql(preds)].filter(Boolean).join(' AND ')
  q.value = { ...q.value, where: next || undefined }
  if (chips) whereFace.value = 'chips'   // the menu writes a CHIP TERM — show it where it now lives
}

// ── the element pane ──────────────────────────────────────────────────────────────────────────────────────────
const selPanelRef = ref<{ $el: HTMLElement } | null>(null)
function scrollSelIntoView() { void nextTick(() => selPanelRef.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })) }
async function resolveSel() {
  selRow.value = null
  if (selRank.value == null || !handle) return
  const [row] = await handle.window(selRank.value, 1, { repr: repr.value || undefined, maps: mapList.value.map((m) => m.id), data: true, glyph: true })
  selRow.value = (row as DataResult) ?? null
  pinned.value = selRow.value?.element ?? ''
}
async function select(rank: number | null) {
  selRank.value = rank
  await resolveSel()
  const entering = !inElementView.value
  inElementView.value = true
  if (entering) history.pushState({}, '', routeFor(currentRoute())); else writeUrl()
  if (rank != null) scrollSelIntoView()
}
async function applyPendingSel() {
  if (!inElementView.value) return
  if (pendingSel.value == null) return
  const sel = pendingSel.value; pendingSel.value = null
  if (sel === '') { selRank.value = null; selRow.value = null; pinned.value = ''; return }
  const r = handle ? await handle.rankOf(sel) : null
  if (r != null) { selRank.value = r; await resolveSel(); scrollSelIntoView() }
}
async function onStep(dir: number) {
  if (selRank.value == null) return
  const next = selRank.value + dir
  if (next < 0 || (card.value != null && next > card.value - 1)) return
  await select(next)
}
/** a row click selects its element by serialization — the row half's own `element` column */
async function onRowClick(row: Record<string, unknown>) {
  const ser = row.element
  if (ser == null || !handle) return
  const r = await handle.rankOf(String(ser))
  if (r != null) await select(r)
}
async function onDetailSelect(v: number | string | null) {
  if (v == null) { await select(null); return }
  if (typeof v === 'number') { await select(v); return }
  const r = handle ? await handle.rankOf(v) : null
  if (r != null) await select(r)
}
const mapLink = (m: MapInfo) => `/explore/collection/${encodeURIComponent(m.codomain)}`

// ── boot ──────────────────────────────────────────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const [meta, am] = await Promise.all([
      loadCollMeta().catch(() => ({} as Record<string, CollectionMeta>)),
      loadAliases().catch(() => ({} as Record<string, string>)),
    ])
    collMeta.value = meta
    aliasMap.value = am
    const r = readUrl()
    await openCollection(r.address.collection ?? 'collections', r)
    if (!r.address.collection) writeUrl()   // canonicalize bare /explore/collection(/) → /explore/collection/collections
    booting.value = false
    void Promise.all([
      polytopeCollections().then((ps) => { polyColls.value = Object.fromEntries(ps.map((p) => [p.collection, p.title])) }).catch(() => {}),
      // one collection→carrier map serves both the per-page glyph lookup (carrierMap) and the facet counts (allCarriers)
      loadCarriers().then((c) => { carrierMap.value = c; allCarriers.value = c }).catch(() => {}),
      loadSvgCarriers().then((s) => { svgCarrierSet.value = s }).catch(() => { svgCarrierSet.value = new Set() }),
      Promise.all([loadTags(), loadCollTags()]).then(([t, ct]) => { tagVocab.value = t; collTags.value = ct }).catch(() => {}),
      Promise.all([loadTraits(), loadCollTraits()]).then(([t, ct]) => { traitVocab.value = t; collTraits.value = ct }).catch(() => {}),
      Promise.all([loadCategories(), loadCollCats()]).then(([c, cc]) => { catVocab.value = c; collCats.value = cc }).catch(() => {}),
    ])
    window.addEventListener('popstate', async () => {
      const rr = readUrl()
      const c = rr.address.collection ?? 'collections'
      if (c !== coll.value) await openCollection(c, rr)
      else await applyPendingSel()
    })
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.metaKey || e.ctrlKey || e.altKey || selRank.value == null) return
      const t = e.target as HTMLElement | null
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return
      e.preventDefault()
      void onStep(e.key === 'ArrowRight' ? 1 : -1)
    })
  } catch (e) {
    error.value = String(e)
  } finally { booting.value = false }
})
</script>

<template>
  <div class="wrap">
    <!-- header: the collection AS DATA — a back link when inside one, then its title, description, and size -->
    <header class="chead">
      <a v-if="!atRoot" href="/explore/collection/" class="rootlink">‹ Collections</a>
      <h2 class="ctitle">{{ titleOf(coll) }}</h2>
      <span v-if="descOf(coll)" class="cdesc">{{ descOf(coll) }}</span>
      <span v-if="loading" class="card"><i class="pi pi-spin pi-spinner" /> loading…</span>
      <span v-else-if="card !== null" class="card">{{ card.toLocaleString() }} elements</span>
      <span v-else class="card">∞ elements</span>
      <a v-if="coll" :href="`/explore/query?from=${encodeURIComponent(coll)}`" class="querylink"
         title="Open this collection in the query view">query ↗</a>
    </header>
    <p v-if="openingSummary" class="copening">{{ openingSummary }}</p>

    <div v-if="booting && !error" class="booting">
      <i class="pi pi-spin pi-spinner" />
      <span class="booting-title">Loading the catalog…</span>
      <small class="booting-sub">booting the in-browser database</small>
    </div>

    <template v-else>
      <StatementBar v-model="q" v-model:whereFace="whereFace" :table="table" :loading="loading" :error="error"
                    :pin="coll ? { coll, label: coll, axes } : undefined" :facets="facets" @more="more">
        <template #bar-pre>
          <Button v-if="distribution" size="small" text :label="showChart ? 'hide chart' : 'show chart'" icon="pi pi-chart-bar" @click="showChart = !showChart" />
        </template>
        <template #bar>
          <label v-if="reprs.length" class="reprsel">as
            <Select v-model="repr" :options="reprs" placeholder="canonical" showClear size="small" style="min-width: 9rem" />
          </label>
          <span v-if="!eager" class="hint" v-tooltip.top="'a stat sort materializes the relation — bind an axis in FROM, or write the ORDER BY yourself'">streamed</span>
        </template>
      </StatementBar>

      <!-- the SELECT editor: the visible rows ARE the statement's columns, in order — `select=` (#205) -->
      <Panel v-if="properties.length" header="Properties" toggleable :collapsed="true" class="abovepane">
        <PropertiesPane v-model="properties" :defs="propDefs" :selRow="selRow as any" :selRank="selRank"
                        :elementEnabled="elementEnabled" :isTex="false" />
      </Panel>

      <RowTable :table="table" :loading="loading" :fromText="q.from" :distribution="showChart ? distribution : null"
                :printers="printers" :defs="propDefs"
                :sortable="sortable" :filterable="filterable" :drillElements="atRoot"
                @rowClick="onRowClick" @sort="onSort" @filter="onFilter">
        <template #empty><p v-if="!loading && !error" class="empty">No rows.</p></template>
      </RowTable>

      <AlgebraEvaluator v-if="coll" :collection="coll" :n="displayN" />

      <Panel v-if="inElementView" ref="selPanelRef" header="Selected element" toggleable class="belowpane">
        <ElementPane v-if="elementEnabled" :collection="coll" :n="displayN" :rank="selRank" :row="selRow" :card="card"
                     :stats="stats" :maps="mapList" :isTex="false" :mapHref="mapLink" @step="onStep" @goto="(r) => select(r)" />
        <p v-else class="empty">No element selected — the collection's null (bottom) element.</p>
      </Panel>

      <Panel v-if="detailEnabled" header="Detail" toggleable class="belowpane">
        <p v-if="boundN == null" class="fallbackn">No size bound — showing <code>{{ coll }}({{ axes[0] ?? 'n' }} = {{ displayN }})</code>. Bind the axis in FROM to change it.</p>
        <DetailPane :collection="coll" :n="displayN" :isPolytope="isPolytope" :polyTitle="polyTitle"
                    :hasPageGlyph="hasPageGlyph" :sizeGraded="axes.length > 0" :selected="selRank" :selectedSer="pinned || null"
                    @select="onDetailSelect" />
      </Panel>

      <IdentityPane v-if="coll" :collection="coll" :n="displayN" :titleOf="titleOf" class="belowpane" />
    </template>
  </div>
</template>

<style>
:root { color-scheme: light dark; }
body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: var(--p-content-background); color: var(--p-text-color); }
</style>

<style scoped>
.wrap { max-width: 1200px; margin: 0 auto; padding: 1.5rem; }
.chead { display: flex; align-items: baseline; gap: 0.5rem 0.75rem; flex-wrap: wrap; margin: 0.25rem 0 1rem; }
.chead .ctitle { margin: 0; font-size: 1.35rem; font-weight: 700; }
.chead .cdesc { color: var(--p-text-muted-color); font-size: 0.9rem; }
.chead .card { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--p-text-muted-color); }
.chead .querylink { color: var(--p-primary-color); text-decoration: none; font-size: 0.85rem; }
.chead .querylink:hover { text-decoration: underline; }
.copening { margin: -0.5rem 0 1rem; font-size: 0.78rem; color: var(--p-text-muted-color); }
.rootlink { align-self: center; color: var(--p-primary-color); text-decoration: none; font-size: 0.9rem; }
.rootlink:hover { text-decoration: underline; }
.booting { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 4rem 1rem; color: var(--p-text-muted-color); }
.booting-title { font-size: 1rem; }
.booting-sub { font-size: 0.8rem; opacity: 0.75; }
.abovepane, .belowpane { margin: 1rem 0; }
.reprsel { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--p-text-muted-color); }
.hint { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--e-color-text-subtle, #888); border: 1px dashed var(--e-color-border, #ddd); border-radius: 999px; padding: 0.1rem 0.55rem; }
.fallbackn { margin: 0 0 0.75rem; font-size: 0.82rem; color: var(--p-text-muted-color); }
.empty { padding: 1rem; color: var(--p-text-muted-color); }
</style>
