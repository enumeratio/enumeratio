-- requires: relations, maps-bijections.partitions-plus
-- partitions-plus half of sqlsrc/relations.sql's Euler (distinct↔odd) checks (#283 phase 3 extraction) — split
-- out because base_relation is populated by core's relations.sql (a core-owned TABLE + one-shot INSERT…SELECT)
-- and this pack only adds examples over rows that INSERT already produced once distinct_partitions/odd_partitions'
-- own base_map rows (maps-bijections.partitions-plus.sql) exist.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('relations','a known bijection appears as one relation: distinct↔odd, both directions named','eq','distinct_partitions|odd_partitions|euler_distinct_to_odd|euler_odd_to_distinct|t|f','domain|codomain|forward|backward|is_bijection|is_order_iso',$q$
    SELECT domain||'|'||codomain||'|'||forward_fn||'|'||coalesce(backward_fn,'∅')||'|'||left(is_bijection::text,1)||'|'||left(is_order_iso::text,1)
      FROM base_relation WHERE domain='distinct_partitions' $q$),
  ('relations','Euler is a bijection but NOT order-iso: its window rank order does not line up','eq','false','discriminating check — distinct↦odd is not order-preserving',$q$
    SELECT bool_and(
      ARRAY(SELECT notation(euler_distinct_to_odd((e).value)) FROM elements(distinct_partitions(n)) e ORDER BY ordinality(e))
    = ARRAY(SELECT notation((o).value) FROM elements(odd_partitions(n)) o ORDER BY ordinality(o)))::text
    FROM generate_series(0,10) n $q$),
  ('relations','forward∘backward = id on samples (Euler): backward(forward(d)) = d','eq','true','round-trip through the relation''s two fns',$q$
    SELECT bool_and(euler_odd_to_distinct(euler_distinct_to_odd((e).value)) = (e).value)::text
      FROM generate_series(0,12) n, LATERAL elements(distinct_partitions(n)) e $q$);
