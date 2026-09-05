// Build-time data loader for the identity registry (base_function, issue #282). Two independent extraction
// paths merged by base_function.id: curated rows + pg_proc introspection (SQL-backed identities), and a
// TypeScript-compiler-API walk of packages/math/src/*.ts (TS-backed identities). Regex extraction was ruled out
// during design — the "SQL twin: ..." doc-comment convention there has at least 4 inconsistent shapes.
import { bootCore } from '@enumeratio/data/node'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// NOTE: this is a DIFFERENT base path than `watch` below. `watch` glob entries resolve relative to VitePress'
// srcDir (docs/) — see maps.data.ts's '../packages/data/sqlsrc/*.sql'. The runtime fs reads here resolve
// relative to THIS FILE's own location on disk instead, since readFileSync/readdirSync need a real filesystem
// path, not a build-tool-relative glob root. Mixing the two up silently reads/watches the wrong directory.
const mathSrcDir = join(dirname(fileURLToPath(import.meta.url)), '../../../packages/math/src')

export interface AttributeRef { id: string; title: string | null; polytope: string | null }
export interface CrossReference { system: string; identity: string; url: string | null; delta: string; relation: string }
export interface FunctionRow {
  id: string
  title: string | null
  description: string
  sqlFn: string | null
  sqlSignature: string | null
  sqlReturn: string | null
  sqlVariadic: boolean
  sqlBody: string | null
  tsExport: string | null
  tsFile: string | null
  tsComment: string | null
  tsBody: string | null
  attributes: AttributeRef[]
  references: CrossReference[]
}
export interface FunctionsData {
  count: number
  attributes: { id: string; title: string | null; description: string; polytope: string | null }[]
  rows: FunctionRow[]
}

interface TsExtracted { comment: string | null; body: string; file: string }

// Walks every packages/math/src/*.ts file (skipping index.ts, which only re-exports) with the TypeScript
// compiler API rather than regex, since the leading-comment convention on each export is inconsistent
// ("SQL twin: ...", "No bare SQL fn (generic dispatch)", "No SQL twin (...)", or free-form prose). Handles both
// `export function foo(...)` and `export const foo = (...) => ...` forms.
function extractTsExports(): Map<string, TsExtracted> {
  const out = new Map<string, TsExtracted>()
  const files = readdirSync(mathSrcDir).filter((f) => f.endsWith('.ts') && f !== 'index.ts')
  for (const file of files) {
    const path = join(mathSrcDir, file)
    const text = readFileSync(path, 'utf8')
    const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
    ts.forEachChild(sf, (node) => {
      let name: string | undefined
      if (ts.isFunctionDeclaration(node) && node.name && hasExportModifier(node)) {
        name = node.name.text
      } else if (ts.isVariableStatement(node) && hasExportModifier(node)) {
        const decl = node.declarationList.declarations[0]
        if (decl && ts.isIdentifier(decl.name) && decl.initializer) name = decl.name.text
      }
      if (!name) return
      const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []
      const last = ranges.at(-1)
      out.set(name, { comment: last ? text.slice(last.pos, last.end) : null, body: node.getText(sf), file })
    })
  }
  return out
}

function hasExportModifier(node: ts.Node): boolean {
  return !!(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
}

export default {
  watch: ['../packages/data/sqlsrc/identities.sql', '../packages/math/src/*.ts'],
  async load(): Promise<FunctionsData> {
    const pg = await bootCore()
    const q = async (sql: string) => (await pg.query(sql)).rows as any[]

    const funcs = await q(`SELECT id, title, description, sql_fn, ts_export FROM base_function ORDER BY id`)
    const attributeDefs = await q(
      `SELECT id, title, description, polytope FROM base_function_attribute ORDER BY id`,
    )
    const attrRows = await q(`
      SELECT m.function, a.id, a.title, a.polytope FROM base_function_attribute_manual m
        JOIN base_function_attribute a ON a.id = m.attribute`)
    const refRows = await q(`
      SELECT subject AS function, system, identity, url, delta, relation FROM base_reference
       WHERE subject_kind = 'function'`)

    // pg_proc introspection per SQL-backed identity — same pg_get_function_arguments/pg_get_function_result
    // pattern api.data.ts already uses; provariadic <> 0 is the mechanical is-variadic test (confirmed live
    // against pglite during design); pg_get_functiondef is a new call for this repo but standard Postgres —
    // it's how the full SQL body gets onto the page.
    const sqlMeta = new Map<string, { args: string; ret: string; variadic: boolean; def: string }>()
    for (const f of funcs) {
      if (!f.sql_fn) continue
      const rows = await q(
        `SELECT pg_get_function_arguments(p.oid) args, pg_get_function_result(p.oid) ret,
                p.provariadic <> 0 AS variadic, pg_get_functiondef(p.oid) def
           FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
          WHERE ns.nspname = 'public' AND p.proname = '${f.sql_fn}'
          ORDER BY length(pg_get_function_arguments(p.oid)) LIMIT 1`,
      )
      if (!rows.length) throw new Error(`functions.data.ts: base_function '${f.id}' names sql_fn '${f.sql_fn}', but no such function exists in pg_proc`)
      sqlMeta.set(f.id, rows[0])
    }
    await pg.close()

    const tsExports = extractTsExports()
    for (const f of funcs) {
      if (f.ts_export && !tsExports.has(f.ts_export)) {
        throw new Error(`functions.data.ts: base_function '${f.id}' names ts_export '${f.ts_export}', but no such export was found in packages/math/src/*.ts`)
      }
    }

    const rows: FunctionRow[] = funcs.map((f) => {
      const meta = sqlMeta.get(f.id)
      const tsInfo = f.ts_export ? tsExports.get(f.ts_export) : undefined
      return {
        id: f.id,
        title: f.title,
        description: f.description,
        sqlFn: f.sql_fn,
        sqlSignature: meta ? `${f.sql_fn}(${meta.args})` : null,
        sqlReturn: meta?.ret ?? null,
        sqlVariadic: meta?.variadic ?? false,
        sqlBody: meta?.def ?? null,
        tsExport: f.ts_export,
        tsFile: tsInfo?.file ?? null,
        tsComment: tsInfo?.comment ?? null,
        tsBody: tsInfo?.body ?? null,
        attributes: attrRows
          .filter((a) => a.function === f.id)
          .map(({ id, title, polytope }) => ({ id, title, polytope })),
        references: refRows.filter((r) => r.function === f.id),
      }
    })

    return {
      count: rows.length,
      attributes: attributeDefs.map((a) => ({ id: a.id, title: a.title, description: a.description, polytope: a.polytope })),
      rows,
    }
  },
}
