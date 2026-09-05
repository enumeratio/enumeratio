-- requires: parking_functions, integer_partitions, realizer, utilities
-- parking_functions statistics + one map. Carrier parking_function(spots int[]) = the preference sequence (car i
-- prefers spots[i]); cars enter in order and park at the next free spot at or after their preference. Stats:
-- preference_sum (Σ a_i), prefers_first (#cars preferring spot 1), displacement (Σ over cars of parked-preferred,
-- = n(n+1)/2 - preference_sum), lucky_cars (#cars that get their exact preferred spot), descents (#{ i : a_i>a_{i+1}}),
-- max_preference (max a_i), distinct_preferences (#distinct values), ties (Σ C(freq,2), pairs of cars sharing a
-- preference). Map: content = the preference multiset as a non-increasing integer partition. Expected values for
-- the original five stats derived in sage via ParkingFunctions(n) (jump()=displacement, len(lucky_cars())=lucky_cars)
-- and an independent parking simulation; max_preference/distinct_preferences/ties are hand-verified by direct
-- enumeration of parking_functions(2) and parking_functions(3) in rank order (no sage/findstat source).

-- ── statistics (carrier parking_function) ───────────────────────────────────────────────────────────────
CREATE FUNCTION parking_functions_preference_sum(p parking_function) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT sum(x) FROM unnest((p).spots) x), 0)::int $$;

CREATE FUNCTION parking_functions_prefers_first(p parking_function) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((p).spots) x WHERE x = 1 $$;                 -- ≥1 always (min preference is 1)

CREATE FUNCTION parking_functions_descents(p parking_function) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).spots, 1) i
   WHERE i < array_length((p).spots, 1) AND (p).spots[i] > (p).spots[i+1] $$;

-- displacement: run the parking process (car i drives to a_i, advances to the next free spot) and total how far
-- each car overshoots its preference. Equals n(n+1)/2 − Σ a_i, but computed here directly by simulation.
CREATE FUNCTION parking_functions_displacement(p parking_function) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).spots, 1), 0);
          occ boolean[] := array_fill(false, ARRAY[greatest(n, 1)]);
          total int := 0; i int; a int; s int;
  BEGIN
    FOR i IN 1..n LOOP
      a := (p).spots[i]; s := a;
      WHILE occ[s] LOOP s := s + 1; END LOOP;                                   -- next free spot at/after preference
      occ[s] := true; total := total + (s - a);
    END LOOP;
    RETURN total;
  END $$;

-- lucky cars: the number of cars that park in exactly their preferred spot (displacement 0 for that car). Car 1 is
-- always lucky, so this is ≥1 for n≥1.
CREATE FUNCTION parking_functions_lucky_cars(p parking_function) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).spots, 1), 0);
          occ boolean[] := array_fill(false, ARRAY[greatest(n, 1)]);
          lucky int := 0; i int; a int; s int;
  BEGIN
    FOR i IN 1..n LOOP
      a := (p).spots[i]; s := a;
      WHILE occ[s] LOOP s := s + 1; END LOOP;
      occ[s] := true;
      IF s = a THEN lucky := lucky + 1; END IF;
    END LOOP;
    RETURN lucky;
  END $$;

-- max preference: the highest spot any car asks for.
CREATE FUNCTION parking_functions_max_preference(p parking_function) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(x) FROM unnest((p).spots) x), 0)::int $$;

-- distinct preferences: how many different spots appear in the preference sequence (1 = every car wants the same
-- spot, n = all preferences distinct).
CREATE FUNCTION parking_functions_distinct_preferences(p parking_function) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(DISTINCT x)::int FROM unnest((p).spots) x $$;

-- ties: number of unordered pairs of cars sharing a preference, Σ C(freq,2) over each spot's frequency. 0 iff
-- every preference is distinct; not simply n − distinct_preferences (a run of m equal preferences contributes
-- C(m,2), not m−1).
CREATE FUNCTION parking_functions_ties(p parking_function) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(c * (c - 1) / 2), 0)::int
  FROM (SELECT count(*) c FROM unnest((p).spots) x GROUP BY x) t $$;

-- ── map (parking_functions → integer_partitions) ────────────────────────────────────────────────────────
-- content: the multiset of preferences read as a non-increasing partition (values in [1,n], so always a valid
-- partition). Rearrangement-invariant; records how many cars prefer each spot. Σ parts = preference_sum, #parts = n.
CREATE FUNCTION parking_functions_content(p parking_function) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT x FROM unnest((p).spots) x ORDER BY x DESC))::integer_partition $$;

-- ── register ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('parking_functions','preference_sum','parking_functions_preference_sum','Sum of preferences','natural_numbers'),
  ('parking_functions','prefers_first','parking_functions_prefers_first','Cars preferring the first spot','natural_numbers'),
  ('parking_functions','displacement','parking_functions_displacement','Total displacement','natural_numbers'),
  ('parking_functions','lucky_cars','parking_functions_lucky_cars','Number of lucky cars','natural_numbers'),
  ('parking_functions','descents','parking_functions_descents','Descents','natural_numbers'),
  ('parking_functions','max_preference','parking_functions_max_preference','Max preference','natural_numbers'),
  ('parking_functions','distinct_preferences','parking_functions_distinct_preferences','Distinct preferences','natural_numbers'),
  ('parking_functions','ties','parking_functions_ties','Ties (repeated preferences)','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('parking_functions','content','parking_functions_content','integer_partitions','Preference content',NULL);

-- ── examples (distributions over parking_functions(3), plus spot checks; all derived in sage) ────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('parking_functions','preference_sum distribution over parking_functions(3) (k=3..6)','eq','1,3,6,6','Σ a_i; 16 PFs',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT parking_functions_preference_sum((e).value) k, count(*) c FROM elements(parking_functions(3)) e GROUP BY 1) t(k,c) $q$),
  ('parking_functions','prefers_first distribution over parking_functions(3) (k=1..3)','eq','9,6,1','#cars preferring spot 1',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT parking_functions_prefers_first((e).value) k, count(*) c FROM elements(parking_functions(3)) e GROUP BY 1) t(k,c) $q$),
  ('parking_functions','displacement distribution over parking_functions(3) (k=0..3)','eq','6,6,3,1','sage jump(); reverse of the preference_sum row',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT parking_functions_displacement((e).value) k, count(*) c FROM elements(parking_functions(3)) e GROUP BY 1) t(k,c) $q$),
  ('parking_functions','lucky_cars distribution over parking_functions(3) (k=1..3)','eq','2,8,6','len(sage lucky_cars())',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT parking_functions_lucky_cars((e).value) k, count(*) c FROM elements(parking_functions(3)) e GROUP BY 1) t(k,c) $q$),
  ('parking_functions','descents distribution over parking_functions(3) (k=0..2)','eq','5,10,1','#{ i : a_i > a_{i+1} }',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT parking_functions_descents((e).value) k, count(*) c FROM elements(parking_functions(3)) e GROUP BY 1) t(k,c) $q$),
  ('parking_functions','displacement distribution over parking_functions(4) (k=0..6)','eq','24,36,30,20,10,4,1','independent sage jump() check on the larger fiber',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT parking_functions_displacement((e).value) k, count(*) c FROM elements(parking_functions(4)) e GROUP BY 1) t(k,c) $q$),
  ('parking_functions','spot check {1,3,1}: sum 5, prefers_first 2, displacement 1, lucky 2, descents 1','eq','5|2|1|2|1','a single element',$q$
    SELECT parking_functions_preference_sum(ROW(ARRAY[1,3,1])::parking_function)::text || '|' ||
           parking_functions_prefers_first(ROW(ARRAY[1,3,1])::parking_function)::text || '|' ||
           parking_functions_displacement(ROW(ARRAY[1,3,1])::parking_function)::text || '|' ||
           parking_functions_lucky_cars(ROW(ARRAY[1,3,1])::parking_function)::text || '|' ||
           parking_functions_descents(ROW(ARRAY[1,3,1])::parking_function)::text $q$),
  ('parking_functions','spot check {1,1,1}: displacement 3, lucky 1 (only car 1 parks preferred)','eq','3|1','the all-ones PF',$q$
    SELECT parking_functions_displacement(ROW(ARRAY[1,1,1])::parking_function)::text || '|' ||
           parking_functions_lucky_cars(ROW(ARRAY[1,1,1])::parking_function)::text $q$),
  ('parking_functions','content map: {1,3,1} ↦ 3+1+1, identity {1,2,3} ↦ 3+2+1','eq','3+1+1|3+2+1','preference multiset as a partition',$q$
    SELECT notation(parking_functions_content(ROW(ARRAY[1,3,1])::parking_function)) || '|' ||
           notation(parking_functions_content(ROW(ARRAY[1,2,3])::parking_function)) $q$),
  ('parking_functions','content renders in the CODOMAIN form (an integer partition) via render_value','eq','2+2+1','{2,1,2} ↦ 2+2+1',$q$
    SELECT render_value(parking_functions_content(ROW(ARRAY[2,1,2])::parking_function)) $q$),
  ('parking_functions','content is preference_sum-preserving over the whole n=3 fiber','eq','true','Σ parts of content = Σ preferences',$q$
    SELECT bool_and(
        (SELECT coalesce(sum(x),0) FROM unnest((parking_functions_content((e).value)).parts) x)
        = parking_functions_preference_sum((e).value)
      )::text FROM elements(parking_functions(3)) e $q$);

-- ── examples (max_preference, distinct_preferences, ties; PF(2) checks + PF(3) distributions, hand-verified) ─
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('parking_functions','max_preference over parking_functions(2) in rank order is 1,2,2','eq','1,2,2','(1,1),(1,2),(2,1)',$q$
    SELECT string_agg(parking_functions_max_preference((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(parking_functions(2)) e $q$),
  ('parking_functions','distinct_preferences over parking_functions(2) in rank order is 1,2,2','eq','1,2,2','(1,1),(1,2),(2,1)',$q$
    SELECT string_agg(parking_functions_distinct_preferences((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(parking_functions(2)) e $q$),
  ('parking_functions','ties over parking_functions(2) in rank order is 1,0,0','eq','1,0,0','(1,1) has one tied pair, the others none',$q$
    SELECT string_agg(parking_functions_ties((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(parking_functions(2)) e $q$),
  ('parking_functions','max_preference distribution over parking_functions(3) (k=1..3)','eq','1,6,9','#PFs by highest preference asked',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT parking_functions_max_preference((e).value) k, count(*) c FROM elements(parking_functions(3)) e GROUP BY 1) t(k,c) $q$),
  ('parking_functions','distinct_preferences distribution over parking_functions(3) (k=1..3)','eq','1,9,6','#PFs by number of distinct spots asked for',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT parking_functions_distinct_preferences((e).value) k, count(*) c FROM elements(parking_functions(3)) e GROUP BY 1) t(k,c) $q$),
  ('parking_functions','ties distribution over parking_functions(3) (k=0,1,3)','eq','6,9,1','Σ C(freq,2); k=2 is unreachable at n=3',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT parking_functions_ties((e).value) k, count(*) c FROM elements(parking_functions(3)) e GROUP BY 1) t(k,c) $q$),
  ('parking_functions','spot check {1,3,1}: max_preference 3, distinct_preferences 2, ties 1','eq','3|2|1','one repeated preference (the two 1s)',$q$
    SELECT parking_functions_max_preference(ROW(ARRAY[1,3,1])::parking_function)::text || '|' ||
           parking_functions_distinct_preferences(ROW(ARRAY[1,3,1])::parking_function)::text || '|' ||
           parking_functions_ties(ROW(ARRAY[1,3,1])::parking_function)::text $q$),
  ('parking_functions','spot check {1,1,1}: max_preference 1, distinct_preferences 1, ties 3','eq','1|1|3','all three cars tied on spot 1: C(3,2)=3 pairs',$q$
    SELECT parking_functions_max_preference(ROW(ARRAY[1,1,1])::parking_function)::text || '|' ||
           parking_functions_distinct_preferences(ROW(ARRAY[1,1,1])::parking_function)::text || '|' ||
           parking_functions_ties(ROW(ARRAY[1,1,1])::parking_function)::text $q$),
  ('parking_functions','ties is 0 iff distinct_preferences = n, over parking_functions(4)','eq','true','no repeats ⇔ all preferences distinct',$q$
    SELECT bool_and((parking_functions_ties((e).value) = 0) = (parking_functions_distinct_preferences((e).value) = 4))::text
      FROM elements(parking_functions(4)) e $q$),
  ('parking_functions','empty parking function (n=0): max_preference, distinct_preferences, ties all 0','eq','0|0|0','edge case, no cars',$q$
    SELECT parking_functions_max_preference((unrank(parking_functions(0),0)).value)::text || '|' ||
           parking_functions_distinct_preferences((unrank(parking_functions(0),0)).value)::text || '|' ||
           parking_functions_ties((unrank(parking_functions(0),0)).value)::text $q$);
