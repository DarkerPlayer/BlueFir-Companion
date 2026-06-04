import { ScheduleData, mergeScheduleData } from '../lib/schedule';
import { getDatabase, initializeDatabase, shouldUseSqlite } from './database';

const LOCAL_STORAGE_KEY = 'bluefir-companion-dev-archives';

export interface ArchiveRecord {
  id: string;
  archiveDate: number;
  snapshot: ScheduleData;
}

export interface ArchiveRepository {
  listArchives(): Promise<ArchiveRecord[]>;
  getArchive(id: string): Promise<ArchiveRecord | null>;
  createArchive(snapshot: ScheduleData): Promise<ArchiveRecord>;
  replaceArchives(archives: ArchiveRecord[]): Promise<void>;
}

class SqliteArchiveRepository implements ArchiveRepository {
  async listArchives(): Promise<ArchiveRecord[]> {
    await initializeDatabase();
    const db = await getDatabase();
    const rows = await db.select<ArchiveRow[]>(
      'SELECT id, archive_date, snapshot_json FROM archive ORDER BY archive_date DESC',
    );
    return rows.map(rowToArchive);
  }

  async getArchive(id: string): Promise<ArchiveRecord | null> {
    await initializeDatabase();
    const db = await getDatabase();
    const rows = await db.select<ArchiveRow[]>(
      'SELECT id, archive_date, snapshot_json FROM archive WHERE id = $1',
      [id],
    );
    return rows[0] ? rowToArchive(rows[0]) : null;
  }

  async createArchive(snapshot: ScheduleData): Promise<ArchiveRecord> {
    await initializeDatabase();
    const db = await getDatabase();
    const archive: ArchiveRecord = {
      id: crypto.randomUUID(),
      archiveDate: Date.now(),
      snapshot: mergeScheduleData(snapshot),
    };

    await db.execute(
      `
      INSERT INTO archive (id, archive_date, snapshot_json)
      VALUES ($1, $2, $3)
      `,
      [archive.id, archive.archiveDate, JSON.stringify(archive.snapshot)],
    );

    return archive;
  }

  async replaceArchives(archives: ArchiveRecord[]): Promise<void> {
    await initializeDatabase();
    const db = await getDatabase();
    await db.execute('DELETE FROM archive');

    for (const archive of archives) {
      await db.execute(
        `
        INSERT INTO archive (id, archive_date, snapshot_json)
        VALUES ($1, $2, $3)
        `,
        [archive.id, archive.archiveDate, JSON.stringify(mergeScheduleData(archive.snapshot))],
      );
    }
  }
}

class LocalStorageArchiveRepository implements ArchiveRepository {
  async listArchives(): Promise<ArchiveRecord[]> {
    return readLocalArchives().sort((left, right) => right.archiveDate - left.archiveDate);
  }

  async getArchive(id: string): Promise<ArchiveRecord | null> {
    return readLocalArchives().find((archive) => archive.id === id) || null;
  }

  async createArchive(snapshot: ScheduleData): Promise<ArchiveRecord> {
    const archive: ArchiveRecord = {
      id: crypto.randomUUID(),
      archiveDate: Date.now(),
      snapshot: mergeScheduleData(snapshot),
    };
    const archives = [archive, ...readLocalArchives()];
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(archives));
    return archive;
  }

  async replaceArchives(archives: ArchiveRecord[]): Promise<void> {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(archives));
  }
}

interface ArchiveRow {
  id: string;
  archive_date: number;
  snapshot_json: string;
}

function rowToArchive(row: ArchiveRow): ArchiveRecord {
  return {
    id: row.id,
    archiveDate: Number(row.archive_date),
    snapshot: mergeScheduleData(JSON.parse(row.snapshot_json)),
  };
}

function readLocalArchives(): ArchiveRecord[] {
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed)
    ? parsed.map((archive) => ({
        id: String(archive.id),
        archiveDate: Number(archive.archiveDate),
        snapshot: mergeScheduleData(archive.snapshot),
      }))
    : [];
}

export function createArchiveRepository(): ArchiveRepository {
  return shouldUseSqlite() ? new SqliteArchiveRepository() : new LocalStorageArchiveRepository();
}
