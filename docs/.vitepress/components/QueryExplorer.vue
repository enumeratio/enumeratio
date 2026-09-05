<script setup lang="ts">
// Mount the query view — the row half of a collection statement (FROM · WHERE · GROUP BY · HAVING · ORDER BY) as an
// editable sentence over the pure-SQL core. Routes entirely off its querystring (?from=&where=&group_by=&having=&order_by=),
// so /explore/query needs no path fallback; the collection explorer at /explore/collection/* owns the SELECT half.
import QueryView from '@enumeratio/explorer/query-view'
</script>

<template>
  <QueryView />
</template>
