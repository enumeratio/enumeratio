-- requires: bootstrap, subsets, integer_compositions, random_element
-- requires-tag: collection
-- Classify example rows as PROTOTYPICAL (a representative specimen) or EDGE (a boundary/degenerate guard), #304.
-- Like example-tiers.sql's `slow` flag, this is editorial metadata set AFTER every example has loaded, so the source
-- files stay untouched. NULL stays the default — this is a seed of the convention, not an exhaustive sweep; rows gain
-- a classification incrementally. Only pack='core' rows are touched here: base_guard_pack forbids core UPDATEing a
-- pack-owned base_example row, so a pack that wants to classify its own examples does it in its own example-specimens
-- file (same split example-tiers.sql already uses for slow-tiering).

UPDATE base_example SET specimen = 'prototypical' WHERE pack = 'core' AND (suite, title) IN (
  ('subsets',              'subsets(3) = all 8 subsets of [3] as bit registers, (k, colex) order'),
  ('subsets',              '|subsets(n)| = 2ⁿ for n=0..5'),
  ('integer_compositions', 'count anchor 1,1,2,4,8,16 for n=0..5'),
  ('sampling',             'an_element(subsets(3)) is DETERMINISTIC (two calls agree) and a member'),
  ('sampling',             'some_elements(subsets(3), 3) returns the first 3 in canonical order, all members'));

UPDATE base_example SET specimen = 'edge' WHERE pack = 'core' AND (suite, title) IN (
  ('sampling',             'an_element works where random_element refuses: an_element(natural_numbers()) is a member, but random_elements(…,5) of an infinite handle is empty'));

-- The classification is queryable, and every value obeys the CHECK (the constraint guards inserts; this certifies the
-- seed actually landed on real rows — a mistyped suite/title above would silently match nothing).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('catalog_metadata','base_example.specimen is a seeded, valid classification: some prototypical, some edge, only allowed values','eq','true',
   'the #304 prototypical-vs-edge flag is populated and well-formed',$q$
    SELECT (count(*) FILTER (WHERE specimen = 'prototypical') > 0
        AND count(*) FILTER (WHERE specimen = 'edge') > 0
        AND count(*) FILTER (WHERE specimen NOT IN ('prototypical','edge')) = 0)::text
    FROM base_example $q$);
