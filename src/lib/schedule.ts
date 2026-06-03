export const DAY_KEYS = ['d1', 'd2'] as const;
export const HOURS = [
  6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5,
] as const;
export const MAX_MERGE_SPAN = 6;

export type DayKey = (typeof DAY_KEYS)[number];

export interface SlotValue {
  d1: string;
  d2: string;
  d1checked: boolean;
  d2checked: boolean;
}

export interface ScheduleData {
  d1name: string;
  d2name: string;
  d1date: string;
  d2date: string;
  slots: Record<number, SlotValue>;
  merges: Record<DayKey, Record<number, number>>;
}

const PERIOD_LABELS: Partial<Record<number, string>> = {
  6: '上午',
  12: '中午',
  14: '下午',
  18: '晚上',
  22: '深夜',
  0: '凌晨',
};

export function emptyData(): ScheduleData {
  const slots = {} as Record<number, SlotValue>;
  HOURS.forEach((hour) => {
    slots[hour] = { d1: '', d2: '', d1checked: false, d2checked: false };
  });

  return {
    d1name: '',
    d2name: '',
    d1date: '',
    d2date: '',
    slots,
    merges: { d1: {}, d2: {} },
  };
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function mergeScheduleData(payload: unknown): ScheduleData {
  const base = emptyData();
  if (!payload || typeof payload !== 'object') return base;

  const source = payload as Partial<ScheduleData>;
  base.d1name = normalizeText(source.d1name);
  base.d2name = normalizeText(source.d2name);
  base.d1date = normalizeText(source.d1date);
  base.d2date = normalizeText(source.d2date);

  HOURS.forEach((hour) => {
    const slot = source.slots && typeof source.slots === 'object' ? source.slots[hour] : null;
    base.slots[hour] = {
      d1: normalizeText(slot && slot.d1),
      d2: normalizeText(slot && slot.d2),
      d1checked: Boolean(slot && slot.d1checked),
      d2checked: Boolean(slot && slot.d2checked),
    };
  });

  const merges: Partial<Record<DayKey, Record<number, unknown>>> =
    source.merges && typeof source.merges === 'object' ? source.merges : {};
  DAY_KEYS.forEach((dayKey) => {
    const dayMerges = merges[dayKey] && typeof merges[dayKey] === 'object' ? merges[dayKey] : {};
    HOURS.forEach((hour) => {
      const rawSpan = Number(dayMerges[hour]);
      if (Number.isInteger(rawSpan) && rawSpan > 1) {
        base.merges[dayKey][hour] = Math.min(rawSpan, MAX_MERGE_SPAN);
      }
    });
  });

  return base;
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function formatHourRange(startHour: number, span: number): string {
  if (span <= 1) return formatHour(startHour);
  return `${formatHour(startHour)}~${formatHour((startHour + span) % 24)}`;
}

export function getPeriodLabel(hour: number): string {
  return PERIOD_LABELS[hour] || '';
}

export function formatDateTime(timestamp: number): string {
  if (!timestamp) return '未知时间';
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getDayBlocks(data: ScheduleData, dayKey: DayKey) {
  return HOURS.map((hour, index) => ({
    hour,
    index,
    value: data.slots[hour][dayKey].trim(),
    checked: data.slots[hour][`${dayKey}checked`],
  })).filter((block) => block.value);
}

export function countEntries(data: ScheduleData) {
  const d1 = getDayBlocks(data, 'd1').length;
  const d2 = getDayBlocks(data, 'd2').length;
  return {
    d1,
    d2,
    total: d1 + d2,
    d1Hours: d1,
    d2Hours: d2,
    totalHours: d1 + d2,
  };
}

export function buildSummary(data: ScheduleData): string {
  const d1Name = data.d1name || '第一天';
  const d2Name = data.d2name || '第二天';
  const d1Date = data.d1date ? ` · ${data.d1date}` : '';
  const d2Date = data.d2date ? ` · ${data.d2date}` : '';
  const counts = countEntries(data);

  let text = `【${d1Name}${d1Date}】\n`;
  getDayBlocks(data, 'd1').forEach((block) => {
    text += `  ${formatHour(block.hour)}  ${block.value}\n`;
  });
  if (!counts.d1) text += '  （暂时没有安排）\n';

  text += `\n【${d2Name}${d2Date}】\n`;
  getDayBlocks(data, 'd2').forEach((block) => {
    text += `  ${formatHour(block.hour)}  ${block.value}\n`;
  });
  if (!counts.d2) text += '  （暂时没有安排）\n';

  text += `\n共 ${counts.total} 项安排 / ${counts.totalHours} 小时`;
  return text;
}
