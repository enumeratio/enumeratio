-- requires: realizer
-- bell_numbers — the UNGRADED / infinite case (a numeric SEQUENCE), like fibonacci/prime_numbers. B(n) counts
-- the set partitions of [n], so the floor value at rank n equals cardinality(set_partitions(n)) (verified below).
-- No grades ⇒ one empty-address fiber; unbounded ⇒ cardinality = ∞. Carrier numeric. The floor walks the Bell
-- triangle (each row starts with the tail of the previous; a[j] = a[j-1] + prev[j-1]) in exact numeric, emitting
-- B(0),B(1),… once per row — O(window²) total, not a per-term rebuild. Anchor: 1,1,2,5,15,52,203,877 (n=0..7).

CREATE TYPE bell_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
-- the FLOOR: B(0),B(1),…,B(element_limit-1) in order, one row of the Bell triangle per emission.
CREATE FUNCTION fiber_elements(f bell_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE plpgsql STABLE AS $$
  DECLARE cur numeric[] := ARRAY[1::numeric]; nxt numeric[]; i int; j int;
  BEGIN
    IF element_limit < 1 THEN RETURN; END IF;
    RETURN NEXT cur[1];                                                                -- B(0) = 1
    FOR i IN 2..element_limit LOOP                                                      -- B(1) .. B(element_limit-1)
      nxt := ARRAY[cur[array_length(cur,1)]];
      FOR j IN 1..array_length(cur,1) LOOP nxt := nxt || (nxt[j] + cur[j]); END LOOP;
      cur := nxt; RETURN NEXT cur[1];
    END LOOP;
  END $$;
-- membership: walk the Bell triangle emitting B(0),B(1),… until a row's Bell number meets v (∈) or passes it (∉).
CREATE FUNCTION contains_in_fiber(f bell_numbers_fiber, v numeric) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE cur numeric[] := ARRAY[1::numeric]; nxt numeric[]; b numeric := 1; j int;   -- b = current row's Bell number
  BEGIN
    IF v < 1 THEN RETURN false; END IF;                                                -- Bell numbers are ≥ 1
    LOOP
      IF b = v THEN RETURN true; END IF;
      IF b > v THEN RETURN false; END IF;                                              -- overshot ⇒ not a Bell number
      nxt := ARRAY[cur[array_length(cur,1)]];                                          -- next row starts with the tail
      FOR j IN 1..array_length(cur,1) LOOP nxt := nxt || (nxt[j] + cur[j]); END LOOP;
      cur := nxt; b := cur[1];
    END LOOP;
  END $$;

INSERT INTO base_collection VALUES ('bell_numbers', 'numeric', true);                   -- unbounded, ungraded
SELECT base_realize('bell_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('bell_numbers','first terms via the realized floor','eq','1,1,2,5,15,52,203,877','elements over the one infinite fiber (n=0..7)',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(bell_numbers(), 8) e $q$),
  ('bell_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(bell_numbers()) f LIMIT 1) FROM fibers(bell_numbers()) $q$),
  ('bell_numbers','unrank(7) = 877 (the 8th Bell number)','eq','877','off the floor',$q$
    SELECT (unrank(bell_numbers(), 7)).value::text $q$),
  ('bell_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(bell_numbers())::text $q$),
  ('bell_numbers','contains is rank-agnostic: 52 ∈, 4 ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (52::numeric <@ bell_numbers())::text || '|' || (4::numeric <@ bell_numbers())::text $q$),
  ('bell_numbers','B(n) = |set_partitions(n)|: agreement for n=0..6','eq','true','the floor value IS the set-partition count',$q$
    SELECT bool_and((unrank(bell_numbers(), n)).value = cardinality(set_partitions(n)))::text FROM generate_series(0,6) n $q$);
