-- requires: integer_compositions, realizer, utilities
-- palindromic_compositions — ported from old-backup sqlsrc/palindromic-compositions.sql. Compositions of n whose
-- part list reads the same forwards and backwards (parts[i] = parts[k+1-i]). |palindromic_compositions(n)| =
-- 2^floor(n/2) — A016116: n=0..8 -> 1,1,2,2,4,4,8,8,16. The old file hand-rolled its own count/rank/unrank
-- engines (outer-pair peeling in lex order); here it's just base_restrict of integer_compositions filtered by
-- the palindrome predicate — the parent's gap-cut floor supplies everything else (order, count-via-scan, contains).

CREATE FUNCTION is_palindromic_composition(v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((v).parts, '{}') = coalesce(
    (SELECT array_agg(p ORDER BY o DESC) FROM unnest((v).parts) WITH ORDINALITY AS t(p, o)), '{}') $$;

-- accel hook (#172): |palindromic_compositions(n)| = 2^⌊n/2⌋ (A016116) — the free left half (up to a possible
-- fixed center part) determines the mirrored right half.
CREATE FUNCTION palindromic_composition_count(f integer_compositions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT pow_int(2, (f).n::int / 2) $$;   -- integer division truncates ⇒ ⌊n/2⌋

SELECT base_restrict('palindromic_compositions', 'integer_compositions', 'is_palindromic_composition', count_fn => 'palindromic_composition_count');

CREATE FUNCTION fiber_symbol(f palindromic_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'PalCom(' || (f).n::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('palindromic_compositions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('palindromic_compositions','|palindromic_compositions(1)| = 1','eq','1','just "1"',$q$
    SELECT cardinality(palindromic_compositions(1))::text $q$),
  ('palindromic_compositions','|palindromic_compositions(4)| = 4','eq','4','1+1+1+1, 2+2, 1+2+1, 4',$q$
    SELECT cardinality(palindromic_compositions(4))::text $q$),
  ('palindromic_compositions','|palindromic_compositions(6)| = 8','eq','8','2^floor(6/2)',$q$
    SELECT cardinality(palindromic_compositions(6))::text $q$),
  ('palindromic_compositions','count is 2^floor(n/2) for n=0..8 (A016116)','eq','1,1,2,2,4,4,8,8,16','base_restrict counting the filtered floor',$q$
    SELECT string_agg(cardinality(palindromic_compositions(n))::text, ',' ORDER BY n) FROM generate_series(0,8) n $q$),
  ('palindromic_compositions','fiber(4) enumerated in the parent''s gap-cut order','eq','4,2+2,1+2+1,1+1+1+1','mask order, filtered to palindromes',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(palindromic_compositions(4)) e $q$),
  ('palindromic_compositions','every composition of 7 reads the same reversed','eq','true','the defining invariant, across the whole fiber',$q$
    SELECT bool_and(is_palindromic_composition((e).value))::text FROM elements(palindromic_compositions(7)) e $q$),
  ('palindromic_compositions','every composition of 8 sums to 8','eq','true','still a composition of n underneath the filter',$q$
    SELECT bool_and((SELECT coalesce(sum(p),0) FROM unnest(((e).value).parts) p) = 8)::text FROM elements(palindromic_compositions(8)) e $q$),
  ('palindromic_compositions','contains: 2+2 in compositions(4), 1+3 not (sums but not a palindrome)','eq','true|false','derived membership = parent-contains AND predicate',$q$
    SELECT (ROW(ARRAY[2,2])::composition <@ palindromic_compositions(4))::text || '|' ||
           (ROW(ARRAY[1,3])::composition <@ palindromic_compositions(4))::text $q$);
