-- requires: restricted_growth_strings, realizer, utilities
-- restricted_growth_strings statistics — `blocks` is exactly the pre-existing parts_count carrier function
-- (restricted_growth_strings.sql, cited there as FindStat St000105 in the old catalog): the block count of the set
-- partition this RGS word encodes, = 1 + max(word). `singletons` counts the letters used exactly once — the
-- singleton blocks of that same partition.

-- ── statistics (carrier: rgs_word(word int[])) ─────────────────────────────────────────────────────────
-- singletons: the number of distinct letters occurring exactly once (a singleton block of the encoded partition).
CREATE FUNCTION rgs_singletons(w rgs_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (SELECT v, count(*) c FROM unnest((w).word) v GROUP BY v) t WHERE c = 1 $$;

-- blocks reuses parts_count (defined in restricted_growth_strings.sql); FindStat St000105.
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('restricted_growth_strings','blocks','parts_count','Number of blocks','natural_numbers'),
  ('restricted_growth_strings','singletons','rgs_singletons','Singletons','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- restricted_growth_strings(3) in lex order: 000,001,010,011,012.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('restricted_growth_strings','blocks over restricted_growth_strings(3) in lex order is 1,2,2,2,3','eq','1,2,2,2,3','1 + max(word) per word',$q$
    SELECT string_agg(parts_count((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(restricted_growth_strings(3)) e $q$),
  ('restricted_growth_strings','singletons over restricted_growth_strings(3) in lex order is 0,1,1,1,3','eq','0,1,1,1,3','000 has none; 012 is all singletons',$q$
    SELECT string_agg(rgs_singletons((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(restricted_growth_strings(3)) e $q$),
  ('restricted_growth_strings','singletons(012) = 3: every letter used once','eq','3','the finest partition of [3]',$q$
    SELECT rgs_singletons(ROW(ARRAY[0,1,2])::rgs_word)::text $q$),
  ('restricted_growth_strings','singletons(0,1,0,2) = 2, blocks(0,1,0,2) = 3','eq','2|3','letter 0 repeats; letters 1 and 2 are each singletons',$q$
    SELECT rgs_singletons(ROW(ARRAY[0,1,0,2])::rgs_word)::text || '|' || parts_count(ROW(ARRAY[0,1,0,2])::rgs_word)::text $q$),
  ('restricted_growth_strings','empty word (n=0): blocks=0, singletons=0','eq','0|0','no letters at all',$q$
    SELECT parts_count((unrank(restricted_growth_strings(0),0)).value)::text || '|' ||
           rgs_singletons((unrank(restricted_growth_strings(0),0)).value)::text $q$);
