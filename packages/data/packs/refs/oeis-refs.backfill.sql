-- requires: oeis, references
-- Backfill base_reference(system='oeis') from base_oeis's collection links: a collection's OEIS pointer should live
-- in the uniform cross-ref layer even when it was only curated in base_oeis. Idempotent (ON CONFLICT DO NOTHING),
-- so it auto-covers future base_oeis rows.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta)
  SELECT 'collection', o.collection, 'oeis', o.a_number, 'https://oeis.org/' || o.a_number, ''
  FROM base_oeis o
  WHERE o.collection IS NOT NULL
  ON CONFLICT (subject_kind, subject, system, identity) DO NOTHING;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','the backfill covers every base_oeis collection link','eq','0','no base_oeis(collection,a_number) pair missing from the uniform cross-ref layer',$q$
    SELECT count(*)::text FROM base_oeis o WHERE o.collection IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM base_reference r WHERE r.subject_kind='collection' AND r.subject=o.collection
                        AND r.system='oeis' AND r.identity=o.a_number) $q$),
  ('references','derangements picks up its base_oeis pointer via the backfill','eq','A000166','base_oeis curated it (subfactorial) but references never had a row until the backfill',$q$
    SELECT identity FROM base_reference WHERE subject_kind='collection' AND subject='derangements' AND system='oeis' $q$);
