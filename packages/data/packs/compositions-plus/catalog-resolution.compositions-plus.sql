-- requires: catalog-resolution, compositions_into_k_parts
-- compositions-plus half of sqlsrc/catalog-resolution.sql's carrier-inheritance examples (#283 phase 3
-- extraction) — compositions_into_k_parts inherits its composition-carrier stats for free (registers none itself).

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('catalog','compositions_into_k_parts inherits its composition-carrier stats (registers none itself)','eq','0|true','own base_stat rows | any resolved stats (a floor — the carrier may gain more)',$q$
    SELECT (SELECT count(*) FROM base_stat WHERE collection = 'compositions_into_k_parts')::text || '|' ||
           (SELECT count(*) > 0 FROM base_stat_resolved WHERE collection = 'compositions_into_k_parts')::text $q$);
