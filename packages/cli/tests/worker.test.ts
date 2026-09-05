import { afterAll, expect, it } from 'vitest'
import { provideDb, makeWorkerDb, construct, close } from '@enumeratio/client'

// The off-thread node Db: pglite runs in a worker_threads worker (with a watchdog) so a caller never blocks on a
// long enumeration. Verify a query round-trips through it — spawn, enumerate, close — keeping the non-blocking
// path wired. (makeDb, the main-thread one-shot loader, is what the other suites use.)
provideDb(() => makeWorkerDb())
afterAll(() => close())

it('enumerates through the worker-backed node Db', async () => {
  const p = construct('permutations', { size: 4 })
  expect(await p.card()).toBe(24)
  expect(await p.serialize(0, 1)).toEqual(['1234'])
})
