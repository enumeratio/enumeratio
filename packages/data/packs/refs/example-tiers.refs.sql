-- requires: find_stat
-- The `find_stat` slice of example-tiers.sql's slow-tagging (#283 phase 2.2 split): the wholly integration-class
-- `find_stat` suite is a full-catalog sweep same as core's `search_sequence`/`thesis`, but the suite itself is
-- owned by this pack, so the row naming it moves here rather than leaving a dangling `requires: find_stat` on a
-- core anchor file.
UPDATE base_example SET slow = true WHERE suite = 'find_stat';
