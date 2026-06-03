import { create } from 'zustand';
import { ScheduleData } from '../lib/schedule';
import { ArchiveRecord, createArchiveRepository } from '../repositories/archiveRepository';

const archiveRepository = createArchiveRepository();

interface ArchiveState {
  archives: ArchiveRecord[];
  selectedArchive: ArchiveRecord | null;
  loading: boolean;
  loadArchives: () => Promise<void>;
  createArchive: (snapshot: ScheduleData) => Promise<ArchiveRecord | null>;
  importArchives: (archives: ArchiveRecord[]) => Promise<void>;
  selectArchive: (id: string) => Promise<void>;
}

export const useArchiveStore = create<ArchiveState>((set) => ({
  archives: [],
  selectedArchive: null,
  loading: false,

  async loadArchives() {
    set({ loading: true });
    try {
      const archives = await archiveRepository.listArchives();
      set({
        archives,
        selectedArchive: archives[0] || null,
        loading: false,
      });
    } catch (error) {
      console.error('Load archives failed:', error);
      set({ loading: false });
    }
  },

  async createArchive(snapshot) {
    set({ loading: true });
    try {
      const archive = await archiveRepository.createArchive(snapshot);
      const archives = await archiveRepository.listArchives();
      set({ archives, selectedArchive: archive, loading: false });
      return archive;
    } catch (error) {
      console.error('Create archive failed:', error);
      set({ loading: false });
      return null;
    }
  },

  async importArchives(archives) {
    set({ loading: true });
    try {
      await archiveRepository.replaceArchives(archives);
      const nextArchives = await archiveRepository.listArchives();
      set({ archives: nextArchives, selectedArchive: nextArchives[0] || null, loading: false });
    } catch (error) {
      console.error('Import archives failed:', error);
      set({ loading: false });
    }
  },

  async selectArchive(id) {
    set({ loading: true });
    try {
      const archive = await archiveRepository.getArchive(id);
      set({ selectedArchive: archive, loading: false });
    } catch (error) {
      console.error('Select archive failed:', error);
      set({ loading: false });
    }
  },
}));
