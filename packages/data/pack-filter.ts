// Shared `--pack <P>` flag parsing for the verification tools (quickcheck.mts, selfcert.mts, selfcert-view.mts —
// #283 phase 3.4, wiki Core-And-Packs §6: "membership is a registry query, not a naming convention"). `--pack P`
// selects exactly the collections where `base_collection.pack = P`. The pre-existing id-substring positional
// argument stays as a fallback/refinement — when both are given they intersect (pack membership AND id match).
export function parsePackArg(argv: string[]): { pack: string | null; rest: string[] } {
  const rest: string[] = []
  let pack: string | null = null
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pack') { pack = argv[++i] ?? null; continue }
    rest.push(argv[i])
  }
  return { pack, rest }
}

/** Loud failure for the "selected zero collections" case — a `--pack`/substring filter that matches nothing is NOT
 *  a clean pass (an empty sweep trivially reports "no mismatches"); it's either a typo'd pack name or a pack that
 *  genuinely owns no collections (e.g. `refs`, which holds only reference rows). Either way, silence here reads as
 *  a green run when nothing was actually checked — the worst possible outcome. Exits the process when triggered. */
export function requireNonEmptySelection(
  tool: string, pack: string | null, filter: string | null, selectedCount: number,
  cleanup?: () => void,   // close a worker channel / pglite handle before exiting, so a zero-match run doesn't leak it
): void {
  if (!pack && !filter) return           // no filter at all — an empty catalog is a different, bigger problem
  if (selectedCount > 0) return
  console.error(`\n✗ ${tool}: selected 0 collections${pack ? ` for --pack ${pack}` : ''}${filter ? ` matching "${filter}"` : ''} — nothing was verified. This is NOT a pass.`)
  cleanup?.()
  process.exit(1)
}
