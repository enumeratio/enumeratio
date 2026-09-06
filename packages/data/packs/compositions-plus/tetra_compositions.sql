-- requires: integer_compositions, realizer
-- ported from pg-enumeratio-core_old_backup/sqlsrc/tetra-compositions.sql
-- tetra_compositions — compositions of n into parts from {1,2,3,4} (ordered sums, order matters). Counted by the
-- Tetranacci numbers: |tetra_compositions(n)| = 1,2,4,8,15,29,56,108,… for n=1..8 (A000078). base_restrict of
-- integer_compositions (carrier `composition`, ordered positive parts, gap-cut floor): filter the parent's floor
-- down to compositions whose every part is ≤ 4 (a positive part summing with others to n is automatically ≥ 1,
-- so the predicate only needs to police the upper bound).

CREATE FUNCTION is_tetra_composition(v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((v).parts) p WHERE p > 4) $$;   -- empty composition qualifies vacuously

-- accel hook (#172): Tetranacci a(n)=a(n-1)+a(n-2)+a(n-3)+a(n-4), a(0)=1 (rolling 4-term recurrence, same style
-- as fibonacci_term / tri_compositions' tribonacci_composition_count).
CREATE FUNCTION tetra_composition_count(f integer_compositions_fiber) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := (f).n::int; w numeric := 0; x numeric := 0; y numeric := 0; z numeric := 1; nxt numeric; i int; BEGIN
    IF n < 0 THEN RETURN 0; END IF;
    IF n = 0 THEN RETURN 1; END IF;
    FOR i IN 1..n LOOP nxt := w + x + y + z; w := x; x := y; y := z; z := nxt; END LOOP;
    RETURN z;
  END $$;

SELECT base_restrict('tetra_compositions', 'integer_compositions', 'is_tetra_composition', count_fn => 'tetra_composition_count');

CREATE FUNCTION fiber_symbol(f tetra_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'TetCom(' || (f).n::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('tetra_compositions');


-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('tetra_compositions','cardinality anchor is Tetranacci(n) for n=1..8 — A000078','eq','1,2,4,8,15,29,56,108','compositions into parts from {1,2,3,4}',$q$
    SELECT string_agg(cardinality(tetra_compositions(n))::text, ',' ORDER BY n) FROM generate_series(1,8) n $q$),
  ('tetra_compositions','n=0 ⇒ one empty composition','eq','1','the vacuous base case',$q$
    SELECT cardinality(tetra_compositions(0))::text $q$),
  ('tetra_compositions','n=4: every composition of 4 already has parts ≤ 4, so all 8 survive','eq','8','no part can exceed the whole sum',$q$
    SELECT cardinality(tetra_compositions(4))::text $q$),
  ('tetra_compositions','compositions of 4 into parts from {1,2,3,4}, parent mask order','eq','4,1+3,2+2,1+1+2,3+1,1+2+1,2+1+1,1+1+1+1','8 = Tetranacci(4), filtered from the parent floor',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(tetra_compositions(4)) e $q$),
  ('tetra_compositions','every part of every composition of 8 is in {1,2,3,4}','eq','true','the defining invariant across the whole fiber',$q$
    SELECT bool_and(NOT EXISTS (SELECT 1 FROM unnest(((e).value).parts) p WHERE p < 1 OR p > 4))::text
      FROM elements(tetra_compositions(8)) e $q$),
  ('tetra_compositions','every composition of 8 sums to 8','eq','true','the parts always sum back to n',$q$
    SELECT bool_and((SELECT coalesce(sum(p),0) FROM unnest(((e).value).parts) p) = 8)::text
      FROM elements(tetra_compositions(8)) e $q$),
  ('tetra_compositions','contains via <@: 3+1 ∈ tetra_compositions(4), 5+1 ∉ (has a 5)','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[3,1])::composition <@ tetra_compositions(4))::text || '|' ||
           (ROW(ARRAY[5,1])::composition <@ tetra_compositions(4))::text $q$),
  ('tetra_compositions','range handle: fibers(tetra_compositions(1,4)) unfold to n = 1,2,3,4','eq','1,2,3,4','the grade ranges',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(tetra_compositions(1,4)) f $q$);
