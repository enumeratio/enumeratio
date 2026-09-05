-- requires: standard_tableaux, realizer, utilities
-- syt_hook_shape — standard Young tableaux of HOOK shape λ = (a, 1ᵇ): a first row of any length, every other row a
-- single cell. Summing f^λ over the size-n hooks gives Σ_{b} C(n-1,b) = 2^{n-1} (with n=0 ↦ 1): 1,1,2,4,8,16,32,64,128
-- for n=0..8 (A011782). base_restrict of standard_tableaux — on the row-word carrier a hook is exactly "every row
-- other than the first holds a single entry" (rows are automatically nonincreasing in length, so this forces (a,1ᵇ)).

CREATE FUNCTION is_hook_tableau(t standard_tableau) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((t).row_word) r WHERE r >= 1 GROUP BY r HAVING count(*) > 1) $$;

SELECT base_restrict('syt_hook_shape', 'standard_tableaux', 'is_hook_tableau');
CREATE FUNCTION fiber_symbol(f syt_hook_shape_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'SYTₕ(' || (f).size::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('syt_hook_shape');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('syt_hook_shape','count = 2^{n-1} for n=0..8: 1,1,2,4,8,16,32,64,128','eq','1,1,2,4,8,16,32,64,128','SYT of hook shape (A011782)',$q$
    SELECT string_agg(cardinality(syt_hook_shape(n))::text, ',' ORDER BY n) FROM generate_series(0,8) n $q$),
  ('syt_hook_shape','every size-3 tableau is a hook (shapes (3),(2,1),(1³) are all hooks)','eq','1,2,3 | 1,2/3 | 1,3/2 | 1/2/3','hook(3) = the full standard_tableaux(3) (row entries comma-joined, tableaux pipe-joined)',$q$
    SELECT string_agg(notation((e).value), ' | ' ORDER BY ordinality(e)) FROM elements(syt_hook_shape(3)) e $q$),
  ('syt_hook_shape','size 4 drops the two (2,2) tableaux: 8 of the 10','eq','8','2^3; the non-hook shape (2,2) has f=2',$q$
    SELECT cardinality(syt_hook_shape(4))::text $q$),
  ('syt_hook_shape','contains via <@: the hook 123/4 ∈, the square 12/34 ∉','eq','true|false','derived membership = parent ∧ hook shape',$q$
    SELECT (ROW(ARRAY[0,0,0,1])::standard_tableau <@ syt_hook_shape(4))::text || '|' ||
           (ROW(ARRAY[0,0,1,1])::standard_tableau <@ syt_hook_shape(4))::text $q$);
