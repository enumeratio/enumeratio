-- requires: traits, realizer, subsets, k_subsets, factorial_numbers, integer_partitions
-- requires-tag: collection
-- Asymptotic-cost heuristic for the enumeration-capability traits, made queryable, plus the resolved per-collection
-- random-access cost. The realizer already emits random_element(fiber)/random_element(handle) (uniform only when the
-- count is finite AND known — infinite/unknown ⇒ NULL, never a fake-uniform draw), and traits.sql declares the
-- capability ladder. What was prose-only there — "O(1) when indexable, else O(fiber size)" — is captured here AS DATA
-- so the sampler and callers can tell an O(1)-ish direct unrank from a scan-only floor by querying, not by reading a
-- comment. Issue #3.

-- The cost each capability trait grants a single random-access draw. Big-O is in n = fiber size. This annotates the
-- trait VOCABULARY (a side-table on base_trait, mirroring base_trait_cost-style editorial layers) — the resolved
-- per-collection answer is base_collection_sampling below, since `samplable` alone is O(1) only when ALSO indexable.
CREATE TABLE base_trait_cost (
  trait       text PRIMARY KEY REFERENCES base_trait,
  access_cost text NOT NULL,   -- big-O of the random access the trait enables, n = fiber size
  note        text
);
INSERT INTO base_trait_cost (trait, access_cost, note) VALUES
  ('enumerable', 'O(n)', 'iterator floor — a draw scans to the random ordinal'),
  ('indexable',  'O(1)', 'direct fiber_unrank — jump to the ord-th element, no scan'),
  ('samplable',  'O(1)', 'uniform draw is O(1) when ALSO indexable, else falls back to the O(n) scan floor');

-- base_collection_sampling: the resolved random_element story per collection. draw_cost is the actual asymptotic cost
-- of a uniform draw for THIS collection (not the trait-in-the-abstract): O(1) when it has a direct unrank, O(n) when
-- it is finite+counted but scan-only, and 'none' when random_element refuses (infinite/unknown count ⇒ NULL). This is
-- the size heuristic issue #3 asks the capability layer to carry.
CREATE VIEW base_collection_sampling AS
WITH t AS (SELECT collection, array_agg(trait) AS traits FROM base_collection_trait GROUP BY collection)
SELECT c.id AS collection,
       ('samplable' = ANY(t.traits))                                  AS samplable,
       ('indexable' = ANY(t.traits))                                  AS indexable,
       CASE WHEN NOT ('samplable' = ANY(t.traits)) THEN 'none'        -- ∞ / unknown count: no uniform draw (NULL)
            WHEN      ('indexable' = ANY(t.traits)) THEN 'O(1)'       -- direct unrank: draw a rank, jump to it
            ELSE 'O(n)' END                                           AS draw_cost,   -- finite+counted, scan-only floor
       CASE WHEN NOT ('samplable' = ANY(t.traits)) THEN 'refuses'     -- returns NULL, does NOT pretend to be uniform
            WHEN      ('indexable' = ANY(t.traits)) THEN 'unrank'
            ELSE 'scan' END                                           AS draw_mode
FROM base_collection c JOIN t ON t.collection = c.id;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('sampling','draw_cost heuristic as data: k_subsets O(1) (indexable) | distinct_partitions O(n) (scan floor) | factorial_numbers none (∞)','eq','distinct_partitions:O(n) factorial_numbers:none k_subsets:O(1)','the per-collection sampling cost, queryable not prose',$q$
    SELECT string_agg(collection || ':' || draw_cost, ' ' ORDER BY collection)
    FROM base_collection_sampling WHERE collection IN ('k_subsets','distinct_partitions','factorial_numbers') $q$),
  ('sampling','samplable ⇔ a finite draw_cost, never ''none'' (the trait and the resolved cost agree)','eq','true','samplable is exactly the collections random_element draws from',$q$
    SELECT bool_and(samplable = (draw_cost <> 'none'))::text FROM base_collection_sampling $q$),
  ('sampling','draw_cost O(1) ⇒ indexable, and only indexable samplables are O(1) (the O(1) class = direct unrank)','eq','true','the heuristic tracks the direct-unrank capability exactly',$q$
    SELECT bool_and((draw_cost = 'O(1)') = indexable)::text FROM base_collection_sampling WHERE samplable $q$),
  ('sampling','a SCAN-path draw is still a member: random_element(distinct_partitions(6)) ∈ distinct_partitions(6) over many draws (O(n) floor, no unrank)','eq','true','the scan fallback stays uniform-in-collection',$q$
    SELECT bool_and((random_element(distinct_partitions(6))).value <@ distinct_partitions(6))::text FROM generate_series(1, 40) $q$);
