-- requires: integer_compositions, fibonacci, realizer
-- step_compositions — ported from pg-enumeratio-core_old_backup/sqlsrc/step-compositions.sql. Compositions of n
-- into parts from {1,2} only ("step compositions": climb a staircase of n stairs taking 1- or 2-steps).
-- |step_compositions(n)| = Fibonacci(n+1) (A000045): 1,1,2,3,5,8,13,21,34,55,89,… for n=0,1,2,….
--
-- base_restrict of integer_compositions (carrier `composition`, ordered positive parts summing to n): filter the
-- parent's gap-cut floor down to the 1/2-only parts. The old file hand-authored its own count/lex-rank/lex-unrank
-- engines (Fibonacci recurrence + a bespoke lex order); the new architecture gets count + re-ranking for free from
-- base_restrict, reusing the parent's mask-order floor — no bespoke engines needed.

CREATE FUNCTION is_step_composition(v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((v).parts) p WHERE p NOT IN (1, 2)) $$;   -- empty composition qualifies vacuously

-- accel hook (#172): |step_compositions(n)| = F(n+1) (A000045), uniformly including n=0 (F(1)=1, the vacuous case).
CREATE FUNCTION step_composition_count(f integer_compositions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT fibonacci_term((f).n::int + 1) $$;

SELECT base_restrict('step_compositions', 'integer_compositions', 'is_step_composition', count_fn => 'step_composition_count');

CREATE FUNCTION fiber_symbol(f step_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'SCom(' || (f).n::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('step_compositions');


-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('step_compositions','cardinality anchor = Fibonacci(n+1) for n=1..10','eq','1,2,3,5,8,13,21,34,55,89','1/2-step compositions counted by Fibonacci (A000045)',$q$
    SELECT string_agg(cardinality(step_compositions(n))::text, ',' ORDER BY n) FROM generate_series(1,10) n $q$),

  ('step_compositions','n=0 ⇒ one empty composition (F(1)=1)','eq','1','the vacuous base case',$q$
    SELECT cardinality(step_compositions(0))::text $q$),

  ('step_compositions','|step_compositions(6)| = 13','eq','13','Fibonacci(7) = 13',$q$
    SELECT cardinality(step_compositions(6))::text $q$),

  ('step_compositions','step compositions of 4, parent mask order','eq','2+2,1+1+2,1+2+1,2+1+1,1+1+1+1','5 = F(5), filtered from the parent floor and re-ranked',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(step_compositions(4)) e $q$),

  ('step_compositions','every part of every composition of 7 is 1 or 2','eq','true','the defining invariant across the whole fiber',$q$
    SELECT bool_and(NOT EXISTS (SELECT 1 FROM unnest(((e).value).parts) p WHERE p NOT IN (1,2)))::text
      FROM elements(step_compositions(7)) e $q$),

  ('step_compositions','every step composition of 8 sums to 8','eq','true','parts always sum to n',$q$
    SELECT bool_and((SELECT coalesce(sum(p),0) FROM unnest(((e).value).parts) p) = 8)::text FROM elements(step_compositions(8)) e $q$),

  ('step_compositions','unrank/rank round-trip over the whole fiber for n=6','eq','true','rank(unrank(r)) = r for every r in the re-ranked fiber',$q$
    SELECT bool_and(ordinality(unrank(step_compositions(6), r)) = r)::text
      FROM generate_series(0, (cardinality(step_compositions(6)) - 1)::int) r $q$),

  ('step_compositions','contains via <@: 1+2+1 ∈ step_compositions(4), 3+1 ∉ (has a 3)','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[1,2,1])::composition <@ step_compositions(4))::text || '|' ||
           (ROW(ARRAY[3,1])::composition <@ step_compositions(4))::text $q$);
