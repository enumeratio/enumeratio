-- requires: dyck_paths.stats2, fine_paths
-- paths half of sqlsrc/dyck_paths.stats2.sql (#283 phase 3 extraction) — the one example cross-checking
-- dyck_hills=0 against fine_paths' count, split out because fine_paths is a `paths`-pack collection and this
-- example calls its constructor directly, which doesn't exist loading core alone.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dyck_paths','hills=0 characterizes fine_paths: dyck_paths(4) filtered by hills=0 has the same count as fine_paths(4)','eq','true','cross-check against the Fine-path restriction',$q$
    SELECT ((SELECT count(*) FROM elements(dyck_paths(4)) e WHERE dyck_hills((e).value) = 0) = cardinality(fine_paths(4)))::text $q$);
