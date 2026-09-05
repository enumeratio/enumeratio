// The row window — an element/rows page size (`count`) and a fiber-level page size (`fiberLimit`), the two knobs
// planRows()'s RowWindow takes for a STREAMED handle. 'elements'/'rowgroup' archetypes page via first+count
// (rank_index_range); 'fibers'/'rollup'/'distribution' restart from a bigger `fibers(handle, n)` call each time —
// there's no offset into that stream, so growing fiberLimit is the only lever Load more has there (#208).
// Shared by CollectionView and QueryView so the two don't duplicate (and drift on) the same grow/reset logic.
import { ref } from 'vue'

export const DEFAULT_COUNT = 100
export const DEFAULT_FIBER_LIMIT = 200

/** Archetypes whose Load more has to grow `fiberLimit` (no first/offset support) rather than `count`. */
export function isFiberArchetype(archetype: string | undefined): boolean {
  return archetype === 'fibers' || archetype === 'rollup' || archetype === 'distribution'
}

export function useRowWindow(defaultCount = DEFAULT_COUNT, defaultFiberLimit = DEFAULT_FIBER_LIMIT) {
  const count = ref(defaultCount)
  const fiberLimit = ref(defaultFiberLimit)
  /** back to page defaults — call on every collection/FROM-target change so an inflated window doesn't carry over. */
  function reset(nextCount = defaultCount, nextFiberLimit = defaultFiberLimit) {
    count.value = nextCount
    fiberLimit.value = nextFiberLimit
  }
  /** grow whichever window the given archetype streams from, by one page. */
  function grow(archetype: string | undefined, page = DEFAULT_COUNT, fiberPage = DEFAULT_FIBER_LIMIT) {
    if (isFiberArchetype(archetype)) fiberLimit.value += fiberPage
    else count.value += page
  }
  return { count, fiberLimit, reset, grow }
}
