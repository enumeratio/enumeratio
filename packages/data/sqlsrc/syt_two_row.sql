-- requires: standard_tableaux, realizer, utilities
-- syt_two_row — standard Young tableaux with n cells in AT MOST TWO ROWS (shapes λ = (a,b), a≥b). Count =
-- C(n, ⌊n/2⌋), the central binomial coefficients: 1,1,2,3,6,10,20,35,70 for n=0..8 (A001405). base_restrict of
-- standard_tableaux — the carrier is the row-word (row_word[i] = 0-based row of entry i), so "≤2 rows" is simply
-- "no entry lands in row ≥2".

CREATE FUNCTION is_two_row_tableau(t standard_tableau) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((t).row_word) r WHERE r > 1) $$;

-- direct unrank: the row-word is a binary ballot sequence — margin = (#row0 so far) − (#row1 so far), starting 0,
-- never negative (placing a 1 needs margin ≥ 1), free-ending (any margin ≥ 0 at the end is a valid ≤2-row shape).
-- g(m,s) = # of valid length-m completions from margin s: g(m,s) = 2^m once s ≥ m (every remaining choice is safe —
-- margin can't be driven negative even by an all-1s tail), else g(m,s) = g(m-1,s+1) + g(m-1,s-1) (s≥1). Bottom-up
-- table over m=0..n, s=0..n (s never exceeds steps-taken-so-far ≤ n-1, so this bound is never touched at read time).
-- Ascending lex prefers 0 (extend row0, margin+1) first — 0 is always legal, so try it, else fall to 1.
CREATE FUNCTION syt_two_row_unrank(f standard_tableaux_fiber, rank rank_index) RETURNS standard_tableau LANGUAGE plpgsql IMMUTABLE AS $fu$
  DECLARE n int := (f).size::int; T numeric[]; w int[] := '{}'; margin int := 0; r numeric := rank;
          c0 numeric; m int; s int; i int; BEGIN
    IF n = 0 THEN RETURN ROW('{}'::int[])::standard_tableau; END IF;
    T := array_fill(0::numeric, ARRAY[n + 1, n + 1]);           -- T[m+1][s+1] = g(m,s), m=0..n, s=0..n
    FOR m IN 0..n LOOP
      FOR s IN 0..n LOOP
        IF s >= m THEN
          T[m + 1][s + 1] := 2::numeric ^ m;
        ELSE
          T[m + 1][s + 1] := T[m][s + 2] + (CASE WHEN s >= 1 THEN T[m][s] ELSE 0 END);
        END IF;
      END LOOP;
    END LOOP;
    FOR i IN 1..n LOOP
      m := n - i;                                              -- remaining steps after this one
      c0 := T[m + 1][margin + 2];                               -- completions if we extend row0 now (margin+1)
      IF r < c0 THEN
        w := w || 0; margin := margin + 1;
      ELSE
        r := r - c0; w := w || 1; margin := margin - 1;
      END IF;
    END LOOP;
    RETURN ROW(w)::standard_tableau;
  END $fu$;

SELECT base_restrict('syt_two_row', 'standard_tableaux', 'is_two_row_tableau', unrank_fn => 'syt_two_row_unrank');
CREATE FUNCTION fiber_symbol(f syt_two_row_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'SYT₂ᵣ(' || (f).size::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('syt_two_row');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('syt_two_row','count = central binomial C(n,⌊n/2⌋) for n=0..8: 1,1,2,3,6,10,20,35,70','eq','1,1,2,3,6,10,20,35,70','SYT in ≤2 rows (A001405)',$q$
    SELECT string_agg(cardinality(syt_two_row(n))::text, ',' ORDER BY n) FROM generate_series(0,8) n $q$),
  ('syt_two_row','syt_two_row(3) enumerated (1/2/3 dropped: 3 rows)','eq','1,2,3 | 1,2/3 | 1,3/2','the 3 tableaux of size 3 in ≤2 rows (row entries comma-joined, tableaux pipe-joined)',$q$
    SELECT string_agg(notation((e).value), ' | ' ORDER BY ordinality(e)) FROM elements(syt_two_row(3)) e $q$),
  ('syt_two_row','no element uses a third row (n=0..7)','eq','true','the shape invariant across the floor',$q$
    SELECT bool_and(is_two_row_tableau((e).value)) FROM elements(syt_two_row(0,7)) e $q$),
  ('syt_two_row','contains via <@: 12/3 ∈, 1/2/3 ∉ (three rows)','eq','true|false','derived membership = parent ∧ ≤2 rows',$q$
    SELECT (ROW(ARRAY[0,0,1])::standard_tableau <@ syt_two_row(3))::text || '|' ||
           (ROW(ARRAY[0,1,2])::standard_tableau <@ syt_two_row(3))::text $q$),
  ('syt_two_row','fiber_unrank(syt_two_row(6), 0..19) are all members (accel floor)','eq','true','the free-ending ballot DP unrank lands inside the C(6,3)=20 fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(syt_two_row(6)) f), ord::rank_index) <@ syt_two_row(6))::text
      FROM generate_series(0, cardinality(syt_two_row(6))::int - 1) ord $q$);
