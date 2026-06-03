import { create } from 'zustand';
import { DayKey, ScheduleData, emptyData } from '../lib/schedule';
import { createScheduleRepository } from '../repositories/scheduleRepository';

const scheduleRepository = createScheduleRepository();

type ScheduleMetaField = keyof Pick<ScheduleData, 'd1name' | 'd1date' | 'd2name' | 'd2date'>;

interface ScheduleState {
  data: ScheduleData;
  loading: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  load: () => Promise<void>;
  updateMeta: (field: ScheduleMetaField, value: string) => Promise<void>;
  updateSlot: (dayKey: DayKey, hour: number, value: string) => Promise<void>;
  toggleChecked: (dayKey: DayKey, hour: number) => Promise<void>;
  replaceSchedule: (data: ScheduleData) => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  data: emptyData(),
  loading: true,
  saveStatus: 'idle',

  async load() {
    set({ loading: true });
    try {
      const data = await scheduleRepository.getActiveSchedule();
      set({ data, loading: false, saveStatus: 'saved' });
    } catch (error) {
      console.error('Load schedule failed:', error);
      set({ loading: false, saveStatus: 'error' });
    }
  },

  async updateMeta(field, value) {
    const data = { ...get().data, [field]: value };
    await persist(data, set);
  },

  async updateSlot(dayKey, hour, value) {
    const current = get().data;
    const data = {
      ...current,
      slots: {
        ...current.slots,
        [hour]: {
          ...current.slots[hour],
          [dayKey]: value,
        },
      },
    };
    await persist(data, set);
  },

  async toggleChecked(dayKey, hour) {
    const current = get().data;
    const checkedKey = `${dayKey}checked` as const;
    const data = {
      ...current,
      slots: {
        ...current.slots,
        [hour]: {
          ...current.slots[hour],
          [checkedKey]: !current.slots[hour][checkedKey],
        },
      },
    };
    await persist(data, set);
  },

  async replaceSchedule(data) {
    await persist(data, set);
  },

  async clearAll() {
    set({ saveStatus: 'saving' });
    try {
      const data = await scheduleRepository.clearSchedule();
      set({ data, saveStatus: 'saved' });
    } catch (error) {
      console.error('Clear schedule failed:', error);
      set({ saveStatus: 'error' });
    }
  },
}));

async function persist(
  data: ScheduleData,
  set: (partial: Partial<ScheduleState>) => void,
): Promise<void> {
  set({ data, saveStatus: 'saving' });
  try {
    await scheduleRepository.saveSchedule(data);
    set({ saveStatus: 'saved' });
  } catch (error) {
    console.error('Save schedule failed:', error);
    set({ saveStatus: 'error' });
  }
}
