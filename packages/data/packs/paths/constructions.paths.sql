-- requires: constructions
-- requires-tag: collection
-- paths half of sqlsrc/constructions.sql (#283 phase 3 extraction) — core keeps the construction/construction_param
-- tables (pure meta, no per-collection FK) plus base_type_former/base_alpha/example rows for core collections;
-- this pack carries motzkin_paths' type_former + enumeration rows and colored_motzkin_paths' dependent-sum
-- binding, split out because base_type_former_enumeration.enumeration and base_alpha.collection both REFERENCE
-- base_collection — a paths row in the core file would FK-fail loading core alone.
-- requires-tag: collection (scoped to this pack's own files by orderFiles) ensures motzkin_paths and
-- colored_motzkin_paths have already loaded.

-- a COLLECTION is a type-former too (same move as core's own permutations/words rows): motzkin_paths' fiber at a
-- bound n is a finite type, so it can fill a hole.
INSERT INTO base_type_former (id, arity, produces_kind, skeleton, mathlib, description) VALUES
  ('motzkin_paths', 1, 'finite', 'motzkin_paths ·', NULL, 'the Motzkin paths of length · as a type');
INSERT INTO base_type_former_enumeration (type_former, enumeration) VALUES
  ('motzkin_paths', 'motzkin_paths');   -- a collection-former enumerates itself

-- a dependent sum: the colours live on the path's OWN level steps, so the second type depends on the first's value
INSERT INTO base_alpha (collection, construction, pos, type_former, param, alpha_axis, generic, note) VALUES
  ('colored_motzkin_paths', 'sigma', 1, 'motzkin_paths', 'n', 'n', false, 'a Motzkin path a of length n'),
  ('colored_motzkin_paths', 'sigma', 2, 'Fin',           'r', 'r', true,  'β a = maps(Fin levels(a), Fin r): one of r colours on each of a''s level steps; |Σ| = Σₐ r^levels(a) — symbolic, no product formula');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('constructions','motzkin_paths enumerates itself as a type-former (same shape as permutations/words in core)','eq','true','arity = grade count; enumeration = itself',$q$
    SELECT (e.enumeration = tf.id)::text FROM base_type_former tf JOIN base_type_former_enumeration e ON e.type_former = tf.id
     WHERE tf.id = 'motzkin_paths' $q$),
  ('constructions','the dependent sum: colored_motzkin_paths is a Σ whose second type depends on the path; its cardinality is symbolic, the oracle abstains','eq','sigma|true|true','Σₐ r^levels(a) has no c1·c2 form',$q$
    SELECT (SELECT construction FROM base_alpha WHERE collection = 'colored_motzkin_paths' AND pos = 1) || '|' ||
           (SELECT dependent FROM base_construction_param WHERE construction = 'sigma' AND pos = 2)::text || '|' ||
           (construction_cardinality(ROW(4, 2)::colored_motzkin_paths_fiber) IS NULL)::text $q$);
