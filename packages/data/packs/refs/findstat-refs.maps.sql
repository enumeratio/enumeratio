-- requires: references, findstat-refs, maps
-- FindStat MAP pointers as base_reference rows (system='findstat', subject_kind='map') — issue #170, the second half
-- of the #161 findstat-refs work (which only covered stats). Mirrors findstat-refs.sql's KEYING convention exactly:
-- subject = '<collection>.<map_id>' (e.g. 'permutations.cycle_type'), not the bare map_id — base_map is keyed
-- (collection, map_id), so a map_id is only unique WITHIN a collection (the same way a stat_id is), and a bare
-- subject would collide across collections.
--
-- LAYERING (issue #170 — the point of this file): three cross-reference mechanisms exist and had been drifting out
-- of sync. This is the intended model, now complete on both halves:
--   * base_reference  — the UNIFORM spine. Every system (mathlib4/sage/oeis/wolfram/findstat), every subject_kind
--     (collection/construction/carrier/stat/map/operation/structure). Downstream readers (the explorer's identity
--     strip, a future cross-system oracle) can query THIS table alone and get the complete cross-reference picture —
--     they no longer need to also know about base_oeis or base_map.findstat as separate read paths.
--   * base_oeis       — a DEEPER curated annotation layer for distinguished integer sequences (offset, formula,
--     b-file, cross-refs to other A-numbers) that base_reference's flat (system, identity, url, delta) shape can't
--     hold. It stays the CURATION entry point for OEIS links; oeis-refs.backfill.sql (#160) is the one-way feed
--     into base_reference, so a new base_oeis row auto-appears here without a second INSERT.
--   * base_map.findstat — a convenience column on the maps registry (the code lives right next to the map it
--     documents, easy to set when registering a bijection). It stays the CURATION entry point for FindStat map
--     codes; THIS file is the one-way feed into base_reference, same shape as #160's oeis backfill.
-- Neither base_oeis nor base_map.findstat is being restructured into a view or dropped — they remain the authoring
-- surface, base_reference is the reading surface. See the close-out notes for the (deliberately deferred) case for
-- going further.
--
-- SELF-MAINTENANCE CAVEAT: the INSERT...SELECT below auto-covers every future findstat CODE added to an ALREADY-
-- required source file (maps.sql today — the only file with a real Mp##### value as of this commit; every other
-- base_map-populating file carries the findstat column but passes NULL, per each file's own fabrication guard). It
-- does NOT auto-cover a findstat code added in a BRAND NEW sqlsrc file unless that file is also load-ordered before
-- this one — `requires: references` places this very late (after every collection + stats/maps file in the current
-- toposort, verified against the full sqlsrc order at authoring time), but a new file's own requires-tag/name could
-- in principle land after it. If a future findstat map lands in a new file and doesn't show up here, check that
-- file's position in the sqlsrc load order first (packages/data/sqlsrc-order.ts).
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta)
  SELECT 'map', m.collection || '.' || m.map_id, 'findstat', m.findstat, 'https://www.findstat.org/' || m.findstat, ''
  FROM base_map m
  WHERE m.findstat IS NOT NULL
  ON CONFLICT (subject_kind, subject, system, identity) DO NOTHING;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','findstat map ref resolves for permutations.cycle_type (Mp00108)','eq','Mp00108','the identity strip pointer for a curated base_map.findstat code',$q$
    SELECT identity FROM base_reference WHERE subject_kind='map' AND subject='permutations.cycle_type' AND system='findstat' $q$),
  ('references','findstat map ref resolves for integer_partitions.conjugate (Mp00202)','eq','Mp00202','same backfill, a second collection',$q$
    SELECT identity FROM base_reference WHERE subject_kind='map' AND subject='integer_partitions.conjugate' AND system='findstat' $q$),
  ('references','base_reference is now the complete findstat spine (stats AND maps)','eq','true','a downstream reader can rely on base_reference alone for findstat, no need to also read base_map.findstat',$q$
    SELECT (EXISTS (SELECT 1 FROM base_reference WHERE system='findstat' AND subject_kind='stat')
        AND EXISTS (SELECT 1 FROM base_reference WHERE system='findstat' AND subject_kind='map'))::text $q$),
  ('references','the map backfill covers every base_map findstat row, no gaps','eq','0','no base_map(collection,map_id,findstat) row missing from the uniform cross-ref layer',$q$
    SELECT count(*)::text FROM base_map m WHERE m.findstat IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM base_reference r WHERE r.subject_kind='map' AND r.subject = m.collection || '.' || m.map_id
                        AND r.system='findstat' AND r.identity = m.findstat) $q$);
