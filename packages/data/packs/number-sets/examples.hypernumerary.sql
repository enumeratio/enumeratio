-- requires: hypernumerary, hyperbinary_representations
-- cross-pack cross-check split out of sqlsrc/hypernumerary.sql (#283 phase 3, number-sets extraction) — core's
-- hypernumerary(b,k,n) is the general widened-alphabet family; hyperbinary_representations is its b=2,k=1
-- INSTANCE (#86), but that collection lives in number-sets, so the assertion tying them together lives here.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('hypernumerary','b=2,k=1 IS hyperbinary_representations: identical numeral encoding, element-for-element, n=0..8','eq','true','not just equal counts — equal notations, in rank order — ties the general engine to the trusted instance',$q$
    SELECT bool_and(
      (SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(hypernumerary(2,1,n)) e)
      = (SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(hyperbinary_representations(n)) e))::text
    FROM generate_series(0,8) n $q$),
  ('hypernumerary','cardinality of hypernumerary(2,1,n) matches fusc(n+1), n=0..8','eq','1,1,2,1,3,2,3,1,4','A002487 shifted — the b=2,k=1 slice reproduces hyperbinary_representations exactly (independent accel)',$q$
    SELECT string_agg(cardinality(hypernumerary(2,1,n))::text, ',' ORDER BY n) FROM generate_series(0,8) n $q$);
