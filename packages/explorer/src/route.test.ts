import { describe, expect, it } from 'vitest'
import { rowQueryFromSearch, searchFromRowQuery } from '@enumeratio/client'
import {
  parseRoute, routeFor, resolveCollectionAlias, resolveFamilyPointRoute, addressKey, pushCrumb, reconcileCrumbs,
  type ParsedRoute, type RouteAddress, type RouteCrumb,
} from './route'

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

describe('resolveFamilyPointRoute (#67 D4: every named point redirects to its family route)', () => {
  const points = { twin_primes: { family: 'prime_pairs', bindings: { gap: 2 } }, binary_words: { family: 'words', bindings: { base: 2 } } }

  it('redirects an ungraded realized point (no axes of its own) to its family, bindings as matrix params', () => {
    expect(resolveFamilyPointRoute('twin_primes', points, [], ['gap'], { n: null, axes: {} }))
      .toEqual({ collection: 'prime_pairs', axes: { gap: 2 } })
  })

  it('maps a sub-family point\'s own axis positionally onto the family\'s remaining one (n → size, not by name)', () => {
    expect(resolveFamilyPointRoute('binary_words', points, ['n'], ['size', 'base'], { n: 4, axes: {} }))
      .toEqual({ collection: 'words', axes: { base: 2, size: 4 } })
  })

  it('passes a non-point id through unchanged, with no extra axes — a safe no-op', () => {
    expect(resolveFamilyPointRoute('subsets', points, [], [], { n: 4, axes: {} })).toEqual({ collection: 'subsets', axes: {} })
  })

  it('passes any id through unchanged against an empty map (base_family_point not loaded yet)', () => {
    expect(resolveFamilyPointRoute('twin_primes', {}, [], [], { n: null, axes: {} })).toEqual({ collection: 'twin_primes', axes: {} })
  })
})

describe('breadcrumb trail helpers (#181)', () => {
  const addr = (collection: string, element: string | null = null, n: number | null = null): RouteAddress =>
    ({ collection, fiberBinding: { n, axes: {} }, element })
  const crumb = (collection: string, element: string | null = null, via?: string): RouteCrumb =>
    ({ address: addr(collection, element), title: collection, via })

  it('addressKey matches the same address regardless of axes insertion order', () => {
    const a: RouteAddress = { collection: 'k_subsets', fiberBinding: { n: 5, axes: { k: 2, j: 1 } }, element: null }
    const b: RouteAddress = { collection: 'k_subsets', fiberBinding: { n: 5, axes: { j: 1, k: 2 } }, element: null }
    expect(addressKey(a)).toBe(addressKey(b))
  })

  it('addressKey differs across collection, binding, or element', () => {
    const base = addressKey(addr('permutations', '1'))
    expect(addressKey(addr('permutations', '2'))).not.toBe(base)
    expect(addressKey(addr('subsets', '1'))).not.toBe(base)
    expect(addressKey(addr('permutations', '1', 4))).not.toBe(base)
  })

  it('pushCrumb grows the trail with the address being left, tagged with the map that was followed', () => {
    const c1 = crumb('permutations', '1')
    const out = pushCrumb([], c1, addr('binary_trees', '100'))
    expect(out).toEqual([c1])
  })

  it('pushCrumb is a no-op for a link back to the exact place you already are', () => {
    const c1 = crumb('permutations', '1')
    expect(pushCrumb([], c1, addr('permutations', '1'))).toEqual([])
  })

  it('pushCrumb is a no-op when the trail\'s own top already IS the address being left (a double-fired click)', () => {
    const c1 = crumb('permutations', '1')
    const trail = [c1]
    expect(pushCrumb(trail, c1, addr('binary_trees', '100'))).toBe(trail)
  })

  it('pushCrumb accumulates across multiple hops, in order', () => {
    let trail: RouteCrumb[] = []
    trail = pushCrumb(trail, crumb('permutations', '1', 'inverse'), addr('permutations', '2'))
    trail = pushCrumb(trail, crumb('permutations', '2'), addr('binary_trees', '100'))
    expect(trail.map((c) => c.address.collection)).toEqual(['permutations', 'permutations'])
    expect(trail[0].via).toBe('inverse')
  })

  it('reconcileCrumbs drops a matched crumb and everything recorded after it (a browser back lands there again)', () => {
    const trail = [crumb('permutations', '1'), crumb('permutations', '2'), crumb('binary_trees', '100')]
    expect(reconcileCrumbs(trail, addr('permutations', '2'))).toEqual([crumb('permutations', '1')])
  })

  it('reconcileCrumbs leaves an unmatched landing untouched (a fresh load, a manual URL edit)', () => {
    const trail = [crumb('permutations', '1')]
    expect(reconcileCrumbs(trail, addr('subsets', null))).toBe(trail)
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
