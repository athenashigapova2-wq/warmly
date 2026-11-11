import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
// Executes the same SQL against SQLite for local Worker integration tests.
export function createLocalD1(path = ':memory:') {
  const sql = new DatabaseSync(path);
  if (!sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_sessions'").get()) {
    sql.exec(readFileSync(new URL('../drizzle/0000_warmly.sql', import.meta.url), 'utf8'));
  }
  function statement(query, values = []) {
    return {
      bind(...args) { return statement(query, args); },
      async first() { return sql.prepare(query).get(...values) || null; },
      async all() { return { results: sql.prepare(query).all(...values) }; },
      async run() { const result = sql.prepare(query).run(...values); return { meta: { changes: Number(result.changes) }, results: [] }; },
      async execute() { return /^\s*SELECT/i.test(query) ? this.all() : this.run(); },
    };
  }
  return {
    sql,
    prepare(query) { return statement(query); },
    async batch(statements) {
      sql.exec('BEGIN');
      try { const result = []; for (const item of statements) result.push(await item.execute()); sql.exec('COMMIT'); return result; }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
    close() { sql.close(); },
  };
}
