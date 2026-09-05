-- requires: arrangements, realizer, utilities
-- arrangements statistics — classic injective-word invariants over arrangement(word int[]). `length` is already the
-- second grade axis (g2), so it's not re-registered here as a stat. The rest reads exactly like a permutation stat
-- restricted to a length-k prefix of [n] with no full-image assumption: max_value/min_value (the word need not
-- touch 1 or n), ascents/descents (single-step rises/drops), inversions (Mahonian, #{i<j : w_i>w_j}), and
-- left-to-right maxima (records). All five degrade to the permutation stats when length = size (the k=n fiber).

-- ── statistics (carrier: arrangement(word int[]), injective, 1-based over [1,size]) ──────────────────────
-- max_value / min_value: the largest / smallest letter used (0 on the empty word — no letter is < 1, so 0 is an
-- unambiguous "none" sentinel, matching words_max_letter's convention).
CREATE FUNCTION arrangement_max_value(a arrangement) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(v) FROM unnest((a).word) v), 0)::int $$;
CREATE FUNCTION arrangement_min_value(a arrangement) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT min(v) FROM unnest((a).word) v), 0)::int $$;

-- ascents / descents: positions i (< length) with a strict rise w[i]<w[i+1] / drop w[i]>w[i+1]. Exactly one holds
-- per gap (the word is injective, so no ties) — ascents+descents = length-1 for length ≥ 1, 0 for length 0 or 1.
CREATE FUNCTION arrangement_ascents(a arrangement) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((a).word,1) i
   WHERE i < array_length((a).word,1) AND (a).word[i] < (a).word[i+1] $$;
CREATE FUNCTION arrangement_descents(a arrangement) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((a).word,1) i
   WHERE i < array_length((a).word,1) AND (a).word[i] > (a).word[i+1] $$;

-- inversions: #{ i<j : w[i] > w[j] } — the Mahonian statistic, same definition as perm_inversions in statistics.sql.
CREATE FUNCTION arrangement_inversions(a arrangement) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((a).word,1) i, generate_subscripts((a).word,1) j
   WHERE i < j AND (a).word[i] > (a).word[j] $$;

-- left-to-right maxima (records): #{ i : w[i] > w[j] for all j < i }. 0 on the empty word.
CREATE FUNCTION arrangement_ltr_maxima(a arrangement) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (
    SELECT v, max(v) OVER (ORDER BY o ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) prev_max
    FROM unnest((a).word) WITH ORDINALITY t(v, o)
  ) q WHERE prev_max IS NULL OR v > prev_max $$;

-- ── register ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('arrangements','max_value','arrangement_max_value','Largest value used','natural_numbers'),
  ('arrangements','min_value','arrangement_min_value','Smallest value used','natural_numbers'),
  ('arrangements','ascents','arrangement_ascents','Ascents','natural_numbers'),
  ('arrangements','descents','arrangement_descents','Descents','natural_numbers'),
  ('arrangements','inversions','arrangement_inversions','Inversions','natural_numbers'),
  ('arrangements','left_to_right_maxima','arrangement_ltr_maxima','Left-to-right maxima','natural_numbers');

-- ── examples (expected values hand-verified against the file's own fiber examples in arrangements.sql) ────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  -- fiber [3,2] in lex order: 1-2,1-3,2-1,2-3,3-1,3-2 (the same anchor order arrangements.sql pins).
  ('arrangements','max_value over fiber [3,2] in rank order','eq','2,3,2,3,3,3','largest letter per element of 1-2,1-3,2-1,2-3,3-1,3-2',$q$
    SELECT string_agg(arrangement_max_value((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(arrangements(3,2)) e $q$),
  ('arrangements','min_value over fiber [3,2] in rank order','eq','1,1,1,2,1,2','smallest letter per element of 1-2,1-3,2-1,2-3,3-1,3-2',$q$
    SELECT string_agg(arrangement_min_value((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(arrangements(3,2)) e $q$),
  ('arrangements','ascents/descents over fiber [3,2] in rank order','eq','1,1,0,1,0,0|0,0,1,0,1,1','single-gap rise/drop per element, complementary since k=2',$q$
    SELECT (SELECT string_agg(arrangement_ascents((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(arrangements(3,2)) e) || '|' ||
           (SELECT string_agg(arrangement_descents((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(arrangements(3,2)) e) $q$),
  ('arrangements','inversions over fiber [3,2] in rank order','eq','0,0,1,0,1,1','matches descents at length 2 (one gap = one possible pair)',$q$
    SELECT string_agg(arrangement_inversions((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(arrangements(3,2)) e $q$),
  ('arrangements','left-to-right maxima over fiber [3,2] in rank order','eq','2,2,1,2,1,1','records per element of 1-2,1-3,2-1,2-3,3-1,3-2',$q$
    SELECT string_agg(arrangement_ltr_maxima((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(arrangements(3,2)) e $q$),
  -- fiber [4,2]: 12 elements, non-trivial max/min distributions (unlike the full-image k=n case, they're not constant).
  ('arrangements','max_value distribution over arrangements(4,2) is 2,4,6 (values 2,3,4)','eq','2,4,6','#arrangements with max letter 2,3,4',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT arrangement_max_value((e).value) k, count(*) c FROM elements(arrangements(4,2)) e GROUP BY 1) t(k,c) $q$),
  ('arrangements','min_value distribution over arrangements(4,2) is 6,4,2 (values 1,2,3)','eq','6,4,2','#arrangements with min letter 1,2,3',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT arrangement_min_value((e).value) k, count(*) c FROM elements(arrangements(4,2)) e GROUP BY 1) t(k,c) $q$),
  -- fiber [3,3] = permutations(3): a cross-check that these stats reduce to the permutation stats on the k=n fiber.
  ('arrangements','ascents distribution over arrangements(3,3) is the Eulerian row 1,4,1 (matches permutations(3))','eq','1,4,1','k=n fiber = permutations(3)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT arrangement_ascents((e).value) k, count(*) c FROM elements(arrangements(3,3)) e GROUP BY 1) t(k,c) $q$),
  ('arrangements','inversions distribution over arrangements(3,3) is the Mahonian row 1,2,2,1 (matches permutations(3))','eq','1,2,2,1','k=n fiber = permutations(3)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT arrangement_inversions((e).value) k, count(*) c FROM elements(arrangements(3,3)) e GROUP BY 1) t(k,c) $q$),
  ('arrangements','left-to-right maxima distribution over arrangements(3,3) is the unsigned Stirling-1 row 2,3,1 (matches permutations(3))','eq','2,3,1','k=n fiber = permutations(3)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT arrangement_ltr_maxima((e).value) k, count(*) c FROM elements(arrangements(3,3)) e GROUP BY 1) t(k,c) $q$),
  -- spot check on a 4-letter arrangement (a permutation of [4]): 3-1-4-2.
  ('arrangements','spot check 3-1-4-2: max 4, min 1, ascents 1, descents 2, inversions 3, ltr-maxima 2','eq','4|1|1|2|3|2','all six stats on the word [3,1,4,2]',$q$
    SELECT arrangement_max_value(ROW(ARRAY[3,1,4,2])::arrangement)::text || '|' ||
           arrangement_min_value(ROW(ARRAY[3,1,4,2])::arrangement)::text || '|' ||
           arrangement_ascents(ROW(ARRAY[3,1,4,2])::arrangement)::text || '|' ||
           arrangement_descents(ROW(ARRAY[3,1,4,2])::arrangement)::text || '|' ||
           arrangement_inversions(ROW(ARRAY[3,1,4,2])::arrangement)::text || '|' ||
           arrangement_ltr_maxima(ROW(ARRAY[3,1,4,2])::arrangement)::text $q$),
  -- empty word (length=0): every stat is 0, for any size.
  ('arrangements','empty word (length=0): every stat is 0','eq','0|0|0|0|0|0','edge case, no letters',$q$
    SELECT arrangement_max_value((unrank(arrangements(5,0),0)).value)::text || '|' ||
           arrangement_min_value((unrank(arrangements(5,0),0)).value)::text || '|' ||
           arrangement_ascents((unrank(arrangements(5,0),0)).value)::text || '|' ||
           arrangement_descents((unrank(arrangements(5,0),0)).value)::text || '|' ||
           arrangement_inversions((unrank(arrangements(5,0),0)).value)::text || '|' ||
           arrangement_ltr_maxima((unrank(arrangements(5,0),0)).value)::text $q$);
