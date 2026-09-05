// A cheap, dependency-free content hash (djb2 + length) of the SQL bundle. Used to VERSION the prebuilt DB dump: the
// dump stores this hash; the client compares it against the current bundle's hash after mounting, and falls back to a
// fresh build when they differ (a stale/rebuilt-needed dump). Not security-sensitive.
export function bundleHash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36) + '-' + s.length.toString(36)
}
