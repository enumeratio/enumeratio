-- requires: integer_compositions, realizer
-- fibonacci_compositions — compositions of n into parts of size 1 or 2 only. Counted by the Fibonacci numbers:
-- |fibonacci_compositions(n)| = F(n+1), giving 1,1,2,3,5,8,13 for n=0..6. base_restrict of integer_compositions
-- (carrier `composition`, ordered positive parts): filter the parent's gap-cut floor down to the 1/2-only parts.

CREATE FUNCTION is_fibonacci_composition(v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((v).parts) p WHERE p NOT IN (1, 2)) $$;   -- empty composition qualifies vacuously

SELECT base_restrict('fibonacci_compositions', 'integer_compositions', 'is_fibonacci_composition');


-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('fibonacci_compositions','cardinality anchor = F(n+1) for n=1..6','eq','1,2,3,5,8,13','1/2-compositions counted by Fibonacci',$q$
    SELECT string_agg(cardinality(fibonacci_compositions(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n $q$),
  ('fibonacci_compositions','n=0 ⇒ one empty composition (F(1)=1)','eq','1','the vacuous base case',$q$
    SELECT cardinality(fibonacci_compositions(0))::text $q$),
  ('fibonacci_compositions','compositions of 4 into 1s and 2s, parent mask order','eq','2+2,1+1+2,1+2+1,2+1+1,1+1+1+1','5 = F(5), filtered from the parent floor',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(fibonacci_compositions(4)) e $q$),
  ('fibonacci_compositions','every part of every composition of 6 is 1 or 2','eq','true','the defining invariant across the whole fiber',$q$
    SELECT bool_and(NOT EXISTS (SELECT 1 FROM unnest(((e).value).parts) p WHERE p NOT IN (1,2)))::text
      FROM elements(fibonacci_compositions(6)) e $q$),
  ('fibonacci_compositions','contains via <@: 1+2+1 ∈ fibonacci_compositions(4), 3+1 ∉ (has a 3)','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[1,2,1])::composition <@ fibonacci_compositions(4))::text || '|' ||
           (ROW(ARRAY[3,1])::composition <@ fibonacci_compositions(4))::text $q$);
