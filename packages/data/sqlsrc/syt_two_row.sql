-- requires: standard_tableaux, realizer, utilities
-- syt_two_row — standard Young tableaux with n cells in AT MOST TWO ROWS (shapes λ = (a,b), a≥b). Count =
-- C(n, ⌊n/2⌋), the central binomial coefficients: 1,1,2,3,6,10,20,35,70 for n=0..8 (A001405). base_restrict of
-- standard_tableaux — the carrier is the row-word (row_word[i] = 0-based row of entry i), so "≤2 rows" is simply
-- "no entry lands in row ≥2".

CREATE FUNCTION is_two_row_tableau(t standard_tableau) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((t).row_word) r WHERE r > 1) $$;

SELECT base_restrict('syt_two_row', 'standard_tableaux', 'is_two_row_tableau');
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
           (ROW(ARRAY[0,1,2])::standard_tableau <@ syt_two_row(3))::text $q$);
