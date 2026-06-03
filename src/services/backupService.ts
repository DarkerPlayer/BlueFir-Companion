import { ScheduleData, mergeScheduleData } from '../lib/schedule';
import { ArchiveRecord } from '../repositories/archiveRepository';

export interface BackupPayload {
  app: 'BlueFir-Companion';
  version: 1;
  exportedAt: number;
  schedule: ScheduleData;
  archives: ArchiveRecord[];
  settings: Record<string, string>;
}

export function createBackupPayload(input: {
  schedule: ScheduleData;
  archives: ArchiveRecord[];
  settings: Record<string, string>;
}): BackupPayload {
  return {
    app: 'BlueFir-Companion',
    version: 1,
    exportedAt: Date.now(),
    schedule: mergeScheduleData(input.schedule),
    archives: input.archives,
    settings: input.settings,
  };
}

export function downloadBackup(payload: BackupPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'backup.json';
  link.click();
  URL.revokeObjectURL(url);
}

export function parseBackup(text: string): BackupPayload {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.app !== 'BlueFir-Companion' || parsed.version !== 1) {
    throw new Error('备份文件格式不正确');
  }

  return {
    app: 'BlueFir-Companion',
    version: 1,
    exportedAt: Number(parsed.exportedAt) || Date.now(),
    schedule: mergeScheduleData(parsed.schedule),
    archives: Array.isArray(parsed.archives)
      ? parsed.archives.map((archive: Partial<ArchiveRecord>) => ({
          id: String(archive.id || crypto.randomUUID()),
          archiveDate: Number(archive.archiveDate) || Date.now(),
          snapshot: mergeScheduleData(archive.snapshot),
        }))
      : [],
    settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {},
  };
}
