import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'

type Cell = { verts: number[]; label?: string }

// <polytope-figure> — the Lit port of PolytopeView.vue. Generic view of a polytope: nD vertex coordinates (on a
// hyperplane) + explicit edges for the wireframe, plus *cells* — the selectable elements, each a set of vertex
// indices with a label (a vertex = one index, an edge = two, a face = three or more). Emits a `select` CustomEvent
// (detail = cell index) on click/dblclick. Data goes in as properties (`.vertices`, `.edges`, `.cells`, …). The
// three.js logic is unchanged from the Vue version; only the shell (props / lifecycle / event / theming) differs.
@customElement('polytope-figure')
export class PolytopeFigure extends LitElement {
  @property({ attribute: false }) vertices: number[][] = []
  @property({ attribute: false }) edges: [number, number][] = []
  @property({ attribute: false }) cells: Cell[] | null = null
  @property({ attribute: false }) labels: string[] = []
  @property({ attribute: false }) faces: number[][] = []
  @property({ type: Number }) selected: number | null = null
  @property({ type: Number }) height = 460
  @property({ type: Number }) scale = 0.6

  @query('.canvas-host') private hostEl!: HTMLDivElement

  private cleanup: () => void = () => {}
  private rebuild: () => void = () => {}
  private setSelection: ((i: number | null) => void) | null = null
  private doReorient: (() => void) | null = null
  private started = false

  reorient(): void {
    this.doReorient?.()
  }

  firstUpdated(): void {
    void this.init()
  }

  updated(changed: Map<string, unknown>): void {
    if (!this.started) return
    if (['vertices', 'edges', 'labels', 'faces', 'cells'].some((k) => changed.has(k))) this.rebuild()
    if (changed.has('selected')) this.setSelection?.(this.selected ?? null)
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.cleanup()
    this.started = false
  }

  private gramSchmidt(vecs: number[][]): number[][] {
    const basis: number[][] = []
    for (const v of vecs) {
      let u = v.slice()
      for (const b of basis) {
        const d = u.reduce((s, x, i) => s + x * b[i], 0)
        u = u.map((x, i) => x - d * b[i])
      }
      const norm = Math.hypot(...u)
      if (norm > 1e-9) basis.push(u.map((x) => x / norm))
      if (basis.length === 3) break
    }
    return basis
  }

  private project(verts: number[][]): { pts: number[][]; dim: number } {
    if (!verts.length) return { pts: [], dim: 0 }
    const mean = verts[0].map((_, j) => verts.reduce((s, v) => s + v[j], 0) / verts.length)
    const centered = verts.map((v) => v.map((x, j) => x - mean[j]))
    const basis = this.gramSchmidt(centered)
    const pts = centered.map((c) => {
      const p = [0, 0, 0]
      basis.forEach((b, k) => (p[k] = c.reduce((s, x, i) => s + x * b[i], 0) * this.scale))
      return p
    })
    return { pts, dim: basis.length }
  }

  private async init(): Promise<void> {
    const self = this
    const container = this.hostEl
    if (!container) return
    const THREE = await import('three')
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
    const el = container
    const width = el.clientWidth || 640,
      height = self.height

    const scene = new THREE.Scene()
    const fh = 4.5,
      aspect = width / height
    const camera = new THREE.OrthographicCamera(-fh * aspect, fh * aspect, fh, -fh, 0.1, 1000)
    const flatStart = self.project(self.vertices).dim <= 2
    camera.position.set(...((flatStart ? [0, 0, 8] : [4, 3, 4.3]) as [number, number, number]))
    camera.lookAt(0, 0, 0)
    const defaultCam = camera.position.clone()
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    el.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    const HL = 0x3b82f6

    let geom = new THREE.Group()
    scene.add(geom)
    let selHL = new THREE.Group()
    scene.add(selHL)
    let hovHL = new THREE.Group()
    scene.add(hovHL)
    let pts3: number[][] = [],
      cells: Cell[] = [],
      labelObjs: any[] = [],
      is3d = false
    let vertPoints: any[] = [],
      cellMeshes: any[] = [],
      decoMeshes: any[] = [],
      edgeLine: any = null
    const vertexCell = new Map<number, number>(),
      edgeCell = new Map<string, number>()
    let hoveredCell: number | null = null,
      hoveredDeco: number | null = null
    const ek = (i: number, j: number) => (i < j ? `${i},${j}` : `${j},${i}`)
    let edgeSet = new Set<string>()

    const sub3 = (a: number[], b: number[]) => a.map((x, i) => x - b[i])
    const dot3 = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0)
    const cross3 = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
    const unit3 = (v: number[]) => {
      const m = Math.hypot(...v) || 1
      return v.map((x) => x / m)
    }
    const centroid = (idxs: number[]) => [0, 1, 2].map((k) => idxs.reduce((s, i) => s + pts3[i][k], 0) / idxs.length)
    function coplanar(idxs: number[]): boolean {
      if (idxs.length <= 3) return true
      const c = centroid(idxs),
        u = unit3(sub3(pts3[idxs[0]], c))
      let nrm: number[] | null = null
      for (let k = 1; k < idxs.length; k++) {
        const cr = cross3(u, unit3(sub3(pts3[idxs[k]], c)))
        if (Math.hypot(...cr) > 1e-6) {
          nrm = unit3(cr)
          break
        }
      }
      return !nrm || idxs.every((i) => Math.abs(dot3(sub3(pts3[i], c), nrm!)) < 0.06)
    }

    function faceMesh(idxs: number[], color: number, opacity: number) {
      const c = centroid(idxs)
      const u = unit3(sub3(pts3[idxs[0]], c))
      let nrm = [0, 0, 1]
      for (let k = 1; k < idxs.length; k++) {
        const cr = cross3(u, unit3(sub3(pts3[idxs[k]], c)))
        if (Math.hypot(...cr) > 1e-6) {
          nrm = unit3(cr)
          break
        }
      }
      const w = cross3(nrm, u)
      const ord = [...idxs].sort(
        (a, b) =>
          Math.atan2(dot3(sub3(pts3[a], c), w), dot3(sub3(pts3[a], c), u)) -
          Math.atan2(dot3(sub3(pts3[b], c), w), dot3(sub3(pts3[b], c), u)),
      )
      const pos: number[] = []
      for (let k = 0; k < ord.length; k++) pos.push(...c, ...pts3[ord[k]], ...pts3[ord[(k + 1) % ord.length]])
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.computeVertexNormals()
      return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }))
    }
    const upY = new THREE.Vector3(0, 1, 0)
    function tube(a: number[], b: number[], radius: number, color: number, opacity: number) {
      const va = new THREE.Vector3(...a),
        vb = new THREE.Vector3(...b)
      const dir = new THREE.Vector3().subVectors(vb, va)
      const len = dir.length() || 1e-6
      const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }))
      m.position.copy(va).add(vb).multiplyScalar(0.5)
      m.quaternion.setFromUnitVectors(upY, dir.normalize())
      return m
    }
    function fatPoints(idxs: number[], opacity: number) {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(idxs.flatMap((i) => pts3[i]), 3))
      return new THREE.Points(g, new THREE.PointsMaterial({ color: HL, size: 0.34, sizeAttenuation: true, transparent: true, opacity, depthWrite: false }))
    }
    function makeLabel(text: string) {
      const w = Math.max(120, 20 * text.length)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = 64
      const ctx = canvas.getContext('2d')!
      ctx.font = 'bold 30px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 8
      ctx.strokeStyle = 'rgba(255,255,255,0.92)'
      ctx.strokeText(text, w / 2, 34)
      ctx.fillStyle = '#111'
      ctx.fillText(text, w / 2, 34)
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }))
      sprite.scale.set((w / 64) * 0.16, 0.16, 1)
      return sprite
    }
    function disposeGroup(g: any) {
      g.traverse((c: any) => {
        c.geometry?.dispose?.()
        c.material?.dispose?.()
      })
    }

    function cellGroup(ci: number, opaque: boolean) {
      const g = new THREE.Group()
      const cell = cells[ci]
      if (!cell) return g
      const op = opaque ? 1 : 0.4
      if (cell.verts.length >= 3 && coplanar(cell.verts)) g.add(faceMesh(cell.verts, HL, opaque ? 0.3 : 0.18))
      for (let a = 0; a < cell.verts.length; a++)
        for (let b = a + 1; b < cell.verts.length; b++)
          if (edgeSet.has(ek(cell.verts[a], cell.verts[b]))) g.add(tube(pts3[cell.verts[a]], pts3[cell.verts[b]], 0.035, HL, op))
      g.add(fatPoints(cell.verts, op))
      return g
    }
    function buildHighlight(ci: number | null) {
      scene.remove(selHL)
      disposeGroup(selHL)
      selHL = ci != null ? cellGroup(ci, true) : new THREE.Group()
      scene.add(selHL)
    }
    function buildHover(ci: number | null) {
      scene.remove(hovHL)
      disposeGroup(hovHL)
      hovHL = ci != null && ci !== self.selected ? cellGroup(ci, false) : new THREE.Group()
      scene.add(hovHL)
    }
    self.setSelection = buildHighlight

    function buildGeometry() {
      scene.remove(geom)
      disposeGroup(geom)
      geom = new THREE.Group()
      scene.add(geom)
      labelObjs = []
      vertPoints = []
      cellMeshes = []
      decoMeshes = []
      vertexCell.clear()
      edgeCell.clear()
      hoveredCell = null
      hoveredDeco = null
      const pr = self.project(self.vertices)
      pts3 = pr.pts
      is3d = pr.dim >= 3
      edgeSet = new Set(self.edges.map(([i, j]) => ek(i, j)))
      cells = self.cells ?? pts3.map((_, i) => ({ verts: [i], label: self.labels[i] }))

      self.faces.forEach((idxs, fi) => {
        if (idxs.length < 3 || idxs.some((i) => !pts3[i])) return
        const m = faceMesh(idxs, 0x7c9cff, 0.08)
        m.userData.deco = fi
        geom.add(m)
        decoMeshes.push(m)
      })
      const ep: number[] = []
      for (const [i, j] of self.edges) if (pts3[i] && pts3[j]) ep.push(...pts3[i], ...pts3[j])
      const eg = new THREE.BufferGeometry()
      eg.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3))
      edgeLine = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x8891a6 }))
      geom.add(edgeLine)
      pts3.forEach((p, i) => {
        const pg = new THREE.BufferGeometry()
        pg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
        const pm = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xb8c0d0, size: 0.13, sizeAttenuation: true }))
        pm.userData.vi = i
        geom.add(pm)
        vertPoints.push(pm)
      })
      cells.forEach((cell, ci) => {
        if (cell.verts.length === 1) vertexCell.set(cell.verts[0], ci)
        else if (cell.verts.length === 2) edgeCell.set(ek(cell.verts[0], cell.verts[1]), ci)
        if (cell.verts.length >= 3 && cell.verts.every((i) => pts3[i]) && coplanar(cell.verts)) {
          const m = faceMesh(cell.verts, 0x7c9cff, 0.08)
          m.userData.cell = ci
          geom.add(m)
          cellMeshes.push(m)
        }
        if (cell.label && cell.verts.every((i) => pts3[i])) {
          const c = centroid(cell.verts)
          const s = makeLabel(cell.label)
          s.position.set(c[0], c[1] + 0.16, c[2])
          s.userData.cell = ci
          geom.add(s)
          labelObjs.push({ sprite: s, base: s.scale.clone(), ci, dir: unit3(c) })
        }
      })
      buildHighlight(self.selected ?? null)
      buildHover(null)
    }

    let orientTarget: any = null
    const aim = (ci: number | null) => {
      if (ci != null && cells[ci]) {
        const c = centroid(cells[ci].verts)
        orientTarget = new THREE.Vector3(...c).normalize().multiplyScalar(camera.position.length())
      } else orientTarget = defaultCam.clone()
    }
    self.doReorient = () => {
      if (is3d) aim(self.selected ?? null)
      else orientTarget = new THREE.Vector3(0, 0, camera.position.length())
    }

    const raycaster = new THREE.Raycaster()
    ;(raycaster.params as any).Points = { threshold: 0.18 }
    ;(raycaster.params as any).Line = { threshold: 0.06 }
    const ndc = new THREE.Vector2()
    let downXY: [number, number] | null = null
    function setNdc(e: MouseEvent) {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
    }
    function pickCell(e: MouseEvent): number | null {
      setNdc(e)
      const vh = raycaster.intersectObjects(vertPoints, false)
      if (vh.length) {
        const ci = vertexCell.get(vh[0].object.userData.vi)
        if (ci != null) return ci
      }
      if (edgeLine && edgeCell.size) {
        const lh = raycaster.intersectObject(edgeLine, false)
        if (lh.length && lh[0].index != null) {
          const ci = edgeCell.get(ek(...((self.edges[Math.floor(lh[0].index / 2)] ?? []) as [number, number])))
          if (ci != null) return ci
        }
      }
      const fh2 = raycaster.intersectObjects(cellMeshes, false)
      if (fh2.length) return fh2[0].object.userData.cell
      const lh2 = raycaster.intersectObjects(
        labelObjs.map((l) => l.sprite),
        false,
      )
      if (lh2.length) return lh2[0].object.userData.cell
      return null
    }
    const onDown = (e: PointerEvent) => {
      downXY = [e.clientX, e.clientY]
      orientTarget = null
    }
    const onUp = (e: PointerEvent) => {
      if (!downXY) return
      const moved = Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1])
      downXY = null
      if (moved > 5) return
      const ci = pickCell(e)
      if (ci != null) self.dispatchEvent(new CustomEvent('select', { detail: ci }))
    }
    const onDbl = (e: MouseEvent) => {
      const ci = pickCell(e)
      if (ci == null) return
      self.dispatchEvent(new CustomEvent('select', { detail: ci }))
      aim(ci)
    }
    const onMove = (e: MouseEvent) => {
      const ci = pickCell(e)
      if (ci !== hoveredCell) {
        hoveredCell = ci
        buildHover(ci)
      }
      setNdc(e)
      hoveredDeco = decoMeshes.length ? raycaster.intersectObjects(decoMeshes, false)[0]?.object.userData.deco ?? null : null
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('dblclick', onDbl)
    renderer.domElement.addEventListener('pointermove', onMove)

    let raf = 0
    const camV = new THREE.Vector3()
    const render = () => {
      raf = requestAnimationFrame(render)
      if (orientTarget) {
        camera.position.lerp(orientTarget, 0.15)
        if (camera.position.distanceTo(orientTarget) < 0.02) orientTarget = null
      }
      controls.update()
      const fade = is3d
      camV.copy(camera.position).normalize()
      for (const l of labelObjs) {
        const active = l.ci === self.selected || l.ci === hoveredCell
        const sc = active ? 1.6 : 1
        l.sprite.scale.set(l.base.x * sc, l.base.y * sc, 1)
        const f = camV.x * l.dir[0] + camV.y * l.dir[1] + camV.z * l.dir[2]
        l.sprite.material.opacity = active ? 1 : fade ? (f > 0 ? 0.25 + 0.75 * f : 0.1) : 1
      }
      for (const m of decoMeshes) m.material.opacity = m.userData.deco === hoveredDeco ? 0.34 : 0.08
      renderer.render(scene, camera)
    }
    const onResize = () => {
      const w = el.clientWidth || 640,
        h = el.clientHeight || height,
        a = w / h
      camera.left = -fh * a
      camera.right = fh * a
      camera.top = fh
      camera.bottom = -fh
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(onResize)
    ro.observe(el)

    buildGeometry()
    render()
    self.rebuild = buildGeometry
    self.started = true
    self.cleanup = () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('dblclick', onDbl)
      renderer.domElement.removeEventListener('pointermove', onMove)
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      self.setSelection = null
      self.doReorient = null
      self.rebuild = () => {}
    }
  }

  render(): TemplateResult {
    return html`
      <div class="pv">
        <div class="canvas-host" style="height:${this.height}px"></div>
        <div class="overlay">
          <button class="vbtn" @click=${this.reorient} title="reorient — center the selection / view head-on">⌖</button>
          <fullscreen-button></fullscreen-button>
        </div>
      </div>
    `
  }

  static styles = css`
    :host {
      display: block;
    }
    .pv {
      position: relative;
    }
    .canvas-host {
      width: 100%;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      border-radius: 6px;
      overflow: hidden;
      resize: vertical;
      min-height: 240px;
    }
    .overlay {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      display: flex;
      gap: 0.35rem;
    }
    /* fullscreen (issue #162): the host element goes fullscreen — make its panel + canvas fill the screen */
    :host(:fullscreen) {
      background: var(--enumeratio-bg, var(--p-content-background, #fff));
    }
    :host(:fullscreen) .pv,
    :host(:fullscreen) .canvas-host {
      height: 100% !important;
    }
    .vbtn {
      width: 1.9rem;
      height: 1.9rem;
      padding: 0;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      border-radius: 4px;
      background: var(--p-content-hover-background, transparent);
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
      font-size: 1rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .vbtn:hover {
      color: var(--enumeratio-text, var(--p-text-color, currentColor));
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'polytope-figure': PolytopeFigure
  }
}
