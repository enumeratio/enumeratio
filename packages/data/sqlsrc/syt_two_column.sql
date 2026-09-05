-- requires: standard_tableaux, realizer, utilities
-- syt_two_column — standard Young tableaux with n cells in AT MOST TWO COLUMNS (every row length ≤ 2). The
-- conjugate (transpose) family of syt_two_row, so equinumerous: C(n,⌊n/2⌋), 1,1,2,3,6,10,20,35,70 for n=0..8
-- (A001405). base_restrict of standard_tableaux — on the row-word carrier, "≤2 columns" is "no row holds >2 entries"
-- (row r's length = how many entries carry row index r).

CREATE FUNCTION is_two_column_tableau(t standard_tableau) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((t).row_word) r GROUP BY r HAVING count(*) > 2) $$;

SELECT base_restrict('syt_two_column', 'standard_tableaux', 'is_two_column_tableau');
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
           (ROW(ARRAY[0,0,0])::standard_tableau <@ syt_two_column(3))::text $q$);
