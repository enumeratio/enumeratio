-- requires: integer_compositions, realizer
-- carlitz_compositions — compositions of n with NO TWO ADJACENT PARTS EQUAL (Carlitz compositions), A003242:
-- 1,1,1,3,4,7,14,23,39,... for n=0,1,2,3,4,5,6,7,8. A base_restrict of integer_compositions: same carrier
-- (composition) + grade chain [n], floor = the parent's gap-cut floor filtered by the no-equal-neighbors
-- predicate (realizer re-ranks within the filtered fiber).

-- ── predicate ────────────────────────────────────────────────────────────────────────────────────────
-- no index i>1 with parts[i] = parts[i-1]; the empty and single-part compositions vacuously qualify.
CREATE FUNCTION is_carlitz_composition(v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_subscripts((v).parts, 1) i WHERE i > 1 AND (v).parts[i] = (v).parts[i-1]) $$;

-- ── derive + realize ─────────────────────────────────────────────────────────────────────────────────
SELECT base_restrict('carlitz_compositions', 'integer_compositions', 'is_carlitz_composition');
CREATE FUNCTION fiber_symbol(f carlitz_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'CC(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('carlitz_compositions');


-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('carlitz_compositions','A003242 count anchor n=1..7: 1,1,3,4,7,14,23','eq','1,1,3,4,7,14,23','compositions of n with no equal adjacent parts',$q$
    SELECT string_agg(cardinality(carlitz_compositions(n))::text, ',' ORDER BY n) FROM generate_series(1,7) n $q$),
  ('carlitz_compositions','n=0 gives the single empty composition','eq','1','the vacuous base case',$q$
    SELECT cardinality(carlitz_compositions(0))::text $q$),
  ('carlitz_compositions','carlitz compositions of 4 in mask order: 4,1+3,3+1,1+2+1','eq','4,1+3,3+1,1+2+1','filtered floor: 2+2, 1+1+2, 2+1+1, 1+1+1+1 excluded',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(carlitz_compositions(4)) e $q$),
  ('carlitz_compositions','no element of any fiber has two equal adjacent parts','eq','true','the defining invariant, checked across n=0..7',$q$
    SELECT bool_and(is_carlitz_composition((e).value)) FROM elements(carlitz_compositions(0,7)) e $q$),
  ('carlitz_compositions','fiber = (n) named axis','eq','4','single grade, borrowed from the parent chain',$q$
    SELECT (unrank(carlitz_compositions(4), 0)).fiber.n::text $q$),
  ('carlitz_compositions','contains: 1+2+1 ∈ carlitz(4), 2+2 ∉','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[1,2,1])::composition <@ carlitz_compositions(4))::text || '|' ||
           (ROW(ARRAY[2,2])::composition <@ carlitz_compositions(4))::text $q$);
