import { getDatabase, initializeDatabase, shouldUseSqlite } from './database';

const LOCAL_STORAGE_KEY = 'bluefir-companion-dev-settings';

export interface SettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  getAll(): Promise<Record<string, string>>;
}

class SqliteSettingsRepository implements SettingsRepository {
  async get(key: string): Promise<string | null> {
    await initializeDatabase();
    const db = await getDatabase();
    const rows = await db.select<SettingRow[]>('SELECT value FROM settings WHERE key = $1', [key]);
    return rows[0]?.value || null;
  }

  async set(key: string, value: string): Promise<void> {
    await initializeDatabase();
    const db = await getDatabase();
    await db.execute(
      `
      INSERT INTO settings (key, value)
      VALUES ($1, $2)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      [key, value],
    );
  }

  async getAll(): Promise<Record<string, string>> {
    await initializeDatabase();
    const db = await getDatabase();
    const rows = await db.select<Array<SettingRow & { key: string }>>('SELECT key, value FROM settings');
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }
}

class LocalStorageSettingsRepository implements SettingsRepository {
  async get(key: string): Promise<string | null> {
    return readLocalSettings()[key] || null;
  }

  async set(key: string, value: string): Promise<void> {
    const settings = readLocalSettings();
    settings[key] = value;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  }

  async getAll(): Promise<Record<string, string>> {
    return readLocalSettings();
  }
}

interface SettingRow {
  value: string;
}

function readLocalSettings(): Record<string, string> {
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

export function createSettingsRepository(): SettingsRepository {
  return shouldUseSqlite() ? new SqliteSettingsRepository() : new LocalStorageSettingsRepository();
}
