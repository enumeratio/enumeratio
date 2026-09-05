import { describe, expect, it } from 'vitest'
import { rowQueryFromSearch, searchFromRowQuery } from '@enumeratio/client'
import { parseRoute, routeFor, resolveCollectionAlias, type ParsedRoute } from './route'

function loc(pathname: string, search = '') {
  return { pathname, search }
}

describe('parseRoute / routeFor (#39: fiber-binding lives in the PATH)', () => {
  it('round-trips a bare collection URL with no element, unchanged', () => {
    const url = '/explore/collection/subsets'
    const parsed = parseRoute(loc(url))
    expect(parsed.address).toEqual({ collection: 'subsets', fiberBinding: { n: null, axes: {} }, element: null })
    expect(routeFor(parsed)).toBe(url)
  })

  it('round-trips collection + element, unchanged', () => {
    const url = '/explore/collection/subsets/1%2C2%2C3'
    const parsed = parseRoute(loc(url))
    expect(parsed.address.element).toBe('1,2,3')
    expect(routeFor(parsed)).toBe(url)
  })

  it('encodes a bound n as a matrix param on the collection segment', () => {
    const route: ParsedRoute = {
      address: { collection: 'k_subsets', fiberBinding: { n: 4, axes: {} }, element: null },
      viewQuery: {},
    }
    const url = routeFor(route)
    expect(url).toBe('/explore/collection/k_subsets;n=4')
    expect(parseRoute(loc(url)).address.fiberBinding).toEqual({ n: 4, axes: {} })
  })

  it('encodes n + secondary axes together, in binding order', () => {
    const route: ParsedRoute = {
      address: { collection: 'k_subsets', fiberBinding: { n: 5, axes: { k: 2 } }, element: null },
      viewQuery: {},
    }
    const url = routeFor(route)
    expect(url).toBe('/explore/collection/k_subsets;n=5;k=2')
    expect(parseRoute(loc(url)).address.fiberBinding).toEqual({ n: 5, axes: { k: 2 } })
  })

  it('carries matrix params through to the element segment', () => {
    const route: ParsedRoute = {
      address: { collection: 'k_subsets', fiberBinding: { n: 5, axes: { k: 2 } }, element: '1,3' },
      viewQuery: {},
    }
    const url = routeFor(route)
    expect(url).toBe('/explore/collection/k_subsets;n=5;k=2/1%2C3')
    const parsed = parseRoute(loc(url))
    expect(parsed.address).toEqual({ collection: 'k_subsets', fiberBinding: { n: 5, axes: { k: 2 } }, element: '1,3' })
  })

  it('supports an axis binding with no n (unbound primary, bound secondary)', () => {
    const route: ParsedRoute = {
      address: { collection: 'k_subsets', fiberBinding: { n: null, axes: { k: 3 } }, element: null },
      viewQuery: {},
    }
    const url = routeFor(route)
    expect(url).toBe('/explore/collection/k_subsets;k=3')
    expect(parseRoute(loc(url)).address.fiberBinding).toEqual({ n: null, axes: { k: 3 } })
  })

  it('keeps view-config (query string) independent of the path params', () => {
    const route: ParsedRoute = {
      address: { collection: 'k_subsets', fiberBinding: { n: 4, axes: { k: 2 } }, element: null },
      viewQuery: { repr: 'lehmer', orderBy: 'rank' },
    }
    const url = routeFor(route)
    expect(url).toBe('/explore/collection/k_subsets;n=4;k=2?repr=lehmer&order_by=rank')
    const parsed = parseRoute(loc('/explore/collection/k_subsets;n=4;k=2', '?repr=lehmer&order_by=rank'))
    expect(parsed.address.fiberBinding).toEqual({ n: 4, axes: { k: 2 } })
    expect(parsed.viewQuery).toEqual({ repr: 'lehmer', groupBy: undefined, maps: undefined, select: undefined, where: undefined, having: undefined, orderBy: 'rank', ord: undefined })
  })

  it('drops an empty-string param value (matches the query-string convention of dropping empty values)', () => {
    const parsed = parseRoute(loc('/explore/collection/k_subsets;n=;k=2'))
    expect(parsed.address.fiberBinding).toEqual({ n: null, axes: { k: 2 } })
  })

  it('round-trips a bare collection root (no collection chosen)', () => {
    const url = '/explore/collection'
    const parsed = parseRoute(loc(url))
    expect(parsed.address.collection).toBeNull()
    // routeFor's canonicalization of a null collection is pre-existing behavior, unaffected by #39
    expect(routeFor(parsed)).toBe('/explore/collection/collections')
  })
})

describe('resolveCollectionAlias (#101: the shared-tower alias mechanism)', () => {
  it('rewrites an aliased id to its canonical id', () => {
    expect(resolveCollectionAlias('power_set', { power_set: 'subsets' })).toBe('subsets')
  })

  it('passes an unaliased id through unchanged', () => {
    expect(resolveCollectionAlias('subsets', { power_set: 'subsets' })).toBe('subsets')
  })

  it('passes an id through unchanged against an empty map (no aliases loaded yet — a safe no-op)', () => {
    expect(resolveCollectionAlias('power_set', {})).toBe('power_set')
  })

  it('applied to a parsed route, redirects only the collection segment — fiber-binding, element, and view-config survive', () => {
    const route: ParsedRoute = {
      address: { collection: 'power_set', fiberBinding: { n: 4, axes: {} }, element: '1,2' },
      viewQuery: { repr: 'oneline' },
    }
    const canonical = resolveCollectionAlias(route.address.collection!, { power_set: 'subsets' })
    const redirected: ParsedRoute = { ...route, address: { ...route.address, collection: canonical } }
    expect(routeFor(redirected)).toBe('/explore/collection/subsets;n=4/1%2C2?repr=oneline')
  })
})

describe('the SELECT list in the URL (#205)', () => {
  it('serializes the column list as select=', () => {
    const route: ParsedRoute = {
      address: { collection: 'permutations', fiberBinding: { n: 4, axes: {} }, element: null },
      viewQuery: { select: ['address', 'element', 'repr:cycle', 'map:inverse', 'descents'] },
    }
    expect(routeFor(route)).toBe('/explore/collection/permutations;n=4?select=address%2Celement%2Crepr%3Acycle%2Cmap%3Ainverse%2Cdescents')
    expect(parseRoute(loc('/explore/collection/permutations;n=4', routeFor(route).split('?')[1] ? '?' + routeFor(route).split('?')[1] : '')).viewQuery.select)
      .toEqual(['address', 'element', 'repr:cycle', 'map:inverse', 'descents'])
  })

  it('reads a legacy ?columns= deep link as the same list, and rewrites it as select=', () => {
    const parsed = parseRoute(loc('/explore/collection/permutations;n=4', '?columns=descents,map:inverse'))
    expect(parsed.viewQuery.select).toEqual(['descents', 'map:inverse'])
    expect(routeFor(parsed)).toBe('/explore/collection/permutations;n=4?select=descents%2Cmap%3Ainverse')
  })

  it('carries select= through the query view statement too, legacy columns= included', () => {
    expect(rowQueryFromSearch('?from=permutations(4)&select=element,descents').select).toBe('element,descents')
    expect(rowQueryFromSearch('?from=permutations(4)&columns=element,descents').select).toBe('element,descents')
    expect(searchFromRowQuery({ from: 'permutations(4)', select: 'element,descents' })).toBe('?from=permutations%284%29&select=element%2Cdescents')
  })
})
