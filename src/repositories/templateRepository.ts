import { ScheduleData, emptyData, mergeScheduleData } from '../lib/schedule';
import { getDatabase, initializeDatabase, isTauriRuntime } from './database';

const LOCAL_STORAGE_KEY = 'bluefir-companion-dev-templates';

export interface TemplateRecord {
  id: string;
  name: string;
  description: string;
  template: ScheduleData;
}

export interface TemplateRepository {
  listTemplates(): Promise<TemplateRecord[]>;
  getTemplate(id: string): Promise<TemplateRecord | null>;
  saveTemplate(template: TemplateRecord): Promise<void>;
}

const presetTemplates: TemplateRecord[] = [
  {
    id: 'retirement-life',
    name: '退休生活',
    description: '适合规律作息、散步、兴趣活动和家庭陪伴。',
    template: createTemplate({
      d1name: '今日',
      d2name: '明日',
      slots: {
        7: { d1: '起床洗漱，喝温水', d2: '起床洗漱，喝温水' },
        8: { d1: '早餐', d2: '早餐' },
        9: { d1: '公园散步', d2: '公园散步' },
        15: { d1: '兴趣活动', d2: '整理照片或手作' },
        20: { d1: '家人通话', d2: '看电视或听戏曲' },
      },
    }),
  },
  {
    id: 'health-care',
    name: '健康管理',
    description: '围绕用药、运动、饮食和健康记录安排一天。',
    template: createTemplate({
      d1name: '健康日',
      d2name: '复盘日',
      slots: {
        7: { d1: '测量血压', d2: '测量血压' },
        8: { d1: '早餐后用药', d2: '早餐后用药' },
        10: { d1: '轻运动 20 分钟', d2: '轻运动 20 分钟' },
        13: { d1: '午休', d2: '午休' },
        19: { d1: '晚餐后散步', d2: '记录今日身体感受' },
      },
    }),
  },
  {
    id: 'reading-learning',
    name: '阅读学习',
    description: '适合阅读、书法、课程学习和轻量复习。',
    template: createTemplate({
      d1name: '学习日',
      d2name: '练习日',
      slots: {
        9: { d1: '阅读 30 分钟', d2: '复习昨日内容' },
        10: { d1: '书法练习', d2: '听课程' },
        15: { d1: '整理笔记', d2: '阅读 30 分钟' },
        20: { d1: '和家人分享收获', d2: '明日计划' },
      },
    }),
  },
];

class SqliteTemplateRepository implements TemplateRepository {
  async listTemplates(): Promise<TemplateRecord[]> {
    await seedPresetTemplates();
    const db = await getDatabase();
    const rows = await db.select<TemplateRow[]>('SELECT id, name, description, template_json FROM template');
    return rows.map(rowToTemplate);
  }

  async getTemplate(id: string): Promise<TemplateRecord | null> {
    await seedPresetTemplates();
    const db = await getDatabase();
    const rows = await db.select<TemplateRow[]>(
      'SELECT id, name, description, template_json FROM template WHERE id = $1',
      [id],
    );
    return rows[0] ? rowToTemplate(rows[0]) : null;
  }

  async saveTemplate(template: TemplateRecord): Promise<void> {
    await initializeDatabase();
    const db = await getDatabase();
    await db.execute(
      `
      INSERT INTO template (id, name, description, template_json)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        template_json = excluded.template_json
      `,
      [template.id, template.name, template.description, JSON.stringify(template.template)],
    );
  }
}

class LocalStorageTemplateRepository implements TemplateRepository {
  async listTemplates(): Promise<TemplateRecord[]> {
    return [...presetTemplates, ...readLocalTemplates()];
  }

  async getTemplate(id: string): Promise<TemplateRecord | null> {
    return (await this.listTemplates()).find((template) => template.id === id) || null;
  }

  async saveTemplate(template: TemplateRecord): Promise<void> {
    const templates = readLocalTemplates().filter((item) => item.id !== template.id);
    templates.push(template);
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(templates));
  }
}

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  template_json: string;
}

function createTemplate(input: {
  d1name: string;
  d2name: string;
  slots: Partial<Record<number, Partial<Record<'d1' | 'd2', string>>>>;
}): ScheduleData {
  const template = emptyData();
  template.d1name = input.d1name;
  template.d2name = input.d2name;

  Object.entries(input.slots).forEach(([hourText, slot]) => {
    const hour = Number(hourText);
    const safeSlot = slot || {};
    template.slots[hour] = {
      ...template.slots[hour],
      d1: safeSlot.d1 || '',
      d2: safeSlot.d2 || '',
    };
  });

  return template;
}

function rowToTemplate(row: TemplateRow): TemplateRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    template: mergeScheduleData(JSON.parse(row.template_json)),
  };
}

async function seedPresetTemplates(): Promise<void> {
  await initializeDatabase();
  const db = await getDatabase();
  for (const template of presetTemplates) {
    await db.execute(
      `
      INSERT INTO template (id, name, description, template_json)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(id) DO NOTHING
      `,
      [template.id, template.name, template.description, JSON.stringify(template.template)],
    );
  }
}

function readLocalTemplates(): TemplateRecord[] {
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

export function createTemplateRepository(): TemplateRepository {
  return isTauriRuntime() ? new SqliteTemplateRepository() : new LocalStorageTemplateRepository();
}
