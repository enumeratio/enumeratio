// The FindStat statistics adopted for set partitions (their values are checked against every
// FindStat row by scripts/check-findstat.ts), against independent readings.
import { checkAgainstEngine } from "./statistics-helpers.ts";
import { SET_PARTITION_READINGS } from "./set-partition-findstat-readings.ts";

checkAgainstEngine(Object.keys(SET_PARTITION_READINGS));
