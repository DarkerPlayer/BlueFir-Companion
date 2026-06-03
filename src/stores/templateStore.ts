import { create } from 'zustand';
import { TemplateRecord, createTemplateRepository } from '../repositories/templateRepository';

const templateRepository = createTemplateRepository();

interface TemplateState {
  templates: TemplateRecord[];
  loading: boolean;
  loadTemplates: () => Promise<void>;
}

export const useTemplateStore = create<TemplateState>((set) => ({
  templates: [],
  loading: false,

  async loadTemplates() {
    set({ loading: true });
    try {
      const templates = await templateRepository.listTemplates();
      set({ templates, loading: false });
    } catch (error) {
      console.error('Load templates failed:', error);
      set({ loading: false });
    }
  },
}));
