-- requires: realizer, utilities
-- collatz_trajectories(n) — the Collatz (3n+1) trajectory of n, AS A WORD: the sequence n = a₀, a₁, …, a_k = 1
-- (aᵢ even ⇒ aᵢ₊₁=aᵢ/2, aᵢ odd ⇒ aᵢ₊₁=3aᵢ+1), graded by n. Each grade's fiber is a SINGLETON — there is exactly
-- one trajectory per n — so fiber_count ≡ 1 is a genuine (trivial) closed form, selfcert-worthy. Fresh carrier:
-- a variable-length int sequence isn't any existing carrier's shape.
CREATE TYPE collatz_trajectory AS (terms int[]);
CREATE FUNCTION notation(t collatz_trajectory) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string((t).terms, '→') $$;

-- the trajectory itself (capped — the conjecture is unproven, but every n this collection is used at converges
-- long before the cap; the guard just keeps a pathological input from looping forever).
CREATE FUNCTION collatz_sequence(n int) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE v int := n; seq int[] := ARRAY[n]; steps int := 0; BEGIN
    IF n < 1 THEN RETURN NULL; END IF;
    WHILE v <> 1 LOOP
      IF v % 2 = 0 THEN v := v / 2; ELSE v := 3 * v + 1; END IF;
      seq := seq || v; steps := steps + 1;
      EXIT WHEN steps > 100000;   -- safety guard, not reached by any n this collection realizes
    END LOOP;
    RETURN seq;
  END $$;
CREATE FUNCTION collatz_valid(terms int[]) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE i int; BEGIN
    IF coalesce(array_length(terms,1),0) < 1 OR terms[array_length(terms,1)] <> 1 THEN RETURN false; END IF;
    FOR i IN 1..array_length(terms,1)-1 LOOP
      IF terms[i] % 2 = 0 THEN
        IF terms[i+1] <> terms[i] / 2 THEN RETURN false; END IF;
      ELSE
        IF terms[i+1] <> 3 * terms[i] + 1 THEN RETURN false; END IF;
      END IF;
    END LOOP;
    RETURN true;
  END $$;

CREATE TYPE collatz_trajectories_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f collatz_trajectories_fiber, element_limit int) RETURNS SETOF collatz_trajectory LANGUAGE sql STABLE AS $$
  SELECT ROW(collatz_sequence((f).n::int))::collatz_trajectory WHERE (f).n::int >= 1 LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f collatz_trajectories_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).n::int >= 1 THEN 1 ELSE 0 END $$;   -- exactly one trajectory per n≥1, none at n=0
CREATE FUNCTION contains_in_fiber(f collatz_trajectories_fiber, v collatz_trajectory) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).terms,1),0) >= 1 AND (v).terms[1] = (f).n::int AND collatz_valid((v).terms) $$;

INSERT INTO base_collection VALUES ('collatz_trajectories', 'collatz_trajectory');
INSERT INTO base_grade VALUES ('collatz_trajectories', 1, 'n', '1', NULL);
CREATE FUNCTION fiber_symbol(f collatz_trajectories_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Collatz(' || (f).n::int || ')' $$;
SELECT base_realize('collatz_trajectories');

-- ── stats: stopping time (step count to reach 1), peak (max value reached) ─────────────────────────────
CREATE FUNCTION collatz_trajectories_stopping_time(t collatz_trajectory) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((t).terms,1),1) - 1 $$;
CREATE FUNCTION collatz_trajectories_peak(t collatz_trajectory) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT (SELECT max(x) FROM unnest((t).terms) x) $$;
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('collatz_trajectories','stopping_time','collatz_trajectories_stopping_time','Stopping time (steps to reach 1)','natural_numbers'),
  ('collatz_trajectories','peak','collatz_trajectories_peak','Peak value reached','natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('collatz_trajectories','the trajectory of 6: 6→3→10→5→16→8→4→2→1','eq','6→3→10→5→16→8→4→2→1',NULL,$q$
    SELECT notation((unrank(collatz_trajectories(6), 0)).value) $q$),
  ('collatz_trajectories','the trajectory of 27 has stopping time 111 and peak 9232 (a classic long/high example)','eq','111|9232',NULL,$q$
    SELECT collatz_trajectories_stopping_time((unrank(collatz_trajectories(27), 0)).value)::text || '|'
        || collatz_trajectories_peak((unrank(collatz_trajectories(27), 0)).value)::text $q$),
  ('collatz_trajectories','every fiber n=1..500 is a singleton (fiber_count ≡ 1)','eq','true',NULL,$q$
    SELECT bool_and(cardinality(collatz_trajectories(n)) = 1) FROM generate_series(1,500) n $q$),
  ('collatz_trajectories','stopping time of 1 is 0 (already at 1)','eq','0',NULL,$q$
    SELECT collatz_trajectories_stopping_time((unrank(collatz_trajectories(1), 0)).value)::text $q$),
  ('collatz_trajectories','every trajectory for n=1..1000 is collatz-valid and ends at 1','eq','true','the defining invariant',$q$
    SELECT bool_and(collatz_valid(((e).value).terms))
    FROM generate_series(1,1000) n, LATERAL elements(collatz_trajectories(n)) e $q$),
  ('collatz_trajectories','contains: the real trajectory of 6 ∈, a broken one ∉','eq','true|false',NULL,$q$
    SELECT (ROW(ARRAY[6,3,10,5,16,8,4,2,1])::collatz_trajectory <@ collatz_trajectories(6))::text || '|'
        || (ROW(ARRAY[6,3,9,5,16,8,4,2,1])::collatz_trajectory <@ collatz_trajectories(6))::text $q$);
