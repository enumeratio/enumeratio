-- requires: standard_tableaux, realizer, utilities
-- syt_two_column — standard Young tableaux with n cells in AT MOST TWO COLUMNS (every row length ≤ 2). The
-- conjugate (transpose) family of syt_two_row, so equinumerous: C(n,⌊n/2⌋), 1,1,2,3,6,10,20,35,70 for n=0..8
-- (A001405). base_restrict of standard_tableaux — on the row-word carrier, "≤2 columns" is "no row holds >2 entries"
-- (row r's length = how many entries carry row index r).

CREATE FUNCTION is_two_column_tableau(t standard_tableau) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((t).row_word) r GROUP BY r HAVING count(*) > 2) $$;

-- direct unrank: with every row capped at length ≤2, each row is either OPEN (count=1, awaiting a second entry) or
-- CLOSED (count=2). The shape invariant (row r extendable only while counts[r] < counts[r-1]) forces only the
-- OLDEST open row (smallest index) closable at any time — the rest are blocked behind it — so open rows form a
-- FIFO queue. At each step: CLOSE the front of the queue (a strictly smaller row index than any fresh row) if one
-- is open, or OPEN a fresh row (index = total rows started so far) otherwise. Ascending lex prefers the smaller
-- index, i.e. CLOSE-before-OPEN whenever a close is available — the mirror preference of syt_two_row, but the same
-- free-ending g(m,s) completions table (s = # open rows, an margin-like quantity with identical recurrence).
CREATE FUNCTION syt_two_column_unrank(f standard_tableaux_fiber, rank rank_index) RETURNS standard_tableau LANGUAGE plpgsql IMMUTABLE AS $fu$
  DECLARE n int := (f).size::int; T numeric[]; w int[] := '{}'; queue int[] := '{}'; rows_opened int := 0;
          r numeric := rank; c_close numeric; m int; s int; i int; o int; BEGIN
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
      o := coalesce(array_length(queue, 1), 0);
      c_close := CASE WHEN o >= 1 THEN T[m + 1][o] ELSE 0 END;   -- completions if we close the front now (o-1)
      IF o >= 1 AND r < c_close THEN
        w := w || queue[1];
        queue := queue[2 : array_length(queue, 1)];
      ELSE
        IF o >= 1 THEN r := r - c_close; END IF;
        w := w || rows_opened;
        queue := queue || rows_opened;
        rows_opened := rows_opened + 1;
      END IF;
    END LOOP;
    RETURN ROW(w)::standard_tableau;
  END $fu$;

SELECT base_restrict('syt_two_column', 'standard_tableaux', 'is_two_column_tableau', unrank_fn => 'syt_two_column_unrank');
CREATE FUNCTION fiber_symbol(f syt_two_column_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'SYT₂꜀(' || (f).size::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('syt_two_column');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('syt_two_column','count = central binomial C(n,⌊n/2⌋) for n=0..8: 1,1,2,3,6,10,20,35,70','eq','1,1,2,3,6,10,20,35,70','SYT in ≤2 columns, the conjugate of syt_two_row (A001405)',$q$
    SELECT string_agg(cardinality(syt_two_column(n))::text, ',' ORDER BY n) FROM generate_series(0,8) n $q$),
  ('syt_two_column','syt_two_column(3) enumerated (1,2,3 dropped: a row of 3)','eq','1,2/3 | 1,3/2 | 1/2/3','the 3 tableaux of size 3 in ≤2 columns (row entries comma-joined, tableaux pipe-joined)',$q$
    SELECT string_agg(notation((e).value), ' | ' ORDER BY ordinality(e)) FROM elements(syt_two_column(3)) e $q$),
  ('syt_two_column','no element has a row longer than 2 (n=0..7)','eq','true','the shape invariant across the floor',$q$
    SELECT bool_and(is_two_column_tableau((e).value)) FROM elements(syt_two_column(0,7)) e $q$),
  ('syt_two_column','contains via <@: 12/3 ∈, 123 ∉ (a row of length 3)','eq','true|false','derived membership = parent ∧ ≤2 columns',$q$
    SELECT (ROW(ARRAY[0,0,1])::standard_tableau <@ syt_two_column(3))::text || '|' ||
           (ROW(ARRAY[0,0,0])::standard_tableau <@ syt_two_column(3))::text $q$),
  ('syt_two_column','fiber_unrank(syt_two_column(6), 0..19) are all members (accel floor)','eq','true','the FIFO close-before-open DP unrank lands inside the C(6,3)=20 fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(syt_two_column(6)) f), ord::rank_index) <@ syt_two_column(6))::text
      FROM generate_series(0, cardinality(syt_two_column(6))::int - 1) ord $q$);
