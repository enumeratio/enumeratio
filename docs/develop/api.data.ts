// Build-time data loader for the API reference. Boots the pure-SQL core in PGlite (in the VitePress build's node
// context, the same way the core-dump vite plugin does) and INTROSPECTS the live schema — function signatures,
// operators, catalog inventories, counts. The reference page renders these facts, so the surface it documents
// stays honest against the schema: add a collection or a stat and the numbers/inventories move on the next build.
//
// The prose on the page is hand-authored: the generated functions carry no COMMENT ON yet, so there is nothing to
// generate descriptions FROM. Once `COMMENT ON FUNCTION` is populated in sqlsrc, the per-entry descriptions here
// could be sourced from pg_description too — see the "Generating this page" note on the page.
import { sharedCore } from '@enumeratio/data/node'

export interface Sig {
  name: string
  signature: string // representative concrete signature (substituted over the `permutations` collection where it applies)
  ret: string
  overloads: number
}
export interface CtorExample {
  collection: string
  forms: string[]
  grades: string[] // grade axis names, in bind order (→ positional args g1, g2, …)
}
export interface ApiData {
  counts: Record<string, number>
  representative: string // the collection the concrete signatures are shown over
  surface: Sig[]
  operators: { name: string; count: number }[]
  types: { name: string; note: string }[]
  gradeNames: string[]
  stats: string[]
  maps: string[]
  media: string[]
  ctorExamples: CtorExample[]
}

// The uniform generated surface, in reading order. Signatures are pulled live; this list only fixes WHICH functions
// the reference features (the realizer emits more — internal wiring helpers — that a user never calls directly).
const SURFACE = [
  'cardinality', 'elements', 'unrank', 'element_at', 'fiber_unrank',
  'contains', 'member_of', 'render', 'notation', 'set_notation',
  'ordinality', 'omega_ordinality', 'next', 'prev', 'next_in_fiber', 'prev_in_fiber',
  'fibers', 'fiber_count', 'fiber_address', 'address', 'range', 'unfold',
  'unnest', 'carriers', 'random_element', 'fiber_symbol', 'glyph_svg',
]

const TYPE_NOTES: Record<string, string> = {
  natural_number: 'a non-negative integer; the usual grade/index domain',
  rank_index: 'a 0-based position within a collection (bigint-backed)',
  rank_index_range: "an element's rank slot — a point [r,r] for a located element, a span for a range",
  cardinal: 'a count that is ∞-aware — cardinality of an unbounded collection is Infinity',
  omega_ordinal: 'a transfinite address in Cantor normal form (e.g. ω·4 + 2)',
  term_index: 'a 0-based position within a single carrier value',
}

export default {
  watch: ['../packages/data/sqlsrc/*.sql'],
  async load(): Promise<ApiData> {
    const pg = await sharedCore()
    const q = async (sql: string) => (await pg.query(sql)).rows as any[]

    const one = async (sql: string) => Number((await q(sql))[0].c)
    const counts: Record<string, number> = {
      collections: await one('SELECT count(*) c FROM base_collection'),
      stats: await one('SELECT count(DISTINCT stat_id) c FROM base_stat'),
      maps: await one('SELECT count(DISTINCT map_id) c FROM base_map'),
      representations: await one('SELECT count(*) c FROM base_repr'),
      examples: await one('SELECT count(*) c FROM base_example'),
      functions: await one(
        `SELECT count(DISTINCT proname) c FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace WHERE ns.nspname = 'public'`,
      ),
    }

    const representative = 'permutations'
    const surface: Sig[] = []
    for (const name of SURFACE) {
      const rows = await q(
        `SELECT pg_get_function_arguments(p.oid) a, pg_get_function_result(p.oid) r
           FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
          WHERE ns.nspname = 'public' AND p.proname = '${name}'
          ORDER BY (pg_get_function_arguments(p.oid) LIKE '%${representative}%') DESC,
                   length(pg_get_function_arguments(p.oid))`,
      )
      if (!rows.length) continue
      const pick = rows.find((x: any) => new RegExp(representative).test(x.a)) ?? rows[0]
      surface.push({ name, signature: `${name}(${pick.a})`, ret: pick.r, overloads: rows.length })
    }

    const operators = (
      await q(
        `SELECT oprname n, count(*) c FROM pg_operator o JOIN pg_namespace ns ON ns.oid = o.oprnamespace
          WHERE ns.nspname = 'public' AND oprname IN ('<@', '@>') GROUP BY oprname ORDER BY oprname`,
      )
    ).map((r: any) => ({ name: r.n, count: Number(r.c) }))

    const gradeNames = (await q('SELECT DISTINCT name FROM base_grade ORDER BY name')).map((r: any) => r.name)
    const stats = (await q('SELECT DISTINCT stat_id FROM base_stat ORDER BY stat_id')).map((r: any) => r.stat_id)
    const maps = (await q('SELECT DISTINCT map_id FROM base_map ORDER BY map_id')).map((r: any) => r.map_id)
    const media = (await q('SELECT DISTINCT repr FROM base_repr ORDER BY repr')).map((r: any) => r.repr)

    const ctorExamples: CtorExample[] = []
    for (const collection of ['permutations', 'set_partitions', 'compositions_into_k_parts', 'natural_numbers']) {
      const forms = (
        await q(
          `SELECT '${collection}(' || pg_get_function_arguments(p.oid) || ')' f
             FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
            WHERE ns.nspname = 'public' AND p.proname = '${collection}' ORDER BY p.pronargs`,
        )
      ).map((r: any) => r.f)
      const grades = (
        await q(`SELECT name FROM base_grade WHERE collection = '${collection}' ORDER BY pos`)
      ).map((r: any) => r.name)
      ctorExamples.push({ collection, forms, grades })
    }

    const types = Object.entries(TYPE_NOTES).map(([name, note]) => ({ name, note }))

    // pg is shared across data loaders (sharedCore) — never closed here
    return { counts, representative, surface, operators, types, gradeNames, stats, maps, media, ctorExamples }
  },
}
