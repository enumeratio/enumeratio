// A cheap, dependency-free content hash (djb2 + length) of the SQL bundle. Used to VERSION the prebuilt DB dump: the
// dump stores this hash; the client compares it against the current bundle's hash after mounting, and falls back to a
// fresh build when they differ (a stale/rebuilt-needed dump). Not security-sensitive.
export function bundleHash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36) + '-' + s.length.toString(36)
}

/** A pack's ordered files, hashed the same way `coreBundle()` hashes the whole thing (per-file banner + content) —
 *  so a pack's hash is exactly what hashing that pack alone would give (#283 phase 1.4, wiki §7). Pure: takes the
 *  segment shape `segmentByPack` produces rather than importing it, so this file stays dependency-free. */
export type PackHash = { pack: string; hash: string }
export function packHashes(segments: { pack: string; files: { name: string; content: string }[] }[]): PackHash[] {
  return segments.map(seg => ({
    pack: seg.pack,
    hash: bundleHash(seg.files.map(f => `-- ═══ ${f.name}.sql ═══\n${f.content}`).join('\n')),
  }))
}

/** The profile hash (wiki §7): hash of the ordered per-pack hashes. A distinct quantity from `coreBundleHash()`
 *  (the plain concatenated-bundle hash the catalog snapshot versions against) — this one changes when any pack's
 *  own hash changes, or when the pack SET/ORDER changes, without needing to re-concatenate every file's content. */
export function profileHash(hashes: PackHash[]): string {
  return bundleHash(hashes.map(h => `${h.pack}:${h.hash}`).join('\n'))
}

/** Packs whose stamped hash (from a mounted dump's `_pack_version` rows) differs from the live hash — a pack
 *  whose content changed, plus any pack added or removed since the dump was built. Empty ⇒ every pack is fresh,
 *  so the dump can be mounted as-is; a non-empty result names exactly which pack(s) forced the rebuild. */
export function stalePacks(stored: PackHash[], live: PackHash[]): string[] {
  const storedMap = new Map(stored.map(r => [r.pack, r.hash]))
  const liveMap = new Map(live.map(r => [r.pack, r.hash]))
  const names = new Set([...storedMap.keys(), ...liveMap.keys()])
  const out: string[] = []
  for (const n of names) if (storedMap.get(n) !== liveMap.get(n)) out.push(n)
  return out.sort()
}
