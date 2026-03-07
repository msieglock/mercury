/**
 * D1 database helper functions for Mercury API.
 * All queries use parameterized prepared statements to prevent SQL injection.
 */

/**
 * Run a SELECT query and return all matching rows.
 */
export async function query<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = params && params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.all<T>();
  return result.results;
}

/**
 * Run a SELECT query and return the first matching row, or null.
 */
export async function queryOne<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const stmt = db.prepare(sql);
  const bound = params && params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.first<T>();
  return result ?? null;
}

/**
 * Run an INSERT, UPDATE, or DELETE statement.
 */
export async function execute(
  db: D1Database,
  sql: string,
  params?: unknown[]
): Promise<D1Result> {
  const stmt = db.prepare(sql);
  const bound = params && params.length > 0 ? stmt.bind(...params) : stmt;
  return bound.run();
}

/**
 * Run multiple statements in a batch (atomic transaction).
 */
export async function batch(
  db: D1Database,
  statements: Array<{ sql: string; params?: unknown[] }>
): Promise<D1Result[]> {
  const prepared = statements.map((s) => {
    const stmt = db.prepare(s.sql);
    return s.params && s.params.length > 0 ? stmt.bind(...s.params) : stmt;
  });
  return db.batch(prepared);
}
