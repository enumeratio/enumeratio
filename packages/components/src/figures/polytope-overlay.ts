import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'

type Layer = {
  id: string
  label: string
  color: number
  vertices: number[][]
  edges: [number, number][]
  faces?: number[][]
  labels?: string[]
  visible: boolean
  showLabels?: boolean
}

// <polytope-overlay> — the Lit port of PolytopeOverlay.vue. Several polytopes overlaid in ONE shared coordinate
// space, each a coloured wireframe (+ faint hull-face fills + optional per-vertex labels). A single union-based
// projection keeps every layer aligned. Data goes in as the `.layers` property. Used by the explorer's projective
// view. three.js logic unchanged from the Vue original.
@customElement('polytope-overlay')
export class PolytopeOverlay extends LitElement {
  @property({ attribute: false }) layers: Layer[] = []
  @property({ type: Number }) height = 480
  @property({ type: Number }) scale = 2.4

  @query('.canvas-host') private hostEl!: HTMLDivElement

  private cleanup: () => void = () => {}
  private rebuild: () => void = () => {}
  private doReset: (() => void) | null = null
  private started = false

  reset(): void {
    this.doReset?.()
  }

  firstUpdated(): void {
    void this.init()
  }

  updated(changed: Map<string, unknown>): void {
    if (this.started && (changed.has('layers') || changed.has('scale'))) this.rebuild()
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
        const dp = u.reduce((s, x, i) => s + x * b[i], 0)
        u = u.map((x, i) => x - dp * b[i])
      }
      const norm = Math.hypot(...u)
      if (norm > 1e-9) basis.push(u.map((x) => x / norm))
      if (basis.length === 3) break
    }
    return basis
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
    const defaultPos = new THREE.Vector3(4, 3, 4.3)
    camera.position.copy(defaultPos)
    camera.lookAt(0, 0, 0)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    el.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false

    let group = new THREE.Group()
    scene.add(group)
    const layerGroups = new Map<string, { g: any; labels: any }>()

    const v3 = {
      sub: (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
      cross: (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
      dot: (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
      unit: (a: number[]) => {
        const m = Math.hypot(...a) || 1
        return [a[0] / m, a[1] / m, a[2] / m]
      },
    }
    function orderFace(idxs: number[], pts: number[][]): number[] {
      const c = [0, 1, 2].map((t) => idxs.reduce((s, i) => s + pts[i][t], 0) / idxs.length)
      const u = v3.unit(v3.sub(pts[idxs[0]], c))
      let nrm = [0, 0, 1]
      for (let k = 1; k < idxs.length; k++) {
        const cr = v3.cross(u, v3.unit(v3.sub(pts[idxs[k]], c)))
        if (Math.hypot(...cr) > 1e-6) {
          nrm = v3.unit(cr)
          break
        }
      }
      const w = v3.cross(nrm, u)
      return [...idxs].sort(
        (a, b) =>
          Math.atan2(v3.dot(v3.sub(pts[a], c), w), v3.dot(v3.sub(pts[a], c), u)) -
          Math.atan2(v3.dot(v3.sub(pts[b], c), w), v3.dot(v3.sub(pts[b], c), u)),
      )
    }
    function hullFaces(pts: number[][]): number[][] {
      const n = pts.length
      if (n < 3) return []
      const faces = new Map<string, number[]>()
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++)
          for (let k = j + 1; k < n; k++) {
            const nrm = v3.cross(v3.sub(pts[j], pts[i]), v3.sub(pts[k], pts[i]))
            const mag = Math.hypot(...nrm)
            if (mag < 1e-6) continue
            let pos = false,
              neg = false
            const on: number[] = []
            for (let l = 0; l < n; l++) {
              const dd = v3.dot(nrm, v3.sub(pts[l], pts[i])) / mag
              if (dd > 1e-3) pos = true
              else if (dd < -1e-3) neg = true
              else on.push(l)
            }
            if (pos && neg) continue
            const key = on.slice().sort((a, b) => a - b).join(',')
            if (on.length >= 3 && !faces.has(key)) faces.set(key, orderFace(on, pts))
          }
      return [...faces.values()]
    }

    function projector() {
      const all = self.layers.flatMap((l) => l.vertices)
      if (!all.length) return () => [0, 0, 0]
      const dlen = all[0].length
      const mean = Array.from({ length: dlen }, (_, j) => all.reduce((s, v) => s + v[j], 0) / all.length)
      const basis = self.gramSchmidt(all.map((v) => v.map((x, j) => x - mean[j])))
      return (v: number[]) => {
        const c = v.map((x, j) => x - mean[j])
        const p = [0, 0, 0]
        basis.forEach((b, k) => (p[k] = c.reduce((s, x, i) => s + x * b[i], 0) * self.scale))
        return p
      }
    }
    const centroid = (pts: number[][], idxs: number[]) => [0, 1, 2].map((k) => idxs.reduce((s, i) => s + pts[i][k], 0) / idxs.length)
    function faceMesh(pts: number[][], idxs: number[], color: number, opacity: number) {
      const c = centroid(pts, idxs)
      const pos: number[] = []
      for (let k = 0; k < idxs.length; k++) pos.push(...c, ...pts[idxs[k]], ...pts[idxs[(k + 1) % idxs.length]])
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.computeVertexNormals()
      return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }))
    }
    function makeLabel(text: string, color: number) {
      const w = Math.max(80, 15 * text.length),
        canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = 40
      const ctx = canvas.getContext('2d')!
      ctx.font = 'bold 20px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 6
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.strokeText(text, w / 2, 22)
      ctx.fillStyle = '#' + color.toString(16).padStart(6, '0')
      ctx.fillText(text, w / 2, 22)
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }))
      s.scale.set((w / 40) * 0.13, 0.13, 1)
      return s
    }
    function disposeGroup(g: any) {
      g.traverse((c: any) => {
        c.geometry?.dispose?.()
        c.material?.dispose?.()
      })
    }

    function build() {
      scene.remove(group)
      disposeGroup(group)
      group = new THREE.Group()
      scene.add(group)
      layerGroups.clear()
      const proj = projector()
      for (const layer of self.layers) {
        const g = new THREE.Group()
        const pts = layer.vertices.map(proj)
        for (const f of hullFaces(pts)) if (f.length >= 3) g.add(faceMesh(pts, f, layer.color, 0.18))
        const ep: number[] = []
        for (const [i, j] of layer.edges) if (pts[i] && pts[j]) ep.push(...pts[i], ...pts[j])
        const eg = new THREE.BufferGeometry()
        eg.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3))
        g.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: layer.color, transparent: true, opacity: 0.85 })))
        const vg = new THREE.BufferGeometry()
        vg.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3))
        g.add(new THREE.Points(vg, new THREE.PointsMaterial({ color: layer.color, size: 0.16, sizeAttenuation: true })))
        g.visible = layer.visible
        const labelG = new THREE.Group()
        ;(layer.labels ?? []).forEach((t, i) => {
          if (pts[i] && t) {
            const s = makeLabel(t, layer.color)
            s.position.set(pts[i][0], pts[i][1] + 0.12, pts[i][2])
            labelG.add(s)
          }
        })
        labelG.visible = !!layer.visible && !!layer.showLabels
        group.add(g)
        group.add(labelG)
        layerGroups.set(layer.id, { g, labels: labelG })
      }
    }
    self.doReset = () => {
      camera.position.copy(defaultPos)
      controls.update()
    }

    let raf = 0
    const render = () => {
      raf = requestAnimationFrame(render)
      controls.update()
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

    build()
    render()
    self.rebuild = build
    self.started = true
    self.cleanup = () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      self.doReset = null
      self.rebuild = () => {}
    }
  }

  render(): TemplateResult {
    return html`
      <div class="pv">
        <div class="canvas-host" style="height:${this.height}px"></div>
        <div class="overlay">
          <button class="vbtn" @click=${this.reset} title="reset view">⌖</button>
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
      min-height: 260px;
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
    'polytope-overlay': PolytopeOverlay
  }
}
