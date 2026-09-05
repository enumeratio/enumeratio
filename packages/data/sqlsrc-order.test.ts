import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { orderPacks, orderSqlsrc, type Pack, type SqlFile } from './sqlsrc-order'

const dir = join(import.meta.dirname, 'sqlsrc')
const realFiles: SqlFile[] = readdirSync(dir).filter(f => f.endsWith('.sql'))
  .map(f => ({ name: f.replace(/\.sql$/, ''), content: readFileSync(join(dir, f), 'utf8') }))

function file(name: string, content: string): SqlFile {
  return { name, content }
}

describe('orderPacks ≡ orderSqlsrc on the real catalog', () => {
  it('orderPacks(core, []) yields the same name sequence as orderSqlsrc(sqlsrc/*) — byte-for-byte', () => {
    const core: Pack = { name: 'core', requiresPack: [], files: realFiles }
    const viaPacks = orderPacks(core, []).map(f => f.name)
    const viaSqlsrc = orderSqlsrc(realFiles).map(f => f.name)
    expect(viaPacks).toEqual(viaSqlsrc)
  })
})

describe('orderPacks — synthetic packs', () => {
  it('toposorts the pack graph by requiresPack (stable, lexical tie-break)', () => {
    const core: Pack = { name: 'core', requiresPack: [], files: [file('bootstrap', '-- seed')] }
    // 'z' requires 'a'; 'b' requires nothing — so 'a'/'b' are both ready first (lexical tie-break), then 'z'.
    const a: Pack = { name: 'a', requiresPack: [], files: [file('a1', '-- requires: bootstrap')] }
    const b: Pack = { name: 'b', requiresPack: [], files: [file('b1', '-- requires: bootstrap')] }
    const z: Pack = { name: 'z', requiresPack: ['a'], files: [file('z1', '-- requires: bootstrap, a1')] }
    const out = orderPacks(core, [z, b, a]).map(f => f.name)
    expect(out).toEqual(['bootstrap', 'a1', 'b1', 'z1'])
  })

  it('throws naming the packs involved in a pack cycle', () => {
    const core: Pack = { name: 'core', requiresPack: [], files: [] }
    const p: Pack = { name: 'p', requiresPack: ['q'], files: [] }
    const q: Pack = { name: 'q', requiresPack: ['p'], files: [] }
    expect(() => orderPacks(core, [p, q])).toThrowError(/pack dependency cycle among:.*p.*q|pack dependency cycle among:.*q.*p/)
  })

  it('`requires: x` satisfied by an external contributes no edge and does not throw', () => {
    const core: Pack = { name: 'core', requiresPack: [], files: [file('bootstrap', '-- seed')] }
    const numberSets: Pack = {
      name: 'number-sets',
      requiresPack: ['core'],
      files: [file('motzkin_numbers', '-- requires: bootstrap')],
    }
    const paths: Pack = {
      name: 'paths',
      requiresPack: ['core', 'number-sets'],
      files: [file('motzkin_paths', '-- requires: bootstrap, motzkin_numbers')],
    }
    const out = orderPacks(core, [numberSets, paths]).map(f => f.name)
    expect(out).toEqual(['bootstrap', 'motzkin_numbers', 'motzkin_paths'])
  })

  it('names the owning pack when the required file exists in a pack outside the closure', () => {
    const core: Pack = { name: 'core', requiresPack: [], files: [file('bootstrap', '-- seed')] }
    const numberSets: Pack = {
      name: 'number-sets',
      requiresPack: ['core'],
      files: [file('motzkin_numbers', '-- requires: bootstrap')],
    }
    // 'paths' does NOT declare `requires-pack: number-sets` — motzkin_numbers is outside its closure.
    const paths: Pack = {
      name: 'paths',
      requiresPack: ['core'],
      files: [file('motzkin_paths', '-- requires: bootstrap, motzkin_numbers')],
    }
    expect(() => orderPacks(core, [numberSets, paths])).toThrowError(
      'pack "paths" requires "motzkin_numbers" owned by pack "number-sets" — declare `requires-pack: number-sets`',
    )
  })

  it('falls back to "requires unknown" wording when no pack owns the file at all', () => {
    const core: Pack = { name: 'core', requiresPack: [], files: [file('bootstrap', '-- seed')] }
    const paths: Pack = {
      name: 'paths',
      requiresPack: ['core'],
      files: [file('motzkin_paths', '-- requires: bootstrap, nonexistent_thing')],
    }
    expect(() => orderPacks(core, [paths])).toThrowError('sqlsrc "motzkin_paths" requires unknown "nonexistent_thing"')
  })

  it('`requires-tag` expands only over the pack\'s OWN files, never across the pack boundary', () => {
    const core: Pack = {
      name: 'core',
      requiresPack: [],
      files: [file('bootstrap', '-- seed'), file('core_thing', '-- provides: widget')],
    }
    // pack 'p' has its own 'widget' provider plus an anchor requiring the tag — it should see ONLY its own
    // provider, not core's, even though core is always in its externals.
    const p: Pack = {
      name: 'p',
      requiresPack: ['core'],
      files: [
        file('p_thing', '-- requires: bootstrap\n-- provides: widget'),
        file('p_anchor', '-- requires-tag: widget'),
      ],
    }
    const out = orderPacks(core, [p]).map(f => f.name)
    // p_anchor must come after p_thing (its own provider) — and the ordering must succeed without needing an
    // edge back to core_thing (which also provides 'widget' but sits outside the pack).
    expect(out.indexOf('p_anchor')).toBeGreaterThan(out.indexOf('p_thing'))
    expect(out).toEqual(['bootstrap', 'core_thing', 'p_thing', 'p_anchor'])
  })
})
