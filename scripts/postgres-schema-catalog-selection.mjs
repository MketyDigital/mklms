export function selectPostgresCatalogSchema(rows) {
  if (!Array.isArray(rows)) throw new Error('PostgreSQL schema inventory must be an array.');
  const candidates = rows.map(row => ({
    name: typeof row?.name === 'string' ? row.name : '',
    hasMigrationLedger: row?.hasMigrationLedger === true,
    applicationTableCount: Number(row?.applicationTableCount),
  })).filter(row => row.name && Number.isSafeInteger(row.applicationTableCount) && row.applicationTableCount >= 0);
  const ledgerSchemas = candidates.filter(row => row.hasMigrationLedger);
  const ledgerWithTables = ledgerSchemas.filter(row => row.applicationTableCount > 0);
  if (ledgerWithTables.length === 1) return ledgerWithTables[0].name;
  if (ledgerWithTables.length > 1) throw new Error(`Multiple MkLMS migration-ledger schemas contain application tables (${ledgerWithTables.length}).`);
  if (ledgerSchemas.length === 1) return ledgerSchemas[0].name;
  if (ledgerSchemas.length > 1) throw new Error(`Multiple MkLMS migration-ledger schemas were found (${ledgerSchemas.length}).`);
  const schemasWithTables = candidates.filter(row => row.applicationTableCount > 0);
  if (schemasWithTables.length === 1) return schemasWithTables[0].name;
  throw new Error(`Could not select one PostgreSQL application schema safely (${schemasWithTables.length} schemas contain tables and no unique MkLMS migration ledger was found).`);
}
