// Line dependency graph for a notebook where line ORDER (insertion/display order) does not matter — only the
// symbol dependencies between lines do. Built over `ast.ts` (`Parsed`, `Stmt`, `freeSymbols`) and the
// `ExpressionParser` from `ce/latex.ts`; does not touch compute-engine directly. Recomputes the whole graph on
// every `set`/`remove` rather than incrementally — N (lines in a notebook) is tiny, so this stays simple and pure.
import type { Parsed } from './ast.js'
import { freeSymbols } from './ast.js'
import type { ExpressionParser } from './ce/latex.js'

export type LineId = string

export type LineModel = {
  id: LineId
  latex: string
  parsed?: Parsed
  /** The symbol this line's `declare`/`define` binds — `undefined` for a plain `expr` line. */
  defines?: string
  /** Which half of a binding this line is. A symbol may have ONE declare (`x \in C`, its type) and ONE define
   *  (`x = 10`, its value); the define depends on the declare. */
  bindKind?: 'declare' | 'define'
  /** Free symbols this line reads. */
  deps: Set<string>
  /** Human-readable diagnostics from graph analysis: 'x defined twice', 'cyclic dependency: x → y → x'.
   *  Does NOT include unresolved-symbol errors — the binder reports those, not the graph. */
  errors: string[]
}

type RawLine = { id: LineId; latex: string; parsed?: Parsed; defines?: string; bindKind?: 'declare' | 'define'; deps: Set<string> }

export class LineGraph {
  #raw = new Map<LineId, RawLine>()
  #computed = new Map<LineId, LineModel>()
  #order: LineId[] = []
  #definers = new Map<string, LineId>()
  #declarers = new Map<string, LineId>()
  #edgesIn = new Map<LineId, Set<LineId>>()

  /** (Re)parse `latex` for `id` and recompute the whole graph — `defines`/`deps` for a `define` exclude its own
   *  params; for a `declare` deps come from the domain expr's free symbols. */
  set(id: LineId, latex: string, parser: ExpressionParser): void {
    const parsed = parser.parse(latex)
    const { stmt } = parsed
    let defines: string | undefined
    let bindKind: RawLine['bindKind']
    let deps: Set<string>
    if (stmt.k === 'declare') {
      defines = stmt.name
      bindKind = 'declare'
      deps = freeSymbols(stmt.domain)
    } else if (stmt.k === 'define') {
      defines = stmt.name
      bindKind = 'define'
      const params = new Set(stmt.params ?? [])
      deps = new Set([...freeSymbols(stmt.body)].filter((s) => !params.has(s)))
    } else {
      deps = freeSymbols(stmt.body)
    }
    this.#raw.set(id, { id, latex, parsed, defines, bindKind, deps })
    this.#recompute()
  }

  remove(id: LineId): void {
    this.#raw.delete(id)
    this.#recompute()
  }

  /** Topological order over symbol edges: line A orders after line B iff a dep of A is `defines` of B.
   *  A duplicate definer or a line caught in a cycle still appears here (appended at the end, insertion order)
   *  but contributes/receives no ordering edges — see `#recompute`. */
  order(): LineId[] {
    return [...this.#order]
  }

  /** Transitive dependents of `id`, including `id` itself, in topo order. */
  dirtyAfter(id: LineId): Set<LineId> {
    const reached = new Set<LineId>()
    const stack: LineId[] = [id]
    while (stack.length > 0) {
      const cur = stack.pop() as LineId
      if (reached.has(cur)) continue
      reached.add(cur)
      for (const dependent of this.#edgesIn.get(cur) ?? []) stack.push(dependent)
    }
    return new Set(this.#order.filter((x) => reached.has(x)))
  }

  /** Symbol name -> the line that supplies its VALUE (the define, else the declare); duplicates omitted. */
  definers(): Map<string, LineId> {
    return new Map(this.#definers)
  }
  /** Symbol name -> the line that DECLARES its type (`x \in C`), when there is one. */
  declarers(): Map<string, LineId> {
    return new Map(this.#declarers)
  }

  lines(): LineModel[] {
    return [...this.#computed.values()]
  }

  #recompute(): void {
    const insertionOrder = [...this.#raw.keys()]

    // 1. per symbol: its declare line and its define line. Two of the SAME kind is the duplicate error; a
    // declare + a define is the normal pair (`x \in C` then `x = 10`).
    const byName = new Map<string, { declares: LineId[]; defines: LineId[] }>()
    for (const raw of this.#raw.values()) {
      if (raw.defines === undefined) continue
      const slot = byName.get(raw.defines) ?? { declares: [], defines: [] }
      ;(raw.bindKind === 'declare' ? slot.declares : slot.defines).push(raw.id)
      byName.set(raw.defines, slot)
    }
    const errorsById = new Map<LineId, string[]>()
    const addError = (id: LineId, msg: string) => {
      const arr = errorsById.get(id) ?? []
      arr.push(msg)
      errorsById.set(id, arr)
    }
    const declarer = new Map<string, LineId>()
    const definer = new Map<string, LineId>()
    for (const [name, { declares, defines }] of byName) {
      if (declares.length > 1) for (const id of declares) addError(id, `${name} declared twice`)
      else if (declares.length === 1) declarer.set(name, declares[0])
      if (defines.length > 1) for (const id of defines) addError(id, `${name} defined twice`)
      else if (defines.length === 1) definer.set(name, defines[0])
    }
    /** the line(s) a reader of `name` must wait for: its declare AND its define */
    const suppliers = (name: string): LineId[] => [declarer.get(name), definer.get(name)].filter((x): x is LineId => x !== undefined)

    // 2. edges: dependent -> supplier, plus define -> declare of the same symbol.
    const edgesOut = new Map<LineId, Set<LineId>>()
    const edgesIn = new Map<LineId, Set<LineId>>()
    for (const id of insertionOrder) {
      edgesOut.set(id, new Set())
      edgesIn.set(id, new Set())
    }
    const link = (from: LineId, to: LineId) => { if (from !== to) { edgesOut.get(from)!.add(to); edgesIn.get(to)!.add(from) } }
    for (const raw of this.#raw.values()) {
      for (const dep of raw.deps) for (const sup of suppliers(dep)) link(raw.id, sup)
      if (raw.bindKind === 'define' && raw.defines !== undefined) {
        const decl = declarer.get(raw.defines)
        if (decl !== undefined) link(raw.id, decl)
      }
    }

    // 3. cycle detection (Tarjan SCC) — every line in a nontrivial SCC (or a self-loop) gets a cyclic-dependency
    // error and is excluded from the topo sort below.
    const cycleMembers = new Set<LineId>()
    {
      const index = new Map<LineId, number>()
      const lowlink = new Map<LineId, number>()
      const onStack = new Set<LineId>()
      const stack: LineId[] = []
      let counter = 0
      const sccs: LineId[][] = []
      const strongconnect = (v: LineId) => {
        index.set(v, counter)
        lowlink.set(v, counter)
        counter++
        stack.push(v)
        onStack.add(v)
        for (const w of edgesOut.get(v) ?? []) {
          if (!index.has(w)) {
            strongconnect(w)
            lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!))
          } else if (onStack.has(w)) {
            lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!))
          }
        }
        if (lowlink.get(v) === index.get(v)) {
          const comp: LineId[] = []
          let w: LineId
          do {
            w = stack.pop() as LineId
            onStack.delete(w)
            comp.push(w)
          } while (w !== v)
          sccs.push(comp)
        }
      }
      for (const id of insertionOrder) if (!index.has(id)) strongconnect(id)

      for (const comp of sccs) {
        const isCycle = comp.length > 1 || edgesOut.get(comp[0])!.has(comp[0])
        if (!isCycle) continue
        for (const id of comp) cycleMembers.add(id)
        // Walk the cycle in dependency order, starting from the earliest-inserted member, to build a readable
        // "x → y → x" trail of the DEFINED symbol names along the loop.
        const start = insertionOrder.find((id) => comp.includes(id))!
        const path: LineId[] = []
        const seen = new Set<LineId>()
        let cur = start
        while (!seen.has(cur)) {
          seen.add(cur)
          path.push(cur)
          const next = [...(edgesOut.get(cur) ?? [])].find((n) => comp.includes(n))
          if (next === undefined) break
          cur = next
        }
        const names = path.map((id) => this.#raw.get(id)!.defines ?? '?')
        const msg = `cyclic dependency: ${[...names, names[0]].join(' → ')}`
        for (const id of comp) addError(id, msg)
      }
    }

    // 4. Kahn's topological sort over the non-cycle subgraph; ties broken by insertion order for determinism.
    const nonCycleIds = insertionOrder.filter((id) => !cycleMembers.has(id))
    const indegree = new Map<LineId, number>()
    for (const id of nonCycleIds) {
      let n = 0
      for (const dep of edgesOut.get(id) ?? []) if (!cycleMembers.has(dep)) n++
      indegree.set(id, n)
    }
    const remaining = new Set(nonCycleIds)
    const resultOrder: LineId[] = []
    while (remaining.size > 0) {
      const picked = insertionOrder.find((id) => remaining.has(id) && indegree.get(id) === 0)
      if (picked === undefined) {
        // Shouldn't happen (cycles were already excluded) — fail safe by dumping the rest in insertion order.
        for (const id of insertionOrder) if (remaining.has(id)) resultOrder.push(id)
        break
      }
      resultOrder.push(picked)
      remaining.delete(picked)
      for (const dependent of edgesIn.get(picked) ?? []) {
        if (remaining.has(dependent)) indegree.set(dependent, (indegree.get(dependent) ?? 0) - 1)
      }
    }
    for (const id of insertionOrder) if (cycleMembers.has(id)) resultOrder.push(id)

    // 5. materialize LineModels + published graph state.
    this.#computed = new Map()
    for (const id of insertionOrder) {
      const raw = this.#raw.get(id)!
      this.#computed.set(id, {
        id,
        latex: raw.latex,
        parsed: raw.parsed,
        defines: raw.defines,
        bindKind: raw.bindKind,
        deps: raw.deps,
        errors: errorsById.get(id) ?? [],
      })
    }
    this.#order = resultOrder
    this.#definers = new Map([...declarer, ...definer])   // a define wins over its declare as the value supplier
    this.#declarers = declarer
    this.#edgesIn = edgesIn
  }
}
