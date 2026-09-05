-- requires: realizer
-- requires-tag: collection
-- Guard (#241): no PUBLIC identifier may collide with a Postgres RESERVED keyword (or a non-reserved one that
-- cannot be a function/type name) — such a name breaks unquoted SQL and trips heuristic tooling. Checks every
-- public function name (catcode R/C) and every composite-type column (catcode R) against pg_get_keywords(), and
-- asserts ZERO collisions. (ordinality/identity/system are non-reserved 'U' and fine; this catches the genuinely
-- reserved ones before they land.)
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('hygiene', 'no public identifier collides with a reserved pg keyword (#241)', 'eq', '0',
   'function names vs R/C keywords + composite-type columns vs R keywords', $q$
    SELECT count(*)::text FROM (
      SELECT p.proname FROM pg_proc p JOIN pg_get_keywords() k ON lower(p.proname) = k.word
       WHERE p.pronamespace = 'public'::regnamespace AND k.catcode IN ('R','C')
      UNION ALL
      SELECT a.attname FROM pg_type t JOIN pg_class c ON c.oid = t.typrelid
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        JOIN pg_get_keywords() k ON lower(a.attname) = k.word
       WHERE t.typnamespace = 'public'::regnamespace AND t.typtype = 'c' AND k.catcode = 'R'
    ) x $q$);
