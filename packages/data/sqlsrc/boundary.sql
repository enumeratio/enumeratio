-- requires: realizer
-- Cross-collection BOUNDARY assertions. Data-driven (loops base_catalog), so every collection — present and
-- future — is covered without a per-collection row. The example runs after all collections are registered.
--
-- n=0 consistency: wherever 0 lies in a collection's primary grade (constructing at 0 doesn't raise), enumerating
-- the fiber must SUCCEED, RENDER every element, and agree with the closed-form cardinality. This is the net that
-- catches "cardinality computes but the floor crashes at the empty structure" — e.g. an array_length of an empty
-- carrier going NULL inside a FOR bound (the lehmer_codes(0) regression).

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('boundary','every collection is consistent at n=0 (enumerate + render = cardinality, no crash)','ok',NULL,
   'for each collection where 0 is in the primary grade: count(render) over the fiber equals cardinality',$q$
    DO $b$
    DECLARE r record; card numeric; cnt bigint;
    BEGIN
      FOR r IN SELECT id FROM base_catalog ORDER BY id LOOP
        BEGIN
          EXECUTE format('SELECT cardinality(%I(0))', r.id) INTO card;   -- 0 not in the primary grade ⇒ raises ⇒ skip
        EXCEPTION WHEN OTHERS THEN CONTINUE;
        END;
        CONTINUE WHEN card IS NULL OR card = 'Infinity'::numeric;        -- unbounded/degenerate n=0 fiber — nothing finite to walk
        EXECUTE format('SELECT count(render(e)) FROM elements(%I(0), %s) e', r.id, card::int) INTO cnt;
        ASSERT cnt = card, format('%s(0): enumerated+rendered %s but cardinality is %s', r.id, cnt, card);
      END LOOP;
    END $b$ $q$);
