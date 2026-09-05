-- requires: realizer, tags, traits
-- requires-tag: collection
-- Catalog-wide metadata self-certification (issue #119). Per-element math is certified by every collection's own
-- example suite; these rows certify the CATALOG'S OWN METADATA instead — that base_map/base_stat codomains name
-- real things, and that tag/trait implies-closure actually holds over the assigned data. kind='eq' compares a
-- COUNT OF VIOLATIONS against expected '0': a regression that breaks a metadata invariant trips the suite.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('catalog_metadata','every base_map codomain resolves to a registered collection','eq','0',
   'codomain should always name a real base_collection.id (RSK''s standard_tableau_pairs now exists, #66)',$q$
    SELECT count(*)::text FROM base_map m
    WHERE m.codomain NOT IN (SELECT id FROM base_collection) $q$),

  ('catalog_metadata','every base_stat codomain resolves (a collection id or a real pg scalar type)','eq','0',
   'most stats return into a collection (natural_numbers, integer_partitions, …); a few return a raw scalar '
   '(text, int) with no collection behind it — either form is a resolution, an unresolvable codomain is not',$q$
    SELECT count(*)::text FROM base_stat s
    WHERE s.codomain IS NOT NULL
      AND s.codomain NOT IN (SELECT id FROM base_collection)
      AND to_regtype(s.codomain) IS NULL $q$),

  ('catalog_metadata','tag implies-closure holds: every collection carrying a tag also carries what it implies','eq','0',
   'base_collection_tag is a WITH RECURSIVE closure view (tags.sql) — this certifies the closure it computes '
   'actually holds against the assigned data, not just that the view compiles',$q$
    SELECT count(*)::text FROM base_collection_tag ct
    JOIN base_tag t ON t.id = ct.tag
    CROSS JOIN LATERAL unnest(t.implies) AS imp
    WHERE NOT EXISTS (
      SELECT 1 FROM base_collection_tag ct2 WHERE ct2.collection = ct.collection AND ct2.tag = imp) $q$),

  ('catalog_metadata','trait implies-closure holds: every collection carrying a trait also carries what it implies','eq','0',
   'base_collection_trait is a WITH RECURSIVE closure view (traits.sql, e.g. has_glyph ⇒ visual) — same certification '
   'as the tag closure, over the derived trait data',$q$
    SELECT count(*)::text FROM base_collection_trait ctr
    JOIN base_trait tr ON tr.id = ctr.trait
    CROSS JOIN LATERAL unnest(tr.implies) AS imp
    WHERE NOT EXISTS (
      SELECT 1 FROM base_collection_trait ctr2 WHERE ctr2.collection = ctr.collection AND ctr2.trait = imp) $q$),

  ('catalog_metadata','no orphan tag implies targets','eq','0','every id in base_tag.implies must itself be a registered base_tag row — a typo would silently break the closure',$q$
    SELECT count(*)::text FROM base_tag t
    CROSS JOIN LATERAL unnest(t.implies) AS imp
    WHERE imp NOT IN (SELECT id FROM base_tag) $q$),

  ('catalog_metadata','no orphan trait implies targets','eq','0','every id in base_trait.implies must itself be a registered base_trait row',$q$
    SELECT count(*)::text FROM base_trait tr
    CROSS JOIN LATERAL unnest(tr.implies) AS imp
    WHERE imp NOT IN (SELECT id FROM base_trait) $q$),

  ('catalog_metadata','every base_collection carrier resolves to a real pg type','eq','0','carrier names the composite/domain type the collection is realized over; an unresolvable carrier means base_realize could not have run',$q$
    SELECT count(*)::text FROM base_collection c WHERE to_regtype(c.carrier) IS NULL $q$),

  ('catalog_metadata','every base_repr row names a real, registered collection','eq','0','repr rows (alternate renderings) are keyed by collection id — a stale or mistyped collection id would silently never surface in the client',$q$
    SELECT count(*)::text FROM base_repr r WHERE r.collection NOT IN (SELECT id FROM base_collection) $q$);
