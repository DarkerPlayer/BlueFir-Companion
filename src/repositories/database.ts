import Database from '@tauri-apps/plugin-sql';

let dbPromise: Promise<Database> | null = null;

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:bluefir-companion.db');
  }
  return dbPromise;
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS schedule (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS slot (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      day_index INTEGER NOT NULL,
      hour INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      checked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (schedule_id) REFERENCES schedule(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS archive (
      id TEXT PRIMARY KEY,
      archive_date INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS template (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      template_json TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_slot_schedule_day_hour
    ON slot(schedule_id, day_index, hour);
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_archive_date
    ON archive(archive_date DESC);
  `);
}
