import { DAY_KEYS, HOURS, DayKey, ScheduleData, emptyData, mergeScheduleData } from '../lib/schedule';
import { getDatabase, initializeDatabase, isTauriRuntime } from './database';

const ACTIVE_SCHEDULE_ID = 'active';
const LOCAL_STORAGE_KEY = 'bluefir-companion-dev-schedule';
const ACTIVE_SCHEDULE_META_KEY = 'schedule.active.meta';

export interface ScheduleRepository {
  getActiveSchedule(): Promise<ScheduleData>;
  saveSchedule(data: ScheduleData): Promise<void>;
  clearSchedule(): Promise<ScheduleData>;
}

class SqliteScheduleRepository implements ScheduleRepository {
  async getActiveSchedule(): Promise<ScheduleData> {
    await ensureActiveSchedule();
    const db = await getDatabase();
    const rows = await db.select<SlotRow[]>(
      'SELECT day_index, hour, content, checked FROM slot WHERE schedule_id = $1',
      [ACTIVE_SCHEDULE_ID],
    );

    const data = emptyData();
    const metaRows = await db.select<SettingRow[]>(
      'SELECT value FROM settings WHERE key = $1',
      [ACTIVE_SCHEDULE_META_KEY],
    );
    const meta = metaRows[0] ? mergeScheduleData(JSON.parse(metaRows[0].value)) : emptyData();
    data.d1name = meta.d1name;
    data.d2name = meta.d2name;
    data.d1date = meta.d1date;
    data.d2date = meta.d2date;
    data.merges = meta.merges;

    rows.forEach((row) => {
      const dayKey = dayKeyFromIndex(row.day_index);
      if (!dayKey || !HOURS.includes(row.hour as (typeof HOURS)[number])) return;

      data.slots[row.hour][dayKey] = row.content;
      data.slots[row.hour][`${dayKey}checked`] = Boolean(row.checked);
    });

    return data;
  }

  async saveSchedule(data: ScheduleData): Promise<void> {
    await ensureActiveSchedule();
    const db = await getDatabase();
    const now = Date.now();

    await db.execute('UPDATE schedule SET updated_at = $1 WHERE id = $2', [now, ACTIVE_SCHEDULE_ID]);
    await db.execute(
      `
      INSERT INTO settings (key, value)
      VALUES ($1, $2)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value
      `,
      [
        ACTIVE_SCHEDULE_META_KEY,
        JSON.stringify({
          d1name: data.d1name,
          d2name: data.d2name,
          d1date: data.d1date,
          d2date: data.d2date,
          merges: data.merges,
        }),
      ],
    );

    for (const hour of HOURS) {
      for (const dayKey of DAY_KEYS) {
        const dayIndex = dayKey === 'd1' ? 0 : 1;
        const checkedKey = `${dayKey}checked` as const;
        await db.execute(
          `
          INSERT INTO slot (id, schedule_id, day_index, hour, content, checked)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT(id) DO UPDATE SET
            content = excluded.content,
            checked = excluded.checked
          `,
          [
            `${ACTIVE_SCHEDULE_ID}:${dayIndex}:${hour}`,
            ACTIVE_SCHEDULE_ID,
            dayIndex,
            hour,
            data.slots[hour][dayKey],
            data.slots[hour][checkedKey] ? 1 : 0,
          ],
        );
      }
    }
  }

  async clearSchedule(): Promise<ScheduleData> {
    const next = emptyData();
    await this.saveSchedule(next);
    return next;
  }
}

class LocalStorageScheduleRepository implements ScheduleRepository {
  async getActiveSchedule(): Promise<ScheduleData> {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return mergeScheduleData(raw ? JSON.parse(raw) : null);
  }

  async saveSchedule(data: ScheduleData): Promise<void> {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  }

  async clearSchedule(): Promise<ScheduleData> {
    const next = emptyData();
    await this.saveSchedule(next);
    return next;
  }
}

interface SlotRow {
  day_index: number;
  hour: number;
  content: string;
  checked: number;
}

interface SettingRow {
  value: string;
}

function dayKeyFromIndex(index: number): DayKey | null {
  if (index === 0) return 'd1';
  if (index === 1) return 'd2';
  return null;
}

async function ensureActiveSchedule(): Promise<void> {
  await initializeDatabase();
  const db = await getDatabase();
  const now = Date.now();

  await db.execute(
    `
    INSERT INTO schedule (id, title, created_at, updated_at)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT(id) DO NOTHING
    `,
    [ACTIVE_SCHEDULE_ID, '蓝杉长者日程', now, now],
  );
}

export function createScheduleRepository(): ScheduleRepository {
  return isTauriRuntime() ? new SqliteScheduleRepository() : new LocalStorageScheduleRepository();
}
