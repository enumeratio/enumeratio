-- requires: ternary_gray_codes, realizer, utilities
-- ternary_gray_codes statistics — digit-sum invariants over the base-3 alphabet {0,1,2}, mirroring
-- binary_words.stats.sql's number_of_ones for the ternary carrier.

-- ── statistics (carrier: ternary_gray_code(digits int[]) over {0,1,2}) ─────────────────────────────────
-- weight: the digit sum.
CREATE FUNCTION ternary_gray_weight(w ternary_gray_code) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(d), 0)::int FROM unnest((w).digits) d $$;
-- nonzero_digits: the number of nonzero digits.
CREATE FUNCTION ternary_gray_nonzero_digits(w ternary_gray_code) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((w).digits) d WHERE d <> 0 $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('ternary_gray_codes','weight','ternary_gray_weight','Weight','natural_numbers'),
  ('ternary_gray_codes','nonzero_digits','ternary_gray_nonzero_digits','Nonzero digits','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- ternary_gray_codes(2) in Gray order (from ternary_gray_codes.sql's own example): 00,01,02,12,11,10,20,21,22.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('ternary_gray_codes','weight over ternary_gray_codes(2) in Gray order is 0,1,2,3,2,1,2,3,4','eq','0,1,2,3,2,1,2,3,4','digit sum per word',$q$
    SELECT string_agg(ternary_gray_weight((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(ternary_gray_codes(2)) e $q$),
  ('ternary_gray_codes','weight changes by exactly ±1 between Gray-adjacent words (the defining property), n=2','eq','true','a Gray code step flips one digit by ±1, so the digit sum moves by ±1 too',$q$
    SELECT bool_and(abs(cur.w - prev.w) = 1)::text
    FROM (SELECT ordinality(e) ord, ternary_gray_weight((e).value) w FROM elements(ternary_gray_codes(2)) e) cur
    JOIN (SELECT ordinality(e) ord, ternary_gray_weight((e).value) w FROM elements(ternary_gray_codes(2)) e) prev
      ON prev.ord = cur.ord - 1 $q$),
  ('ternary_gray_codes','nonzero_digits over ternary_gray_codes(2) in Gray order is 0,1,1,2,2,1,1,2,2','eq','0,1,1,2,2,1,1,2,2','count of nonzero digits per word',$q$
    SELECT string_agg(ternary_gray_nonzero_digits((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(ternary_gray_codes(2)) e $q$),
  ('ternary_gray_codes','weight(2,2,2) = 6, nonzero_digits(2,2,2) = 3, at n=3','eq','6|3','the all-2s word',$q$
    SELECT ternary_gray_weight(ROW(ARRAY[2,2,2])::ternary_gray_code)::text || '|' ||
           ternary_gray_nonzero_digits(ROW(ARRAY[2,2,2])::ternary_gray_code)::text $q$),
  ('ternary_gray_codes','empty word (n=0): weight=0, nonzero_digits=0','eq','0|0','edge case, no digits',$q$
    SELECT ternary_gray_weight((unrank(ternary_gray_codes(0),0)).value)::text || '|' ||
           ternary_gray_nonzero_digits((unrank(ternary_gray_codes(0),0)).value)::text $q$);
