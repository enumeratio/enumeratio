// Build-time data loader for the identity registry (base_function, issue #282; base_function_impl join table
// #278 increment 2). Three independent extraction paths merged: curated base_function/base_function_impl rows,
// pg_proc introspection per pg impl row, and a TypeScript-compiler-API walk of packages/math/src/*.ts per ts
// impl row. Regex extraction was ruled out during design — the "SQL twin: ..." doc-comment convention there has
// at least 4 inconsistent shapes.
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

// One base_function_impl row, its introspected/extracted detail merged in. pg-only fields (argTypes/returnType/
// signature/ret/variadic) and ts-only fields (file/comment) are null on the other engine's rows rather than
// split into two interfaces — functions.md loops `impls` uniformly and only reads the fields present.
export interface ImplRow {
  engine: string
  implRef: string
  argTypes: string[]
  returnType: string
  representation: string
  note: string | null
  signature: string | null   // pg only: `${implRef}(${args})`
  ret: string | null         // pg only: pg_get_function_result
  variadic: boolean          // pg only
  body: string | null        // pg: pg_get_functiondef; ts: the export's source text
  file: string | null        // ts only: which packages/math/src/*.ts file
  comment: string | null     // ts only: the export's leading comment, if any
}

export interface FunctionRow {
  id: string
  title: string | null
  description: string
  impls: ImplRow[]
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
  watch: ['../packages/data/sqlsrc/identities.sql', '../packages/data/sqlsrc/function_impls.sql', '../packages/math/src/*.ts', '../packages/data/packs/polytopes/identities.polytopes.sql'],
  async load(): Promise<FunctionsData> {
    const pg = await bootCore()
    const q = async (sql: string) => (await pg.query(sql)).rows as any[]

    const funcs = await q(`SELECT id, title, description FROM base_function ORDER BY id`)
    const implRows = await q(`
      SELECT function, engine, impl_ref, arg_types, return_type, representation, note
        FROM base_function_impl ORDER BY function, engine, impl_ref`)
    // `polytope` is a LEFT JOIN, not a column on base_function_attribute (#283 phase 2.2): the correspondence
    // targets packs/polytopes collections, so it's populated from that pack's own row
    // (packs/polytopes/identities.polytopes.sql) — absent entirely when the pack isn't in the loaded profile.
    const attributeDefs = await q(
      `SELECT a.id, a.title, a.description, p.collection AS polytope FROM base_function_attribute a
         LEFT JOIN base_function_attribute_polytope p ON p.attribute = a.id ORDER BY a.id`,
    )
    const attrRows = await q(`
      SELECT m.function, a.id, a.title, p.collection AS polytope FROM base_function_attribute_manual m
        JOIN base_function_attribute a ON a.id = m.attribute
        LEFT JOIN base_function_attribute_polytope p ON p.attribute = a.id`)
    const refRows = await q(`
      SELECT subject AS function, system, identity, url, delta, relation FROM base_reference
       WHERE subject_kind = 'function'`)

    // pg_proc introspection per pg impl row — same pg_get_function_arguments/pg_get_function_result pattern
    // api.data.ts already uses; provariadic <> 0 is the mechanical is-variadic test (confirmed live against
    // pglite during design); pg_get_functiondef is a new call for this repo but standard Postgres — it's how
    // the full SQL body gets onto the page. Keyed by (function, engine, impl_ref), the row's own primary key,
    // not bare impl_ref — a name collision across two functions would otherwise silently merge their metadata.
    const sqlMeta = new Map<string, { args: string; ret: string; variadic: boolean; def: string }>()
    for (const i of implRows) {
      if (i.engine !== 'pg') continue
      const key = `${i.function}|${i.engine}|${i.impl_ref}`
      const rows = await q(
        `SELECT pg_get_function_arguments(p.oid) args, pg_get_function_result(p.oid) ret,
                p.provariadic <> 0 AS variadic, pg_get_functiondef(p.oid) def
           FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
          WHERE ns.nspname = 'public' AND p.proname = '${i.impl_ref}'
          ORDER BY length(pg_get_function_arguments(p.oid)) LIMIT 1`,
      )
      if (!rows.length) throw new Error(`functions.data.ts: base_function '${i.function}' names a pg impl_ref '${i.impl_ref}', but no such function exists in pg_proc`)
      sqlMeta.set(key, rows[0])
    }
    await pg.close()

    const tsExports = extractTsExports()
    for (const i of implRows) {
      if (i.engine === 'ts' && !tsExports.has(i.impl_ref)) {
        throw new Error(`functions.data.ts: base_function '${i.function}' names a ts impl_ref '${i.impl_ref}', but no such export was found in packages/math/src/*.ts`)
      }
    }

    const rows: FunctionRow[] = funcs.map((f) => {
      const impls: ImplRow[] = implRows
        .filter((i) => i.function === f.id)
        .map((i): ImplRow => {
          if (i.engine === 'pg') {
            const meta = sqlMeta.get(`${i.function}|${i.engine}|${i.impl_ref}`)
            return {
              engine: i.engine,
              implRef: i.impl_ref,
              argTypes: i.arg_types,
              returnType: i.return_type,
              representation: i.representation,
              note: i.note,
              signature: meta ? `${i.impl_ref}(${meta.args})` : null,
              ret: meta?.ret ?? null,
              variadic: meta?.variadic ?? false,
              body: meta?.def ?? null,
              file: null,
              comment: null,
            }
          }
          const tsInfo = tsExports.get(i.impl_ref)
          return {
            engine: i.engine,
            implRef: i.impl_ref,
            argTypes: i.arg_types,
            returnType: i.return_type,
            representation: i.representation,
            note: i.note,
            signature: null,
            ret: null,
            variadic: false,
            body: tsInfo?.body ?? null,
            file: tsInfo?.file ?? null,
            comment: tsInfo?.comment ?? null,
          }
        })
      return {
        id: f.id,
        title: f.title,
        description: f.description,
        impls,
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
