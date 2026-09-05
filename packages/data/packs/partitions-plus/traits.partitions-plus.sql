-- requires: traits, distinct_partitions, odd_partitions, self_conjugate_partitions, bounded_part_partitions, box_confined_partitions, k_part_partitions, largest_part_partitions, prime_partition, square_partitions, triangular_partitions
-- partitions-plus half of sqlsrc/traits.sql's "sorted family" + capability-ladder examples (#283 phase 3
-- extraction) — the pack-owned partition collections. Split out because base_trait/base_collection_trait_manual
-- and base_example are core-owned TABLEs and this pack may only INSERT rows into them (§3.3 pack contract),
-- never edit core's own INSERT statements.

-- weakly decreasing: the integer_partition carrier (parts int[]) is a descending part sequence.
-- strictly decreasing: distinct partitions have no repeated parts.
INSERT INTO base_collection_trait_manual (trait, collection) VALUES
  ('weakly_decreasing', 'bounded_part_partitions'), ('weakly_decreasing', 'box_confined_partitions'),
  ('weakly_decreasing', 'k_part_partitions'),        ('weakly_decreasing', 'largest_part_partitions'),
  ('weakly_decreasing', 'odd_partitions'),           ('weakly_decreasing', 'prime_partition'),
  ('weakly_decreasing', 'self_conjugate_partitions'),('weakly_decreasing', 'square_partitions'),
  ('weakly_decreasing', 'triangular_partitions'),
  ('strictly_decreasing', 'distinct_partitions');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('traits','strict monotonicity borrows repetition_free via implies-closure (distinct_partitions newly gains it; multisets stays out)','eq','distinct_partitions:t multisets:f subsets:t','strictly_increasing/decreasing ⇒ repetition_free',$q$
    SELECT string_agg(c || ':' || CASE WHEN EXISTS (SELECT 1 FROM base_collection_trait WHERE collection = c AND trait = 'repetition_free')
                                       THEN 't' ELSE 'f' END, ' ' ORDER BY c)
    FROM unnest(ARRAY['subsets','distinct_partitions','multisets']) c $q$),
  ('traits','strictly_decreasing (distinct_partitions): every distinct_partitions(9) element has strictly decreasing parts','eq','true','distinct parts ⇒ strict, and hence repetition_free',$q$
    SELECT bool_and(seq_sorted(((e).value).parts, '>'))::text FROM fibers(distinct_partitions(9)) f, LATERAL elements(f) e $q$),
  ('capabilities','distinct_partitions is countable + samplable but NOT indexable (no direct unrank hook)','eq','countable:t indexable:f samplable:t','a finite collection whose floor scans',$q$
    SELECT string_agg(t || ':' || CASE WHEN EXISTS (SELECT 1 FROM base_collection_trait WHERE collection='distinct_partitions' AND trait=t) THEN 't' ELSE 'f' END, ' ' ORDER BY t)
    FROM unnest(ARRAY['countable','indexable','samplable']) t $q$);
