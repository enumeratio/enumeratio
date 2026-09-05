-- requires: random_element, distinct_partitions
-- partitions-plus half of sqlsrc/random_element.sql's sampling-cost examples (#283 phase 3 extraction) —
-- distinct_partitions is the pack's worked scan-floor (O(n), no unrank) case.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('sampling','draw_cost heuristic as data: distinct_partitions O(n) (scan floor)','eq','distinct_partitions:O(n)','the per-collection sampling cost, queryable not prose',$q$
    SELECT string_agg(collection || ':' || draw_cost, ' ' ORDER BY collection)
    FROM base_collection_sampling WHERE collection IN ('distinct_partitions') $q$),
  ('sampling','a SCAN-path draw is still a member: random_element(distinct_partitions(6)) ∈ distinct_partitions(6) over many draws (O(n) floor, no unrank)','eq','true','the scan fallback stays uniform-in-collection',$q$
    SELECT bool_and((random_element(distinct_partitions(6))).value <@ distinct_partitions(6))::text FROM generate_series(1, 40) $q$);
