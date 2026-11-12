// PostgREST bulk requests share a column list. Keep differently shaped rows
// separate so omitted fields retain database defaults rather than becoming null.
export async function writeFixtures(client, fixtures) {
  for (const [table, rows, onConflict] of fixtures) {
    const batches = new Map();
    for (const row of rows) {
      const shape = JSON.stringify(Object.keys(row).sort());
      if (!batches.has(shape)) batches.set(shape, []);
      batches.get(shape).push(row);
    }
    for (const batch of batches.values()) {
      const {error} = await client.from(table).upsert(batch, {onConflict, defaultToNull:false});
      if (error) throw Error(`Seeding ${table}: ${error.message}`);
    }
  }
}
