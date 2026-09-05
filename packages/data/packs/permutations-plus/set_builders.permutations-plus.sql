-- requires: set_builders
-- permutations-plus half of sqlsrc/set_builders.sql (#283 phase 3 extraction) — the parking_function carrier's
-- set-builder, split out because its example calls parking_functions(), a permutations-plus collection.

-- ── parking_function (base: parking_functions, axis `n`) ────────────────────────────────────────────────────────
CREATE FUNCTION parking_function_set_builder(axes jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '\{\, (a_1, \ldots, a_{' || (axes->>'n') || '}) \in [' || (axes->>'n') || ']^{' || (axes->>'n') ||
         '} : \text{sorted}(a)_i \le i \,\}' $$;
INSERT INTO base_set_builder (carrier, builder_fn) VALUES ('parking_function', 'parking_function_set_builder');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('set_builders','parking_function set-builder: parking_functions(3)','eq','\{\, (a_1, \ldots, a_{3}) \in [3]^{3} : \text{sorted}(a)_i \le i \,\}','the defining parking condition',$q$
    SELECT set_builder((unrank(parking_functions(3), 0)).fiber) $q$);
