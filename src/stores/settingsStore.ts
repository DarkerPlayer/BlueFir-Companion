import { create } from 'zustand';
import { createSettingsRepository } from '../repositories/settingsRepository';

const settingsRepository = createSettingsRepository();

export interface AppSettings {
  elderMode: boolean;
  highContrast: boolean;
  simplifiedLayout: boolean;
  reminderLeadMinutes: 0 | 5 | 10 | 30;
}

const defaultSettings: AppSettings = {
  elderMode: false,
  highContrast: false,
  simplifiedLayout: false,
  reminderLeadMinutes: 10,
};

interface SettingsState {
  settings: AppSettings;
  loading: boolean;
  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  importSettings: (settings: Record<string, string>) => Promise<void>;
  exportSettings: () => Promise<Record<string, string>>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: true,

  async loadSettings() {
    set({ loading: true });
    try {
      const stored = await settingsRepository.getAll();
      set({ settings: parseSettings(stored), loading: false });
    } catch (error) {
      console.error('Load settings failed:', error);
      set({ loading: false });
    }
  },

  async updateSetting(key, value) {
    const settings = { ...get().settings, [key]: value };
    set({ settings });
    await settingsRepository.set(`app.${key}`, JSON.stringify(value));
  },

  async importSettings(settings) {
    for (const [key, value] of Object.entries(settings)) {
      await settingsRepository.set(key, value);
    }
    set({ settings: parseSettings(settings) });
  },

  async exportSettings() {
    return settingsRepository.getAll();
  },
}));

function parseSettings(values: Record<string, string>): AppSettings {
  return {
    elderMode: readBoolean(values['app.elderMode'], defaultSettings.elderMode),
    highContrast: readBoolean(values['app.highContrast'], defaultSettings.highContrast),
    simplifiedLayout: readBoolean(values['app.simplifiedLayout'], defaultSettings.simplifiedLayout),
    reminderLeadMinutes: readReminderLead(values['app.reminderLeadMinutes']),
  };
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  try {
    return Boolean(JSON.parse(value));
  } catch {
    return fallback;
  }
}

function readReminderLead(value: string | undefined): AppSettings['reminderLeadMinutes'] {
  if (!value) return defaultSettings.reminderLeadMinutes;
  try {
    const parsed = Number(JSON.parse(value));
    return parsed === 0 || parsed === 5 || parsed === 10 || parsed === 30
      ? parsed
      : defaultSettings.reminderLeadMinutes;
  } catch {
    return defaultSettings.reminderLeadMinutes;
  }
}
