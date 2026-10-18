export function selectPostgresCatalogSchema(rows) {
  if (!Array.isArray(rows)) throw new Error('PostgreSQL schema inventory must be an array.');
  const candidates = rows.map(row => ({
    name: typeof row?.name === 'string' ? row.name : '',
    hasMigrationLedger: row?.hasMigrationLedger === true,
    applicationTableCount: Number(row?.applicationTableCount),
    mklmsSignatureTableCount: Number(row?.mklmsSignatureTableCount ?? 0),
  })).filter(row => row.name && Number.isSafeInteger(row.applicationTableCount) && row.applicationTableCount >= 0);
  const ledgerSchemas = candidates.filter(row => row.hasMigrationLedger);
  const ledgerWithTables = ledgerSchemas.filter(row => row.applicationTableCount > 0);
  if (ledgerWithTables.length === 1) return ledgerWithTables[0].name;
  if (ledgerWithTables.length > 1) throw new Error(`Multiple MkLMS migration-ledger schemas contain application tables (${ledgerWithTables.length}).`);
  if (ledgerSchemas.length === 1) return ledgerSchemas[0].name;
  if (ledgerSchemas.length > 1) throw new Error(`Multiple MkLMS migration-ledger schemas were found (${ledgerSchemas.length}).`);
  // Require a strong, unique fingerprint but allow an incomplete source schema
  // to be selected so the parity audit can report missing core tables. Exact
  // equality to all five would prevent us from auditing precisely that drift.
  const signatureSchemas = candidates.filter(row => row.mklmsSignatureTableCount >= 3);
  const strongestSignature = Math.max(0, ...signatureSchemas.map(row => row.mklmsSignatureTableCount));
  const strongestSchemas = signatureSchemas.filter(row => row.mklmsSignatureTableCount === strongestSignature);
  if (strongestSchemas.length === 1) return strongestSchemas[0].name;
  if (strongestSchemas.length > 1) throw new Error(`Multiple PostgreSQL schemas share the strongest MkLMS core-table signature (${strongestSchemas.length}).`);
  const schemasWithTables = candidates.filter(row => row.applicationTableCount > 0);
  if (schemasWithTables.length === 1) return schemasWithTables[0].name;
  const tableCounts = schemasWithTables.map(row => row.applicationTableCount).join(',');
  const signatureCounts = schemasWithTables.map(row => row.mklmsSignatureTableCount).join(',');
  throw new Error(`Could not select one PostgreSQL application schema safely (${schemasWithTables.length} schemas contain tables and no unique MkLMS migration ledger was found; metadata table counts ${tableCounts}; core matches ${signatureCounts}).`);
}
