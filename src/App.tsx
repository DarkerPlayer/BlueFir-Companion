import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  DAY_KEYS,
  HOURS,
  DayKey,
  ScheduleData,
  buildSummary,
  countEntries,
  formatDateTime,
  formatHour,
  getPeriodLabel,
} from './lib/schedule';
import { ArchiveRecord } from './repositories/archiveRepository';
import { TemplateRecord } from './repositories/templateRepository';
import { createBackupPayload, downloadBackup, parseBackup } from './services/backupService';
import { useArchiveStore } from './stores/archiveStore';
import { useScheduleStore } from './stores/scheduleStore';
import { AppSettings, useSettingsStore } from './stores/settingsStore';
import { useTemplateStore } from './stores/templateStore';

const dayLabels: Record<DayKey, string> = {
  d1: '第一天',
  d2: '第二天',
};

const checkedKeyFor = (dayKey: DayKey) => `${dayKey}checked` as const;

export function App() {
  const { clearAll, data, load, loading, replaceSchedule, saveStatus, toggleChecked, updateMeta, updateSlot } = useScheduleStore();
  const { archives, createArchive, importArchives, loadArchives, selectedArchive, selectArchive } = useArchiveStore();
  const { exportSettings, importSettings, loadSettings, settings, updateSetting } = useSettingsStore();
  const { loadTemplates, templates } = useTemplateStore();
  const [page, setPage] = useState<'planner' | 'history' | 'settings' | 'templates' | 'stats' | 'backup'>('planner');
  const [activeMobileDay, setActiveMobileDay] = useState<DayKey>('d1');
  const [summaryVisible, setSummaryVisible] = useState(false);

  const summary = useMemo(() => buildSummary(data), [data]);

  useEffect(() => {
    void load();
    void loadSettings();
  }, [load, loadSettings]);

  useEffect(() => {
    if (page === 'history' || page === 'stats' || page === 'backup') {
      void loadArchives();
    }
    if (page === 'templates') {
      void loadTemplates();
    }
  }, [loadArchives, loadTemplates, page]);

  async function handleClearAll() {
    if (!window.confirm('确定清空当前日程吗？')) return;
    await clearAll();
    setSummaryVisible(false);
  }

  async function handleCreateArchive() {
    const archive = await createArchive(data);
    if (archive) {
      setPage('history');
    }
  }

  async function handleApplyTemplate(template: TemplateRecord) {
    if (!window.confirm(`应用模板「${template.name}」会覆盖当前计划，确定继续吗？`)) return;
    await replaceSchedule(template.template);
    setPage('planner');
  }

  async function handleExportBackup() {
    const settingsSnapshot = await exportSettings();
    downloadBackup(createBackupPayload({ schedule: data, archives, settings: settingsSnapshot }));
  }

  async function handleImportBackup(file: File) {
    const payload = parseBackup(await file.text());
    if (!window.confirm('导入备份会覆盖当前计划、归档和设置。确定继续吗？')) return;
    await replaceSchedule(payload.schedule);
    await importArchives(payload.archives);
    await importSettings(payload.settings);
    await loadArchives();
    setPage('planner');
  }

  const statusText = loading
    ? '读取本地数据'
    : saveStatus === 'saving'
      ? '保存中'
      : saveStatus === 'error'
        ? '保存失败'
        : '本地已保存';

  return (
    <div
      className={`page-shell${settings.elderMode ? ' elder-mode' : ''}${settings.highContrast ? ' high-contrast-mode' : ''}${settings.simplifiedLayout ? ' simplified-layout' : ''}`}
    >
      <header className="topbar topbar-minimal topbar-mobile-dock">
        <div className="topbar-actions">
          <div className={`sync-status ${saveStatus === 'error' ? 'error' : saveStatus === 'saving' ? 'syncing' : 'synced'}`}>
            <div className="sync-dot" />
            <span>{statusText}</span>
          </div>
          <button className="btn btn-accent" type="button">
            蓝杉长者
          </button>
          <button className="btn" type="button" onClick={() => setPage('planner')}>规划</button>
          <button className="btn" type="button" onClick={() => setPage('history')}>历史</button>
          <button className="btn" type="button" onClick={() => setPage('templates')}>模板</button>
          <button className="btn" type="button" onClick={() => setPage('stats')}>统计</button>
          <button className="btn" type="button" onClick={() => setPage('settings')}>设置</button>
          <button className="btn" type="button" onClick={() => setPage('backup')}>备份</button>
          {page === 'planner' ? (
            <button className="btn btn-accent" type="button" onClick={handleCreateArchive}>
              封存
            </button>
          ) : null}
          <button className="btn" type="button" onClick={() => setSummaryVisible(true)}>
            摘要
          </button>
          <button className="btn" type="button" onClick={() => window.print()}>
            打印
          </button>
          <button className="btn btn-danger" type="button" onClick={handleClearAll}>
            清空
          </button>
        </div>
      </header>

      {page === 'planner' ? (
      <main className="main-layout">
        <section className="planner-card">
          <div className="mobile-day-switcher" aria-label="切换日期">
            {DAY_KEYS.map((dayKey) => (
              <button
                className={`mobile-day-button${activeMobileDay === dayKey ? ' active' : ''}`}
                key={dayKey}
                type="button"
                aria-pressed={activeMobileDay === dayKey}
                onClick={() => setActiveMobileDay(dayKey)}
              >
                {dayLabels[dayKey]}
              </button>
            ))}
          </div>

          <div className="days-grid is-switchable" data-active-day={activeMobileDay}>
            {DAY_KEYS.map((dayKey) => (
              <DayPane
                data={data}
                dayKey={dayKey}
                key={dayKey}
                onMetaChange={updateMeta}
                onSlotChange={updateSlot}
                onToggleChecked={toggleChecked}
              />
            ))}
          </div>
        </section>

        <div className="meta-row">
          <div className="last-sync">Local First · Offline First</div>
          <div className="toast visible">当前数据写入本地存储层</div>
        </div>

        <section className={`summary-panel${summaryVisible ? ' visible' : ''}`}>
          <div className="panel-header">
            <h2>摘要</h2>
            <div className="panel-actions">
              <button className="btn" type="button" onClick={() => navigator.clipboard.writeText(summary)}>
                复制
              </button>
            </div>
          </div>
          <pre className="summary-body">{summary}</pre>
        </section>
      </main>
      ) : page === 'history' ? (
        <HistoryPage archives={archives} selectedArchive={selectedArchive} onSelectArchive={selectArchive} />
      ) : page === 'templates' ? (
        <TemplatesPage templates={templates} onApplyTemplate={handleApplyTemplate} />
      ) : page === 'stats' ? (
        <StatsPage archives={archives} data={data} />
      ) : page === 'settings' ? (
        <SettingsPage settings={settings} onUpdateSetting={updateSetting} />
      ) : (
        <BackupPage onExportBackup={handleExportBackup} onImportBackup={handleImportBackup} />
      )}
    </div>
  );
}

interface DayPaneProps {
  data: ScheduleData;
  dayKey: DayKey;
  onMetaChange: (
    field: keyof Pick<ScheduleData, 'd1name' | 'd1date' | 'd2name' | 'd2date'>,
    value: string,
  ) => void;
  onSlotChange: (dayKey: DayKey, hour: number, value: string) => void;
  onToggleChecked: (dayKey: DayKey, hour: number) => void;
}

function DayPane({ data, dayKey, onMetaChange, onSlotChange, onToggleChecked }: DayPaneProps) {
  const nameKey = `${dayKey}name` as const;
  const dateKey = `${dayKey}date` as const;

  return (
    <section className="day-pane" data-day={dayKey}>
      <div className="day-card">
        <div className="day-card-head">
          <span className="day-chip">{dayLabels[dayKey]}</span>
        </div>
        <input
          placeholder={dayLabels[dayKey]}
          value={data[nameKey]}
          onChange={(event) => onMetaChange(nameKey, event.target.value)}
        />
        <input
          className="date-input"
          placeholder="日期"
          value={data[dateKey]}
          onChange={(event) => onMetaChange(dateKey, event.target.value)}
        />
      </div>

      <div className="day-column" style={{ '--rows': String(HOURS.length) } as React.CSSProperties}>
        {HOURS.map((hour) => (
          <TimeSlotCell
            checked={data.slots[hour][checkedKeyFor(dayKey)]}
            dayKey={dayKey}
            hour={hour}
            key={hour}
            value={data.slots[hour][dayKey]}
            onChange={onSlotChange}
            onToggleChecked={onToggleChecked}
          />
        ))}
      </div>
    </section>
  );
}

interface TimeSlotCellProps {
  checked: boolean;
  dayKey: DayKey;
  hour: number;
  value: string;
  onChange: (dayKey: DayKey, hour: number, value: string) => void;
  onToggleChecked: (dayKey: DayKey, hour: number) => void;
}

function TimeSlotCell({ checked, dayKey, hour, value, onChange, onToggleChecked }: TimeSlotCellProps) {
  const period = getPeriodLabel(hour);
  const hasContent = Boolean(value.trim());

  return (
    <>
      <div className="time-stamp">
        {period ? <span className="period-pill">{period}</span> : null}
        <span className="time-value">{formatHour(hour)}</span>
      </div>
      <div className={`slot-card${hasContent ? ' has-content' : ''}${checked ? ' slot-checked' : ''}`}>
        <textarea
          className="slot-input"
          rows={1}
          value={value}
          onChange={(event) => onChange(dayKey, hour, event.target.value)}
        />
        {hasContent ? (
          <button
            className={`slot-checkbox${checked ? ' checked' : ''}`}
            type="button"
            aria-label={checked ? '取消完成' : '标记完成'}
            onClick={() => onToggleChecked(dayKey, hour)}
          >
            {checked ? (
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3 8.5L6.5 12L13 4"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            ) : null}
          </button>
        ) : null}
      </div>
    </>
  );
}

interface HistoryPageProps {
  archives: ArchiveRecord[];
  selectedArchive: ArchiveRecord | null;
  onSelectArchive: (id: string) => Promise<void>;
}

function HistoryPage({ archives, selectedArchive, onSelectArchive }: HistoryPageProps) {
  return (
    <main className="history-layout">
      <aside className="timeline-panel">
        <div className="panel-header compact">
          <h2>历史归档</h2>
          <span className="timeline-count">{archives.length} 条</span>
        </div>

        {archives.length ? (
          <div className="timeline-list">
            {archives.map((archive) => (
              <button
                className={`timeline-item${selectedArchive?.id === archive.id ? ' active' : ''}`}
                key={archive.id}
                type="button"
                onClick={() => void onSelectArchive(archive.id)}
              >
                <span className="timeline-item-title">{archiveTitle(archive)}</span>
                <span className="timeline-item-meta">{formatDateTime(archive.archiveDate)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>还没有封存内容。</p>
          </div>
        )}
      </aside>

      <section className="archive-panel">
        {selectedArchive ? (
          <ArchiveDetail archive={selectedArchive} />
        ) : (
          <div className="empty-state">
            <p>选择左侧一条封存记录。</p>
          </div>
        )}
      </section>
    </main>
  );
}

function ArchiveDetail({ archive }: { archive: ArchiveRecord }) {
  const counts = countEntries(archive.snapshot);
  const summary = buildSummary(archive.snapshot);

  return (
    <div className="archive-detail">
      <div className="panel-header">
        <div>
          <h2>{archiveTitle(archive)}</h2>
          <div className="archive-meta-line">
            <span>{formatDateTime(archive.archiveDate)}</span>
            <span>{counts.total} 项 / {counts.totalHours} 小时</span>
          </div>
        </div>
      </div>

      <section className="planner-card readonly compact-card">
        <div className="days-grid readonly-days">
          {DAY_KEYS.map((dayKey) => (
            <section className="day-pane" data-day={dayKey} key={dayKey}>
              <div className="day-card readonly">
                <div className="day-card-head">
                  <span className="day-chip">{dayLabels[dayKey]}</span>
                </div>
                <strong className="readonly-day-name">
                  {archive.snapshot[`${dayKey}name`] || dayLabels[dayKey]}
                </strong>
                <span className="readonly-day-date">
                  {archive.snapshot[`${dayKey}date`] || '未填写日期'}
                </span>
              </div>
              <ReadonlyDayColumn archive={archive} dayKey={dayKey} />
            </section>
          ))}
        </div>
      </section>

      <section className="summary-panel visible simple-panel">
        <div className="panel-header compact">
          <h2>摘要</h2>
        </div>
        <pre className="summary-body">{summary}</pre>
      </section>
    </div>
  );
}

function ReadonlyDayColumn({ archive, dayKey }: { archive: ArchiveRecord; dayKey: DayKey }) {
  return (
    <div className="day-column readonly" style={{ '--rows': String(HOURS.length) } as React.CSSProperties}>
      {HOURS.map((hour) => {
        const value = archive.snapshot.slots[hour][dayKey].trim();
        const checked = archive.snapshot.slots[hour][checkedKeyFor(dayKey)];
        const period = getPeriodLabel(hour);

        return (
          <Fragment key={hour}>
            <div className="time-stamp">
              {period ? <span className="period-pill">{period}</span> : null}
              <span className="time-value">{formatHour(hour)}</span>
            </div>
            <div className={`slot-card readonly-slot${value ? ' has-content' : ' is-empty'}${checked ? ' slot-checked' : ''}`}>
              {value}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function archiveTitle(archive: ArchiveRecord): string {
  const left = archive.snapshot.d1name.trim() || '第一天';
  const right = archive.snapshot.d2name.trim() || '第二天';
  return `${left} · ${right}`;
}

function TemplatesPage({
  templates,
  onApplyTemplate,
}: {
  templates: TemplateRecord[];
  onApplyTemplate: (template: TemplateRecord) => Promise<void>;
}) {
  return (
    <main className="main-layout">
      <section className="summary-panel visible simple-panel">
        <div className="panel-header">
          <h2>模板系统</h2>
        </div>
        <div className="template-grid">
          {templates.map((template) => (
            <article className="template-card" key={template.id}>
              <h3>{template.name}</h3>
              <p>{template.description}</p>
              <button className="btn btn-accent" type="button" onClick={() => void onApplyTemplate(template)}>
                应用模板
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatsPage({ archives, data }: { archives: ArchiveRecord[]; data: ScheduleData }) {
  const today = completionRate(data);
  const week = rangeCompletionRate(archives, 7, data);
  const month = rangeCompletionRate(archives, 30, data);
  const streak = completionStreak(archives, data);

  return (
    <main className="main-layout">
      <section className="summary-panel visible simple-panel">
        <div className="panel-header">
          <h2>统计分析</h2>
        </div>
        <div className="stats-grid">
          <StatCard label="今日完成率" value={`${today}%`} />
          <StatCard label="周完成率" value={`${week}%`} />
          <StatCard label="月完成率" value={`${month}%`} />
          <StatCard label="连续完成天数" value={`${streak} 天`} />
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SettingsPage({
  settings,
  onUpdateSetting,
}: {
  settings: AppSettings;
  onUpdateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}) {
  return (
    <main className="main-layout">
      <section className="summary-panel visible simple-panel">
        <div className="panel-header">
          <h2>设置</h2>
        </div>
        <div className="settings-list">
          <ToggleSetting
            checked={settings.elderMode}
            label="长者模式：超大字体与按钮"
            onChange={(checked) => void onUpdateSetting('elderMode', checked)}
          />
          <ToggleSetting
            checked={settings.highContrast}
            label="高对比度模式"
            onChange={(checked) => void onUpdateSetting('highContrast', checked)}
          />
          <ToggleSetting
            checked={settings.simplifiedLayout}
            label="简化布局"
            onChange={(checked) => void onUpdateSetting('simplifiedLayout', checked)}
          />
          <label className="setting-row">
            <span>本地提醒提前时间</span>
            <select
              className="merge-select"
              value={settings.reminderLeadMinutes}
              onChange={(event) => void onUpdateSetting('reminderLeadMinutes', Number(event.target.value) as AppSettings['reminderLeadMinutes'])}
            >
              <option value={0}>准时提醒</option>
              <option value={5}>提前 5 分钟</option>
              <option value={10}>提前 10 分钟</option>
              <option value={30}>提前 30 分钟</option>
            </select>
          </label>
        </div>
      </section>
    </main>
  );
}

function ToggleSetting({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="setting-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function BackupPage({
  onExportBackup,
  onImportBackup,
}: {
  onExportBackup: () => Promise<void>;
  onImportBackup: (file: File) => Promise<void>;
}) {
  return (
    <main className="main-layout">
      <section className="summary-panel visible simple-panel">
        <div className="panel-header">
          <h2>数据备份</h2>
        </div>
        <div className="backup-actions">
          <button className="btn btn-accent" type="button" onClick={() => void onExportBackup()}>
            导出 backup.json
          </button>
          <label className="btn">
            导入 backup.json
            <input
              accept="application/json"
              className="hidden"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onImportBackup(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>
        <p className="summary-body">
          导出文件包含当前计划、历史归档和本地设置；导入时会覆盖当前本地数据。
        </p>
      </section>
    </main>
  );
}

function completionRate(data: ScheduleData): number {
  const blocks = DAY_KEYS.flatMap((dayKey) => HOURS
    .map((hour) => ({
      value: data.slots[hour][dayKey].trim(),
      checked: data.slots[hour][checkedKeyFor(dayKey)],
    }))
    .filter((slot) => slot.value));

  if (!blocks.length) return 0;
  return Math.round((blocks.filter((block) => block.checked).length / blocks.length) * 100);
}

function rangeCompletionRate(archives: ArchiveRecord[], days: number, current: ScheduleData): number {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const snapshots = [current, ...archives.filter((archive) => archive.archiveDate >= since).map((archive) => archive.snapshot)];
  const rates = snapshots.map(completionRate).filter((rate) => rate > 0);
  if (!rates.length) return 0;
  return Math.round(rates.reduce((total, rate) => total + rate, 0) / rates.length);
}

function completionStreak(archives: ArchiveRecord[], current: ScheduleData): number {
  const ordered = [current, ...archives.map((archive) => archive.snapshot)];
  let streak = 0;
  for (const snapshot of ordered) {
    if (completionRate(snapshot) < 80) break;
    streak += 1;
  }
  return streak;
}
