-- requires: words, realizer, utilities
-- words statistics — classic word invariants over word(letters int[]): the number of distinct letters, descents
-- (positions i with w[i] > w[i+1]), ascents (w[i] < w[i+1]), the longest run of equal consecutive letters, and the
-- largest letter. Descents and ascents are equidistributed on each fiber (reverse the word). No natural single-arg
-- map to another collection, so this file registers statistics only.

-- ── statistics (carrier: word(letters int[]), 1-based letters over [1,base]) ─────────────────────────────
-- distinct letters: the size of the letter set (the number of distinct values used).
CREATE FUNCTION words_distinct_letters(w word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT count(DISTINCT l) FROM unnest((w).letters) l), 0)::int $$;
-- descents: positions i (< length) with a strict drop w[i] > w[i+1].
CREATE FUNCTION words_descents(w word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((w).letters, 1) i
   WHERE i < array_length((w).letters, 1) AND (w).letters[i] > (w).letters[i+1] $$;
-- ascents: positions i (< length) with a strict rise w[i] < w[i+1] (equidistributed with descents on each fiber).
CREATE FUNCTION words_ascents(w word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((w).letters, 1) i
   WHERE i < array_length((w).letters, 1) AND (w).letters[i] < (w).letters[i+1] $$;
-- longest run: the length of the longest maximal block of equal consecutive letters (gaps-and-islands on value).
CREATE FUNCTION words_longest_run(w word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(cnt), 0)::int FROM (
    SELECT count(*) cnt FROM (
      SELECT l, o - row_number() OVER (PARTITION BY l ORDER BY o) AS g
        FROM unnest((w).letters) WITH ORDINALITY AS t(l, o)) z
    GROUP BY l, g) q $$;
-- largest letter: the maximum letter value (0 on the empty word).
CREATE FUNCTION words_max_letter(w word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(l) FROM unnest((w).letters) l), 0)::int $$;

-- ── register in base_stat (collection, stat_id, value_fn, title, codomain) ──────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('words','distinct_letters','words_distinct_letters','Number of distinct letters','natural_numbers'),
  ('words','descents','words_descents','Number of descents','natural_numbers'),
  ('words','ascents','words_ascents','Number of ascents','natural_numbers'),
  ('words','longest_run','words_longest_run','Longest run','natural_numbers'),
  ('words','max_letter','words_max_letter','Largest letter','natural_numbers');

-- ── examples (fiber = words(n, base): BOTH args fixed; base^n rows) ──────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('words','distinct/descents/ascents/run/max of {2,1,3}','eq','3|1|1|1|3','a single word spot check',$q$
    SELECT words_distinct_letters(ROW(ARRAY[2,1,3])::word)::text || '|' ||
           words_descents(ROW(ARRAY[2,1,3])::word)::text || '|' ||
           words_ascents(ROW(ARRAY[2,1,3])::word)::text || '|' ||
           words_longest_run(ROW(ARRAY[2,1,3])::word)::text || '|' ||
           words_max_letter(ROW(ARRAY[2,1,3])::word)::text $q$),
  ('words','distinct letters distribution over words(2,3) is 3,6','eq','3,6','#words with 1,2 distinct letters',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT words_distinct_letters((e).value) k, count(*) c FROM elements(words(2,3)) e GROUP BY 1) t(k,c) $q$),
  ('words','distinct letters distribution over words(3,2) is 2,6','eq','2,6','#words with 1,2 distinct letters',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT words_distinct_letters((e).value) k, count(*) c FROM elements(words(3,2)) e GROUP BY 1) t(k,c) $q$),
  ('words','descents distribution over words(3,2) is 4,4','eq','4,4','#words with 0,1 descents',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT words_descents((e).value) k, count(*) c FROM elements(words(3,2)) e GROUP BY 1) t(k,c) $q$),
  ('words','descents distribution over words(3,3) is 10,16,1','eq','10,16,1','#words with 0,1,2 descents',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT words_descents((e).value) k, count(*) c FROM elements(words(3,3)) e GROUP BY 1) t(k,c) $q$),
  ('words','descents over words(3,2) in rank order','eq','0,0,1,0,1,1,1,0','descents of each word, lex order',$q$
    SELECT string_agg(words_descents((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(words(3,2)) e $q$),
  ('words','ascents distribution over words(2,3) is 6,3 (equidistributed with descents)','eq','6,3','#words with 0,1 ascents',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT words_ascents((e).value) k, count(*) c FROM elements(words(2,3)) e GROUP BY 1) t(k,c) $q$),
  ('words','ascents and descents share a distribution over words(3,3)','eq','true','reverse-word symmetry ⇒ same multiset',$q$
    SELECT (
      (SELECT array_agg(c ORDER BY k) FROM (SELECT words_ascents((e).value) k, count(*) c FROM elements(words(3,3)) e GROUP BY 1) a(k,c))
      =
      (SELECT array_agg(c ORDER BY k) FROM (SELECT words_descents((e).value) k, count(*) c FROM elements(words(3,3)) e GROUP BY 1) d(k,c))
    )::text $q$),
  ('words','longest run distribution over words(3,2) is 2,4,2','eq','2,4,2','#words with longest run 1,2,3',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT words_longest_run((e).value) k, count(*) c FROM elements(words(3,2)) e GROUP BY 1) t(k,c) $q$),
  ('words','longest run over words(3,2) in rank order','eq','3,2,1,2,2,1,2,3','longest equal-letter block per word',$q$
    SELECT string_agg(words_longest_run((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(words(3,2)) e $q$),
  ('words','max letter distribution over words(2,3) is 1,3,5','eq','1,3,5','#words with max letter 1,2,3',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT words_max_letter((e).value) k, count(*) c FROM elements(words(2,3)) e GROUP BY 1) t(k,c) $q$),
  ('words','max letter over words(2,3) in rank order','eq','1,2,3,2,2,3,3,3,3','max letter per word, lex order',$q$
    SELECT string_agg(words_max_letter((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(words(2,3)) e $q$),
  ('words','empty word (n=0): every stat is 0','eq','0|0|0|0|0','edge case, no letters',$q$
    SELECT words_distinct_letters((unrank(words(0,5),0)).value)::text || '|' ||
           words_descents((unrank(words(0,5),0)).value)::text || '|' ||
           words_ascents((unrank(words(0,5),0)).value)::text || '|' ||
           words_longest_run((unrank(words(0,5),0)).value)::text || '|' ||
           words_max_letter((unrank(words(0,5),0)).value)::text $q$);
