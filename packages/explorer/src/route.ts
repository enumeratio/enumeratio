// The explorer's mount contract: a typed deserialize/serialize pair around the URL, mirroring the query model's
// FROM-vs-config split (see the Type-Model-and-Routing wiki page).
//
//   PATH = ADDRESS       — which objects: (collection, fiber-binding, element). This is identity.
//   QUERY = VIEW-CONFIG  — how to render the addressed set: repr / group_by / maps / select / where / having / order_by / ord.
//
// parseRoute(location) → { address, viewQuery }  deserializes; routeFor(route) serializes the inverse.
//
// #39: the fiber-binding (n + secondary axes) is address state, so it belongs in the PATH, not the query string. It
// wire-formats as matrix parameters (RFC 3986 style) on the collection segment: /explore/collection/<coll>;n=4;k=2
// — attached to that segment rather than a segment of its own, so an unbound collection/element URL (no params) is
// byte-identical to before. View-config (repr/group_by/maps/select/where/having/order_by/ord) stays in the query
// string; it is genuinely optional rendering config, not part of the address.

/** PATH = address: the (collection, fiber-binding, element) locator — which objects. */
export interface RouteAddress {
  /** the collection id; null before any collection is chosen (bare /explore/collection). */
  collection: string | null
  /** the fiber binding: primary size `n` + secondary grade-axis bindings by name. */
  fiberBinding: FiberBinding
  /**
   * the element locator within the collection view:
   *   null   — collection view, no element pane
   *   ''     — element view showing the null (bottom) element
   *   string — the element with this canonical serialization
   */
  element: string | null
}

export interface FiberBinding {
  /** primary fiber param (size). null = UNBOUND — the collection's whole extent across every n (#175): a graded
   *  collection defaults to browsing its full infinite family, not a single hardcoded slice. Omitted from the URL. */
  n: number | null
  /** secondary grade-axis bindings, by axis name. Absent = unbound (that axis's full range) — the pg constructor's
   *  own "trailing unbound parameter" convention (see Handle.built() in @enumeratio/client). On parse: only the
   *  URL-present ones; the app resolves them against the collection's actual axes once loaded. On build: the live
   *  bindings (unbound ones dropped by routeFor). */
  axes: Record<string, number>
}

/** QUERY = view-config: how to project / filter / group / sort / render the addressed set. Defaults are omitted. */
export interface ViewQuery {
  /** SELECT render representation. */
  repr?: string
  /** GROUP BY clause text. undefined = absent (the collection's own policy default, #245, applies); '' =
   *  present-but-empty (an explicit override back to ungrouped — distinct from absent when a policy default applies). */
  groupBy?: string
  /** shown map columns. undefined = absent (leave all as-is); [] = present-but-empty (hide all). */
  maps?: string[]
  /** the SELECT list: the projected columns in display order, each a column spec of the column half (#205 —
   *  a bare axis/statistic id, `repr:`, `map:`, `through:`, `glyph`, `data`, `title`, `dist:`, an aggregate, …).
   *  undefined = absent (the archetype's default list); [] = present-but-empty (hide every column). Serialized as
   *  `select=`; the older `columns=` (#174, stat ids + `map:` ids) parses into it and is never written again. */
  select?: string[]
  /** WHERE predicate. */
  where?: string
  /** HAVING predicate (grouped views). */
  having?: string
  /** ORDER BY. */
  orderBy?: string
  /** WITH ORDINALITY, explicitly pinned (tri-state; undefined = default/unpinned). */
  ord?: boolean
}

export interface ParsedRoute {
  address: RouteAddress
  viewQuery: ViewQuery
}

/** Deserialize a location into the typed address + view-config. Pure — no reactive/DOM deps beyond the passed value. */
export function parseRoute(location: { pathname: string; search: string }): ParsedRoute {
  const rest = location.pathname.replace(/^\/explore\/collection\/?/, '')
  const parts = rest === '' ? [] : rest.split('/')
  // the collection segment carries the fiber-binding as matrix params: "<coll>;n=4;k=2". Split on the first ';' —
  // encodeURIComponent escapes any literal ';' inside the collection id itself, so this split is unambiguous.
  const [collSeg, ...paramSegs] = (parts[0] ?? '').split(';')
  const collection = collSeg ? decodeURIComponent(collSeg) : null
  const element = parts.length >= 2 ? decodeURIComponent(parts[1] || '') : null

  let n: number | null = null   // absent ⇒ unbound/whole (#175), not a hardcoded slice
  const axes: Record<string, number> = {}
  for (const seg of paramSegs) {
    const eq = seg.indexOf('=')
    if (eq < 0) continue
    const k = decodeURIComponent(seg.slice(0, eq))
    const v = seg.slice(eq + 1)
    if (v === '') continue
    if (k === 'n') n = Number(v)
    else axes[k] = Number(v)
  }

  const q = new URLSearchParams(location.search)
  const ord = q.get('ord')
  const maps = q.get('maps')
  const sel = q.get('select') ?? q.get('columns')   // `columns=` is the legacy spelling of the same list (fork 8c)
  const viewQuery: ViewQuery = {
    repr: q.get('repr') ?? undefined,
    groupBy: q.get('group_by') ?? undefined,
    maps: maps == null ? undefined : maps.split(',').filter(Boolean),
    select: sel == null ? undefined : sel.split(',').map((x) => x.trim()).filter(Boolean),
    where: q.get('where') ?? undefined,
    having: q.get('having') ?? undefined,
    orderBy: q.get('order_by') ?? undefined,
    ord: ord === '1' ? true : ord === '0' ? false : undefined,
  }
  return { address: { collection, fiberBinding: { n, axes }, element }, viewQuery }
}

/** Serialize the typed address + view-config back to a location string. Inverse of parseRoute; defaults omitted. */
export function routeFor({ address, viewQuery }: ParsedRoute): string {
  const c = address.collection || 'collections'
  // fiber-binding rides as matrix params on the collection segment (n first, then axes in binding order) — absent
  // entirely when unbound, so a plain collection/element URL is byte-identical to the pre-#39 format.
  const params: string[] = []
  if (address.fiberBinding.n != null) params.push(`n=${Math.trunc(address.fiberBinding.n)}`)
  for (const [ax, v] of Object.entries(address.fiberBinding.axes)) if (v != null) params.push(`${encodeURIComponent(ax)}=${v}`)
  const collSeg = encodeURIComponent(c) + (params.length ? ';' + params.join(';') : '')
  const base = address.element == null
    ? `/explore/collection/${collSeg}`
    : `/explore/collection/${collSeg}/${address.element ? encodeURIComponent(address.element) : ''}`
  // Insertion order fixes the query-string byte layout: group_by, repr, maps, select, where, having, order_by, ord
  // — each emitted only when it DIFFERS from its default (absence = "default active").
  const q = new URLSearchParams()
  if (viewQuery.groupBy !== undefined) q.set('group_by', viewQuery.groupBy)
  if (viewQuery.repr) q.set('repr', viewQuery.repr)
  if (viewQuery.maps && viewQuery.maps.length) q.set('maps', viewQuery.maps.join(','))
  if (viewQuery.select !== undefined) q.set('select', viewQuery.select.join(','))
  if (viewQuery.where) q.set('where', viewQuery.where)
  if (viewQuery.having) q.set('having', viewQuery.having)
  if (viewQuery.orderBy) q.set('order_by', viewQuery.orderBy)
  if (viewQuery.ord != null) q.set('ord', viewQuery.ord ? '1' : '0')
  const qs = q.toString()
  return qs ? `${base}?${qs}` : base
}

/** Resolve a collection id through the alias table (base_collection.alias_of, #101 — id → canonical id, from
 *  @enumeratio/client's `aliases()`). Returns the id unchanged when it isn't an alias (or the table is empty /
 *  hasn't loaded yet — a safe no-op, not a broken redirect). One hop: aliases don't chain (base_alias itself
 *  refuses to alias an alias), so no loop guard is needed. Pure — CollectionView's openCollection is the only caller, right
 *  before it would otherwise load the (nonexistent) realized surface of an alias. */
export function resolveCollectionAlias(id: string, aliasMap: Record<string, string>): string {
  return aliasMap[id] ?? id
}

// ── the breadcrumb trail (#181) ──────────────────────────────────────────────────────────────────────────────────
// A cross-link — a map/through image, a drill-element, a sibling, the root back-link — hops the address (PATH) to
// somewhere else entirely, not just deeper into the same collection's view-config. CollectionView owns navigating
// those hops itself (VitePress's own router pushes the URL but never remounts the app across two /explore/collection
// addresses — both land in the SAME not-found slot, #158) and, while it's at it, records each one as a CRUMB: the
// address being left behind. The trail is session-local (an in-memory stack, not URL/localStorage state) — it
// exists only because the app now truly persists across every in-app hop; a hard reload starts a fresh trail, which
// is the right behavior for "where have I been," not a limitation to work around.

/** One past place on the trail: the address left behind by a hop, its display title, and — when the hop followed a
 *  map/through image — the map's own label, so the trail can say `Permutations —inverse→ Permutations` rather than
 *  just repeating collection names. */
export interface RouteCrumb {
  address: RouteAddress
  title: string
  via?: string
}

/** A stable equality key for an address, blind to view-config and to `axes` key-insertion order — reuses routeFor's
 *  own canonical serialization (routeFor itself preserves binding order, #39, since THAT'S what the URL bar should
 *  show) over the axes sorted by name, rather than a bespoke comparison. */
export function addressKey(address: RouteAddress): string {
  const sortedAxes = Object.fromEntries(Object.entries(address.fiberBinding.axes).sort(([a], [b]) => a.localeCompare(b)))
  return routeFor({ address: { ...address, fiberBinding: { ...address.fiberBinding, axes: sortedAxes } }, viewQuery: {} })
}

/** Push the address being left onto the trail, right before hopping to `to`. A no-op when the hop doesn't actually
 *  go anywhere (a link back to the exact place you're standing) or when `from` is already the trail's own top (a
 *  double-fire of the same click) — so the trail only ever grows by real hops. */
export function pushCrumb(crumbs: RouteCrumb[], from: RouteCrumb, to: RouteAddress): RouteCrumb[] {
  if (addressKey(from.address) === addressKey(to)) return crumbs
  const top = crumbs[crumbs.length - 1]
  if (top && addressKey(top.address) === addressKey(from.address)) return crumbs
  return [...crumbs, from]
}

/** Reconcile the trail against a browser back/forward landing: if the new address matches an earlier crumb, that
 *  crumb — and everything recorded after it, all now ahead of where we've landed again — drops off the trail.
 *  Landing somewhere the trail never recorded (the very first load, a manual URL edit) leaves the trail untouched:
 *  best-effort bookkeeping, not a hard invariant. */
export function reconcileCrumbs(crumbs: RouteCrumb[], landedOn: RouteAddress): RouteCrumb[] {
  const key = addressKey(landedOn)
  const i = crumbs.findIndex((c) => addressKey(c.address) === key)
  return i < 0 ? crumbs : crumbs.slice(0, i)
}
