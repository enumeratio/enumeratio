<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { permutationVectors, associahedron } from '@enumeratio/client'

// One projective space holding several polytopes at once. Coordinates are a (d+1)-component vector; the figures are
// d-dimensional projective space, viewed through the fixed orthonormal (Helmert) projection of ℝ^{d+1} onto the
// Σ=0 hyperplane (so at d=3 the 4-component coordinates render as a true 3-D scene): the permutohedron is the
// truncated octahedron, and the ±eᵢ axis points land on a cube (a simplex + its antipodal dual). Ported from the
// numbers repo (docs/components/Projective.vue); the permutohedron vertices come from the pg core, the rest is
// pure projective geometry. (The associahedron layer, which needs Loday coordinates, is a later addition.)
//
// The two "hypersimplex" layers are the orbit polytopes of (a,a,0,…) / (a,a,1,…) — rectified simplices Δ(2,m); at
// d=3 they are octahedra (named so in the caption), NOT the cross-polytope (that is its own signed_subsets
// collection). Two shapes tile this space: the permutohedron (A*_{m−1} lattice = affine symmetric group) and the
// hypercube ↔ subsets (ℤᵈ = cubic honeycomb, the abelian analogue); tessellation is a per-chip toggle, not global.
const d = ref(3)
const dd = computed(() => Math.max(2, Math.min(4, Math.trunc(d.value) || 3)))

const LAYERS = [
  { id: 'permutohedron', label: 'permutohedron', color: 0x3b82f6 },
  { id: 'associahedron', label: 'associahedron', color: 0x16a34a },
  { id: 'simplex', label: 'simplex', color: 0x9333ea },
  { id: 'dual', label: 'dual simplex', color: 0xdb2777 },
  { id: 'octahedron', label: 'hypersimplex · outer', color: 0xdc2626 },
  { id: 'octahedronInner', label: 'hypersimplex · inner', color: 0x06b6d4 },
  { id: 'hypercube', label: 'hypercube', color: 0xf59e0b },
]
// the hypersimplices ARE octahedra at d=3 — say so on the chip (the general name is dimension-agnostic).
const displayLabel = (l: { id: string; label: string }) =>
  dd.value === 3 && (l.id === 'octahedron' || l.id === 'octahedronInner')
    ? l.label.replace('hypersimplex', 'octahedron') : l.label

// two clean space-fillers tile this space: the permutohedron (A*_{m−1} lattice = affine symmetric group) and the
// hypercube ↔ subsets (the integer lattice ℤᵈ = cubic honeycomb, the abelian analogue). Tessellation is a per-chip
// ⊞ toggle, capped to d≤3.
const tessellatable = new Set(['permutohedron', 'hypercube'])
const show = ref<Record<string, boolean>>({ permutohedron: true, associahedron: true, simplex: false, dual: false, octahedron: false, octahedronInner: false, hypercube: false })
const tessellate = ref<Record<string, boolean>>({ permutohedron: false, hypercube: false })
const labels = ref(false)

// navigation: slide a bright "current cell" through a tessellation by a real offset in the lattice's own axis basis.
// Integer offsets land on genuine tiles (an affine permutation / an integer vector); fractional offsets sit between
// them — the discrete symmetry group (affine 𝔖ₙ / ℤᵈ) as a subgroup of the continuous translation group it lives in.
const navigating = ref(false)
const nav = ref<Record<string, number[]>>({ permutohedron: [0, 0, 0], hypercube: [0, 0, 0] })
function resetNav() { const D = dd.value; nav.value = { permutohedron: Array(D).fill(0), hypercube: Array(D).fill(0) } }

const perms = ref<number[][]>([]) // the m! permutation vectors (1-based) for m = d+1, from the core
const assoc = ref<{ vertices: number[][]; edges: [number, number][] }>({ vertices: [], edges: [] }) // Loday coords + flips
async function loadData() {
  perms.value = await permutationVectors(dd.value + 1)
  assoc.value = await associahedron(dd.value + 1) // trees with (d+1) internal nodes ⇒ Loday coords in R^{d+1}
}
onMounted(loadData)
watch(dd, () => { resetNav(); loadData() })

// fixed orthonormal Helmert basis of {Σ=0} ⊂ ℝᵐ → maps each (d+1)-vector to ℝᵈ
function helmert(m: number): number[][] {
  const B: number[][] = []
  for (let k = 1; k < m; k++) { const nrm = Math.sqrt(k * (k + 1)); const h = new Array(m).fill(0); for (let j = 0; j < k; j++) h[j] = 1 / nrm; h[k] = -k / nrm; B.push(h) }
  return B
}
const lab = (v: number[]) => '(' + v.map((x) => (Math.abs(x - Math.round(x)) < 1e-9 ? Math.round(x) : +x.toFixed(2))).join(',') + ')'

function permutohedron(rows: number[][]) {
  const pv = rows.map((p) => p.map((x) => x - 1)) // 0-based: permutations of 0..m-1
  const key = (p: number[]) => p.join(',')
  const idx = new Map(pv.map((p, i) => [key(p), i])), e: [number, number][] = [], seen = new Set<string>()
  // permutohedron edges = adjacent-VALUE transpositions: swap the entries holding v and v+1
  pv.forEach((p, i) => {
    for (let v = 0; v < p.length - 1; v++) {
      const q = p.slice(), a = q.indexOf(v), b = q.indexOf(v + 1); [q[a], q[b]] = [q[b], q[a]]
      const j = idx.get(key(q))!; const ek = i < j ? `${i},${j}` : `${j},${i}`
      if (!seen.has(ek)) { seen.add(ek); e.push([i, j]) }
    }
  })
  return { v: pv, e, labels: pv.map(lab) }
}
function simplices(m: number) {
  const T = (m * (m - 1)) / 2 // 0-based Σ of 0..m-1; bounding simplex {xᵢ≥0}
  const sV = Array.from({ length: m }, (_, k) => Array.from({ length: m }, (_, i) => (i === k ? T : 0)))
  const dV = sV.map((v) => v.map((x) => T - x)) // polar-opposite simplex
  const cg: [number, number][] = []; for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) cg.push([i, j])
  return { sV, dV, sEdge: cg }
}
function multisetPerms(ms: number[]): number[][] {
  const sorted = [...ms].sort((a, b) => a - b), used = new Array(sorted.length).fill(false), cur: number[] = [], out: number[][] = []
  ;(function rec() {
    if (cur.length === sorted.length) { out.push(cur.slice()); return }
    let prev = NaN
    for (let i = 0; i < sorted.length; i++) { if (used[i] || sorted[i] === prev) continue; used[i] = true; prev = sorted[i]; cur.push(sorted[i]); rec(); cur.pop(); used[i] = false }
  })()
  return out
}
function nearestEdges(v: number[][]): [number, number][] {
  const d2 = (a: number[], b: number[]) => a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0)
  let min = Infinity
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) { const dv = d2(v[i], v[j]); if (dv > 1e-9 && dv < min) min = dv }
  const e: [number, number][] = []
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (Math.abs(d2(v[i], v[j]) - min) < 1e-6) e.push([i, j])
  return e
}
// orbit polytope of (a,a,0,…) [outer] or (a,a,1,…) [inner] — the rectified simplex Δ(2,m) (an octahedron at m=4)
function octa(m: number, kind: 'outer' | 'inner') {
  const T = (m * (m - 1)) / 2
  let ms: number[] | null = null
  if (kind === 'outer') { if (T % 2 === 0) ms = [T / 2, T / 2, ...Array(m - 2).fill(0)] }
  else { const a = (T - (m - 2)) / 2; if (Number.isInteger(a) && a >= 1) ms = [a, a, ...Array(m - 2).fill(1)] }
  const v = ms ? multisetPerms(ms) : []
  return { v, e: v.length ? nearestEdges(v) : [], labels: v.map(lab) }
}
// the d-cube ↔ subsets of [d]: 2ᵈ vertices, one per subset, built axis-aligned in the ℝᵈ layer frame (which is
// exactly the zonotope of the d orthonormal Helmert vectors — a genuine metric cube). Edges = symmetric difference
// with a singleton (Hamming-1). Centred at the origin; `side` sizes it against the permutohedron.
function hypercube(dimD: number, side: number) {
  const N = 1 << dimD, h = side / 2, v: number[][] = [], labels: string[] = []
  for (let mask = 0; mask < N; mask++) {
    v.push(Array.from({ length: dimD }, (_, j) => ((mask >> j) & 1 ? h : -h)))
    const s: number[] = []; for (let j = 0; j < dimD; j++) if ((mask >> j) & 1) s.push(j + 1)
    labels.push('{' + s.join(',') + '}')
  }
  const e: [number, number][] = []
  for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) { const x = a ^ b; if (x && (x & (x - 1)) === 0) e.push([a, b]) }
  return { v, e, labels }
}

// projected geometry for every layer (null until the m! perms for this d have loaded)
const geomC = computed(() => {
  const m = dd.value + 1
  if (perms.value.length !== factorial(m)) return null
  const D = m - 1 // ambient dimension of the projected scene
  const B = helmert(m), map = (v: number[]) => B.map((h) => v.reduce((s, x, i) => s + x * h[i], 0))
  const perm = permutohedron(perms.value), sx = simplices(m)
  const permV = perm.v.map(map)
  // scale the hypercube to the permutohedron's circumradius R (all its vertices share it); cube circumradius =
  // (side/2)·√D, so side = 2R/√D lands the cube corners on the same sphere.
  const R = Math.hypot(...permV[0])
  const side = (2 * R) / Math.sqrt(D)
  const hyper = hypercube(D, side)
  const oOut = octa(m, 'outer'), oIn = octa(m, 'inner')
  const av = assoc.value.vertices.length === factorial(2 * m) / (factorial(m) * factorial(m + 1)) ? assoc.value : { vertices: [] as number[][], edges: [] as [number, number][] }
  const geom: Record<string, { v: number[][]; e: [number, number][]; labels: string[] }> = {
    permutohedron: { v: permV, e: perm.e, labels: perm.labels },
    associahedron: { v: av.vertices.map(map), e: av.edges, labels: av.vertices.map(lab) },
    simplex: { v: sx.sV.map(map), e: sx.sEdge, labels: sx.sV.map(lab) },
    dual: { v: sx.dV.map(map), e: sx.sEdge, labels: sx.dV.map(lab) },
    octahedron: { v: oOut.v.map(map), e: oOut.e, labels: oOut.labels },
    octahedronInner: { v: oIn.v.map(map), e: oIn.e, labels: oIn.labels },
    hypercube: { v: hyper.v, e: hyper.e, labels: hyper.labels },
  }
  return { m, D, map, perm, side, geom }
})

// a layer is available when its geometry is non-degenerate (≥2 vertices)
const avail = (id: string) => {
  const g = geomC.value; if (!g) return false
  return (g.geom[id]?.v.length ?? 0) >= 2
}

// the FULL generator set used to enumerate neighbouring tiles (over-complete for the permutohedron — its m vectors
// sum to 0 — but tiles() dedupes): permutohedron = perms of (1,…,1,1−m) mapped to ℝᵈ; hypercube = side·eⱼ.
function tileGens(id: string, g: NonNullable<typeof geomC.value>): number[][] {
  const { m, D, map, side } = g
  if (id === 'hypercube') return Array.from({ length: D }, (_, j) => Array.from({ length: D }, (_, i) => (i === j ? side : 0)))
  return Array.from({ length: m }, (_, k) => map(Array.from({ length: m }, (_, i) => (i === k ? 1 - m : 1))))
}
// an INDEPENDENT axis basis (exactly D vectors) for navigation — the first D of the tile generators (the m
// permutohedron generators are dependent, so the first D = m−1 already span the lattice).
function navBasis(id: string, g: NonNullable<typeof geomC.value>): number[][] { return tileGens(id, g).slice(0, g.D) }
// the ℝᵈ translation for a layer's current navigation offset (Σ offsetₖ · basisₖ)
function offsetVec(id: string, g: NonNullable<typeof geomC.value>): number[] {
  const b = navBasis(id, g), o = nav.value[id] || [], out = new Array(g.D).fill(0)
  for (let k = 0; k < b.length; k++) { const c = o[k] || 0; if (c) for (let i = 0; i < g.D; i++) out[i] += c * b[k][i] }
  return out
}

const layers = computed(() => {
  const g = geomC.value
  if (!g) return LAYERS.map((l) => ({ ...l, vertices: [], edges: [], labels: [], visible: false, showLabels: false }))
  const { geom } = g
  const navOn = navigating.value && dd.value <= 3
  const base = LAYERS.map((l) => {
    const ok = avail(l.id)
    let verts = ok ? geom[l.id].v : []
    // when navigating, the tessellated layer's bright cell slides by its offset (the rest stay put)
    if (navOn && ok && tessellatable.has(l.id) && tessellate.value[l.id] && show.value[l.id]) {
      const off = offsetVec(l.id, g)
      verts = verts.map((v) => v.map((x, i) => x + off[i]))
    }
    return { ...l, vertices: verts, edges: ok ? geom[l.id].e : [], labels: geom[l.id].labels, visible: ok && show.value[l.id], showLabels: labels.value }
  })
  if (dd.value > 3) return base // tessellation only for d≤3 — higher honeycombs are too dense to read
  const extra: typeof base = []
  // when navigating, keep the origin tile in the (grey) skeleton so the cell we moved leaves a hole behind it
  if (tessellate.value.permutohedron && show.value.permutohedron)
    extra.push(...tiles('p', geom.permutohedron.v, geom.permutohedron.e, tileGens('permutohedron', g), dd.value === 2 ? 6 : 14, navOn))
  if (tessellate.value.hypercube && show.value.hypercube && avail('hypercube'))
    extra.push(...tiles('h', geom.hypercube.v, geom.hypercube.e, tileGens('hypercube', g), dd.value === 2 ? 8 : 6, navOn))
  return [...extra, ...base] // grey skeleton behind, bright (possibly offset) cells on top
})

// nearest translated copies of a polytope (given in the ℝᵈ frame) under the lattice spanned by `gens` (also ℝᵈ),
// each sharing a facet with a neighbour. Drives both the permutohedron (A*_{m−1}) and hypercube (ℤᵈ) tessellations.
// includeOrigin keeps the untranslated copy (for navigation, so the moved cell leaves a grey tile behind).
function tiles(prefix: string, baseV: number[][], baseE: [number, number][], gens: number[][], count: number, includeOrigin = false) {
  const dimD = baseV[0].length, k = gens.length
  const key = (t: number[]) => t.map((x) => Math.round(x * 1e4) / 1e4).join(',')
  const seen = new Set<string>(includeOrigin ? [] : [key(new Array(dimD).fill(0))]); const cand: { t: number[]; nrm: number }[] = []
  for (let code = 0; code < 3 ** k; code++) {
    const t = new Array(dimD).fill(0); let c = code
    for (let j = 0; j < k; j++) { const a = (c % 3) - 1; c = Math.trunc(c / 3); if (a) for (let i = 0; i < dimD; i++) t[i] += a * gens[j][i] }
    const kk = key(t); if (seen.has(kk)) continue; seen.add(kk)
    cand.push({ t, nrm: Math.hypot(...t) })
  }
  cand.sort((a, b) => a.nrm - b.nrm)
  return cand.slice(0, count + (includeOrigin ? 1 : 0)).map((tile, idx) => ({
    id: prefix + 'tile:' + idx, label: 'tile', color: 0x94a3b8,
    vertices: baseV.map((v) => v.map((x, i) => x + tile.t[i])), edges: baseE, labels: [] as string[],
    visible: true, showLabels: false,
  }))
}
function factorial(k: number): number { let f = 1; for (let i = 2; i <= k; i++) f *= i; return f }

// --- navigation UI helpers ---
const activeTessellations = computed(() => {
  if (!geomC.value || dd.value > 3) return [] as string[]
  return [...tessellatable].filter((id) => tessellate.value[id] && show.value[id] && avail(id))
})
const anyTessellating = computed(() => activeTessellations.value.length > 0)
const layerOf = (id: string) => LAYERS.find((l) => l.id === id)!
const layerColor = (id: string) => '#' + layerOf(id).color.toString(16).padStart(6, '0')
const axisLabel = (id: string, k: number) => (id === 'hypercube' ? 'e' : 'g') + (k + 1)
const onLattice = (id: string) => (nav.value[id] || []).every((x) => Math.abs(x - Math.round(x)) < 1e-6)
const latCoord = (id: string) => '(' + (nav.value[id] || []).map((x) => Math.round(x)).join(',') + ')'
function setNav(id: string, k: number, e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value) || 0
  nav.value[id] = (nav.value[id] || []).map((x, i) => (i === k ? v : x))
}
function bump(id: string, k: number, dir: number) {
  const clamp = (x: number) => Math.max(-2.5, Math.min(2.5, x))
  nav.value[id] = (nav.value[id] || []).map((x, i) => (i === k ? clamp(x + dir) : x))
}
function resetLayerNav(id: string) { nav.value[id] = Array(dd.value).fill(0) }
</script>

<template>
  <div class="ov">
    <div class="bar">
      <label class="nfield"><span>dimension <em>d</em></span><input v-model.number="d" type="number" min="2" max="4" /></label>
      <div class="trow"><span class="rlbl">show</span>
        <span v-for="l in LAYERS" :key="l.id" class="chipwrap">
          <button class="chip" :class="{ on: show[l.id] && avail(l.id) }" :disabled="!avail(l.id)"
                  :title="avail(l.id) ? '' : 'not available at this dimension'" :style="{ '--c': '#' + l.color.toString(16).padStart(6, '0') }"
                  @click="show[l.id] = !show[l.id]"><span class="swatch" /> {{ displayLabel(l) }}</button>
          <button v-if="tessellatable.has(l.id) && dd <= 3" class="tilebtn" :class="{ on: tessellate[l.id] }"
                  :disabled="!avail(l.id) || !show[l.id]" title="tessellate — tile the space with this polytope"
                  @click="tessellate[l.id] = !tessellate[l.id]">⊞</button>
        </span>
        <label class="lblToggle"><input type="checkbox" v-model="labels" /> vertex labels</label>
        <label v-if="anyTessellating" class="lblToggle"><input type="checkbox" v-model="navigating" /> navigate</label>
      </div>
    </div>
    <div v-if="navigating && anyTessellating" class="navpanel">
      <div v-for="id in activeTessellations" :key="id" class="navrow">
        <span class="navname" :style="{ color: layerColor(id) }">{{ displayLabel(layerOf(id)) }} · move</span>
        <div v-for="k in dd" :key="k" class="axis">
          <span class="axlbl">{{ axisLabel(id, k - 1) }}</span>
          <button class="step" title="−1 tile" @click="bump(id, k - 1, -1)">−</button>
          <input type="range" min="-2.5" max="2.5" step="0.02" :value="nav[id][k - 1]" @input="setNav(id, k - 1, $event)" />
          <button class="step" title="+1 tile" @click="bump(id, k - 1, 1)">+</button>
          <span class="axval">{{ (nav[id][k - 1] || 0).toFixed(2) }}</span>
        </div>
        <span class="navbadge" :class="{ onlat: onLattice(id) }">{{ onLattice(id) ? 'on lattice · tile ' + latCoord(id) : 'between tiles (fractional)' }}</span>
        <button class="step reset" @click="resetLayerNav(id)">reset</button>
      </div>
    </div>
    <polytope-overlay :layers="layers" :scale="dd <= 2 ? 1.5 : 1.3" />
    <p class="cap">The coordinates are a <strong>{{ dd + 1 }}-component</strong> vector; the figures are the
      <em>d</em>={{ dd }}-dimensional projective space (Helmert-projected to 3-D). Two shapes tile the space — toggle
      <strong>⊞</strong>: the permutohedron (truncated octahedron) by the affine symmetric group, and the hypercube
      (its vertices the subsets of [<em>d</em>]) by the integer lattice ℤ<sup>d</sup>. <strong>tetrahedron ⊇
      associahedron ⊇ permutohedron</strong>; the simplex + dual simplex are two tetrahedra whose hull is a cube. The
      concentric <em>hypersimplices</em> (rectified simplices) are octahedra at <em>d</em>=3. With <strong>⊞</strong>
      on, tick <strong>navigate</strong> to slide a cell through the tiling — whole steps land on a tile (an affine
      permutation / an integer vector), fractional steps sit <em>between</em> tiles.</p>
  </div>
</template>

<style scoped>
.ov { margin: 0.5rem 0; }
.bar { display: flex; align-items: flex-start; gap: 1.2rem; flex-wrap: wrap; margin-bottom: 0.7rem; }
.nfield { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.8rem; font-weight: 600; color: var(--p-text-muted-color); }
.nfield em { font-style: italic; font-weight: 400; }
.nfield input { padding: 0.3rem 0.5rem; border: 1px solid var(--p-content-border-color); border-radius: 4px; background: var(--p-content-hover-background); color: var(--p-text-color); font-family: ui-monospace, monospace; font-size: 0.875rem; width: 4rem; }
.trow { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.rlbl { font-size: 0.72rem; font-weight: 600; color: var(--p-text-muted-color); }
.chipwrap { display: inline-flex; align-items: center; gap: 0.15rem; }
.chip { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.5rem; border: 1px solid var(--p-content-border-color); border-radius: 4px; background: var(--p-content-hover-background); color: var(--p-text-muted-color); cursor: pointer; font-size: 0.78rem; }
.chip.on { color: var(--p-text-color); border-color: var(--c); }
.chip:disabled { opacity: 0.35; cursor: not-allowed; }
.tilebtn { padding: 0.2rem 0.35rem; border: 1px solid var(--p-content-border-color); border-radius: 4px; background: var(--p-content-hover-background); color: var(--p-text-muted-color); cursor: pointer; font-size: 0.78rem; line-height: 1; }
.tilebtn.on { color: var(--p-text-color); border-color: var(--p-primary-color); background: color-mix(in srgb, var(--p-primary-color) 15%, transparent); }
.tilebtn:disabled { opacity: 0.3; cursor: not-allowed; }
.lblToggle { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; color: var(--p-text-muted-color); cursor: pointer; margin-left: 0.4rem; }
.swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; background: var(--c); opacity: 0.35; }
.chip.on .swatch { opacity: 1; }
.cap { font-size: 0.8rem; color: var(--p-text-muted-color); line-height: 1.5; margin-top: 0.6rem; max-width: 44rem; }
.cap em { font-style: italic; }
.navpanel { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.7rem; padding: 0.55rem 0.7rem; border: 1px solid var(--p-content-border-color); border-radius: 6px; background: var(--p-content-hover-background); }
.navrow { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; }
.navname { font-size: 0.75rem; font-weight: 700; }
.axis { display: inline-flex; align-items: center; gap: 0.3rem; }
.axlbl { font-family: ui-monospace, monospace; font-size: 0.72rem; color: var(--p-text-muted-color); min-width: 1.2rem; text-align: right; }
.axis input[type='range'] { width: 6.5rem; accent-color: var(--p-primary-color); }
.axval { font-family: ui-monospace, monospace; font-size: 0.72rem; color: var(--p-text-color); min-width: 2.6rem; }
.step { padding: 0.05rem 0.4rem; border: 1px solid var(--p-content-border-color); border-radius: 4px; background: var(--p-content-background); color: var(--p-text-color); cursor: pointer; font-size: 0.8rem; line-height: 1.2; }
.step.reset { font-size: 0.72rem; }
.navbadge { font-size: 0.72rem; font-weight: 600; padding: 0.1rem 0.45rem; border-radius: 4px; background: color-mix(in srgb, var(--p-text-muted-color) 18%, transparent); color: var(--p-text-muted-color); }
.navbadge.onlat { background: color-mix(in srgb, var(--p-primary-color) 20%, transparent); color: var(--p-text-color); }
</style>
