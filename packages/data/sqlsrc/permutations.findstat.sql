-- requires: permutations, statistics, permutations.stats, maps, references, realizer, utilities
-- permutations — FindStat sweep (issue #224): cross-references for eleven already-implemented statistics
-- (confirmed against findstat.org's own definitions and distribution/value tables — see the base_reference rows
-- below for exact St-numbers) + one new map, the Kreweras complement.
--
-- CONFIRMATION METHOD: each St-number was checked by fetching findstat.org/StatisticsDatabase/St###### and
-- comparing (a) the prose definition and (b) a published distribution or value table against this codebase's own
-- function/example. Two near-misses were caught and deliberately OMITTED: St000092 "outer peaks" and St000099
-- "valleys, including the boundary" both count the BOUNDARY positions (w[1], w[n]) as candidate peaks/valleys —
-- our perm_peaks/perm_valleys (permutations.stats.sql) are INTERIOR-only (1 < i < n), which are instead
-- St000023 "inner peaks" and St000353 "inner valleys" (confirmed below, distributions match exactly).

-- ── map: Kreweras complement (Mp00088) — π ↦ π⁻¹·c where c = (1,2,…,n) is the long cycle, i.e.
-- Kreweras(π)(i) = c(π⁻¹(i)) = (π⁻¹(i) mod n) + 1. That RHS is exactly perm_cyclic_shift applied to perm_inverse(π)
-- (perm_cyclic_shift already computes w'(i) = (w(i) mod n) + 1 — maps.sql). A bijection on S_n (composition of two
-- bijections); order n on the identity's cycle but not an involution in general (Mp00089 is its distinct inverse,
-- not ported here). Verified against findstat.org's own Values table for Mp00088 on S_1..S_4 (examples below).
CREATE FUNCTION perm_kreweras_complement(p permutation) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT perm_cyclic_shift(perm_inverse(p)) $$;

-- is_bijection is left at its default false: the map IS a bijection (composition of two bijections), but the
-- registry's own self-test (map_compose.sql: "every declared bijection names its inverse map") requires an
-- `inverse` pointer for any is_bijection=true row, and Mp00089 (inverse Kreweras complement) isn't ported here.
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('permutations','kreweras_complement','perm_kreweras_complement','permutations','Kreweras complement','Mp00088');

-- ── FindStat cross-references (base_reference; direct INSERT — the base_map.findstat auto-backfill in
-- findstat-refs.maps.sql loads too early in the topo order to catch a map registered here, so this file seeds
-- base_reference itself, same pattern as integer_partitions.rank_crank.sql for stats) ─────────────────────────
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','permutations.inversions',            'findstat','St000018','https://www.findstat.org/St000018',''),
  ('stat','permutations.descents',              'findstat','St000021','https://www.findstat.org/St000021',''),
  ('stat','permutations.major_index',           'findstat','St000004','https://www.findstat.org/St000004',''),
  ('stat','permutations.fixed_points',          'findstat','St000022','https://www.findstat.org/St000022',''),
  ('stat','permutations.excedances',            'findstat','St000155','https://www.findstat.org/St000155',''),
  ('stat','permutations.cycles',                'findstat','St000031','https://www.findstat.org/St000031',''),
  ('stat','permutations.ascents',                'findstat','St000245','https://www.findstat.org/St000245',''),
  ('stat','permutations.peaks',                  'findstat','St000023','https://www.findstat.org/St000023',''),
  ('stat','permutations.valleys',                'findstat','St000353','https://www.findstat.org/St000353',''),
  ('stat','permutations.left_to_right_maxima',   'findstat','St000314','https://www.findstat.org/St000314',''),
  ('stat','permutations.weak_exceedances',       'findstat','St000213','https://www.findstat.org/St000213',''),
  ('map', 'permutations.kreweras_complement',    'findstat','Mp00088','https://www.findstat.org/Mp00088','');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','kreweras complement over S_3, in rank order: identity ↦ 231, 213 ↦ 321','eq','231|321','findstat.org Mp00088 Values table, S_3 rows [1,2,3] and [2,1,3]',$q$
    SELECT one_line(perm_kreweras_complement(ROW(ARRAY[1,2,3])::permutation)) || '|' ||
           one_line(perm_kreweras_complement(ROW(ARRAY[2,1,3])::permutation)) $q$),
  ('permutations','kreweras complement: 312 is a fixed point (findstat Mp00088 S_3 row)','eq','312','π⁻¹·c returns π itself here',$q$
    SELECT one_line(perm_kreweras_complement(ROW(ARRAY[3,1,2])::permutation)) $q$),
  ('permutations','kreweras complement over S_4: 1342 ↦ 2134 (findstat Mp00088 Values table)','eq','2134','a size-4 oracle check',$q$
    SELECT one_line(perm_kreweras_complement(ROW(ARRAY[1,3,4,2])::permutation)) $q$),
  ('permutations','kreweras complement is a bijection on permutations(4): 24 distinct images','eq','24','injective ⇒ bijective on a finite fiber',$q$
    SELECT count(DISTINCT one_line(perm_kreweras_complement((e).value)))::text FROM elements(permutations(4)) e $q$),
  ('permutations','kreweras complement image renders in the codomain (permutations) form','eq','231','render_value on a permutation image',$q$
    SELECT render_value(perm_kreweras_complement(ROW(ARRAY[1,2,3])::permutation)) $q$),
  ('references','findstat ref resolves for permutations.inversions (St000018)','eq','St000018','the identity strip pointer',$q$
    SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='permutations.inversions' AND system='findstat' $q$),
  ('references','findstat ref resolves for permutations.kreweras_complement (Mp00088)','eq','Mp00088','the identity strip pointer for the new map',$q$
    SELECT identity FROM base_reference WHERE subject_kind='map' AND subject='permutations.kreweras_complement' AND system='findstat' $q$),
  ('references','the eleven confirmed permutation stat refs all resolve, none dangling (floor — more may be added later)','eq','true','containment on the specific ids confirmed above, not an exact count (post-#171 convention)',$q$
    SELECT (count(*) >= 11 AND array_agg(r.subject) @> ARRAY[
      'permutations.inversions','permutations.descents','permutations.major_index','permutations.fixed_points',
      'permutations.excedances','permutations.cycles','permutations.ascents','permutations.peaks',
      'permutations.valleys','permutations.left_to_right_maxima','permutations.weak_exceedances'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='stat' AND r.subject LIKE 'permutations.%'
      AND EXISTS (SELECT 1 FROM base_stat s WHERE s.collection='permutations' AND s.stat_id = split_part(r.subject,'.',2)) $q$);
