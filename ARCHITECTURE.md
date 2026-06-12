# BlueFir Companion — 项目架构文档（LLM 友好版）

> 本文档面向大模型，描述一个完整的桌面/移动端应用的架构设计。目标是让另一个 LLM 能够按照此框架，用相同的技术栈和架构模式，实现一个功能不同但结构一致的新项目。

---

## 1. 项目概览

### 1.1 定位
**蓝杉长者（BlueFir Companion）** 是一个本地优先（Local-First）的日程规划工具，面向长者和家庭用户。核心功能是两天制时间轴日程管理，附带归档、模板、统计、备份、设置和 OTA 更新。

### 1.2 技术栈
| 层 | 技术 | 版本 |
|---|---|---|
| 桌面/移动壳 | Tauri v2 (Rust) | 2.x |
| 数据库插件 | tauri-plugin-sql (SQLite) | 2.x |
| UI 框架 | React | 19.x |
| 状态管理 | Zustand | 5.x |
| 构建工具 | Vite + @vitejs/plugin-react | 8.x |
| 语言 | TypeScript（前端）、Rust（后端） | TS 6.x, Rust 2021 edition |
| 遗留后端 | Express.js + PostgreSQL (Neon) | 4.x, pg 8.x |

### 1.3 运行模式
项目有两种运行模式：

1. **Tauri 模式**（主要）：React 前端 + Rust 后端，SQLite 本地存储，打包为桌面应用或 Android APK
2. **Legacy Web 模式**（遗留）：Express.js 后端 + PostgreSQL 远程数据库，通过 `server.js` 运行

### 1.4 目录结构
```
project-root/
├── src/                          # React 前端源码
│   ├── main.tsx                  # React 入口
│   ├── App.tsx                   # 主组件（所有页面）
│   ├── lib/
│   │   └── schedule.ts           # 核心数据模型与工具函数
│   ├── repositories/             # 数据访问层
│   │   ├── database.ts           # 数据库初始化与连接
│   │   ├── scheduleRepository.ts # 日程 CRUD
│   │   ├── archiveRepository.ts  # 归档 CRUD
│   │   ├── settingsRepository.ts # 设置键值存储
│   │   └── templateRepository.ts # 模板读写
│   ├── stores/                   # 状态管理层（Zustand）
│   │   ├── scheduleStore.ts
│   │   ├── archiveStore.ts
│   │   ├── settingsStore.ts
│   │   └── templateStore.ts
│   └── services/                 # 业务服务层
│       ├── backupService.ts      # 备份导入/导出
│       └── updateService.ts      # OTA 更新检测
├── src-tauri/                    # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json           # Tauri 配置
│   ├── capabilities/default.json # 权限声明
│   └── src/
│       ├── main.rs               # Tauri 入口
│       └── lib.rs                # 插件注册
├── public/                       # Legacy Web 静态资源
├── data/                         # 数据文件目录
├── server.js                     # Legacy Express 后端
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html                    # Vite 入口 HTML
└── render.yaml                   # Render.com 部署配置
```

---

## 2. 架构分层

整个应用采用 **四层架构**：

```
┌─────────────────────────────────────┐
│           UI 层 (React)              │
│  App.tsx — 页面路由 + 所有页面组件    │
└──────────────┬──────────────────────┘
               │ 调用 store actions
┌──────────────▼──────────────────────┐
│         Store 层 (Zustand)           │
│  scheduleStore / archiveStore /      │
│  settingsStore / templateStore       │
│  职责：状态管理 + 调用 repository     │
└──────────────┬──────────────────────┘
               │ 调用 repository methods
┌──────────────▼──────────────────────┐
│       Repository 层                  │
│  scheduleRepository / archiveRepo / │
│  settingsRepo / templateRepo        │
│  职责：数据持久化（SQLite 或 LocalStorage）│
└──────────────┬──────────────────────┘
               │ 使用
┌──────────────▼──────────────────────┐
│      数据库层 (SQLite / LocalStorage) │
│  database.ts — 初始化 schema + 连接  │
│  或 window.localStorage             │
└─────────────────────────────────────┘
```

**关键设计决策**：每个 Repository 都有两个实现类（SQLite 和 LocalStorage），通过工厂函数 `create*Repository()` 根据运行环境自动选择。Android WebView 上使用 LocalStorage，桌面 Tauri 上使用 SQLite。

---

## 3. 核心数据模型

### 3.1 ScheduleData（日程数据）

这是整个应用的核心数据结构，定义在 `src/lib/schedule.ts`：

```typescript
interface ScheduleData {
  d1name: string;        // 第一天的名称（如"今日"）
  d2name: string;        // 第二天的名称（如"明日"）
  d1date: string;        // 第一天的日期文本
  d2date: string;        // 第二天的日期文本
  slots: Record<number, SlotValue>;  // 按小时索引的时间格
  merges: Record<DayKey, Record<number, number>>;  // 合并格信息
}

interface SlotValue {
  d1: string;            // 第一天该时段的内容
  d2: string;            // 第二天该时段的内容
  d1checked: boolean;    // 第一天该时段是否完成
  d2checked: boolean;    // 第二天该时段是否完成
}

type DayKey = 'd1' | 'd2';
```

**时间轴**：24 小时，从 06:00 开始到次日 05:00，按顺序排列：
```typescript
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
```

**时段标签**（用于 UI 显示）：
- 06:00 → "上午"
- 12:00 → "中午"
- 14:00 → "下午"
- 18:00 → "晚上"
- 22:00 → "深夜"
- 00:00 → "凌晨"

### 3.2 ArchiveRecord（归档记录）

```typescript
interface ArchiveRecord {
  id: string;           // UUID
  archiveDate: number;  // 时间戳（毫秒）
  snapshot: ScheduleData;  // 完整快照
}
```

归档是 ScheduleData 的完整拷贝，不做差异对比。

### 3.3 TemplateRecord（模板记录）

```typescript
interface TemplateRecord {
  id: string;           // 唯一标识
  name: string;         // 模板名称
  description: string;  // 模板描述
  template: ScheduleData;  // 模板数据
}
```

### 3.4 AppSettings（应用设置）

```typescript
interface AppSettings {
  elderMode: boolean;           // 长者模式（超大字体）
  highContrast: boolean;        // 高对比度模式
  simplifiedLayout: boolean;    // 简化布局
  reminderLeadMinutes: 0 | 5 | 10 | 30;  // 提前提醒分钟数
  updateManifestUrl: string;    // OTA 更新地址
}
```

### 3.5 BackupPayload（备份格式）

```typescript
interface BackupPayload {
  app: 'BlueFir-Companion';  // 应用标识
  version: 1;                 // 备份格式版本
  exportedAt: number;         // 导出时间戳
  schedule: ScheduleData;     // 当前日程
  archives: ArchiveRecord[];  // 所有归档
  settings: Record<string, string>;  // 所有设置（键值对）
}
```

### 3.6 UpdateManifest（更新清单）

```json
{
  "version": "1.0.1",
  "apkUrl": "https://example.com/downloads/app.apk",
  "notes": "更新说明",
  "publishedAt": "2026-06-04"
}
```

---

## 4. 数据库 Schema（SQLite）

定义在 `src/repositories/database.ts`，共 5 张表：

```sql
-- 日程表（只有一条记录，id='active'）
CREATE TABLE schedule (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 时间格表（每个时间格一条记录）
CREATE TABLE slot (
  id TEXT PRIMARY KEY,          -- 格式: "active:{day_index}:{hour}"
  schedule_id TEXT NOT NULL,    -- 外键 → schedule.id
  day_index INTEGER NOT NULL,   -- 0=第一天, 1=第二天
  hour INTEGER NOT NULL,        -- 0-23
  content TEXT NOT NULL DEFAULT '',
  checked INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (schedule_id) REFERENCES schedule(id) ON DELETE CASCADE
);

-- 归档表
CREATE TABLE archive (
  id TEXT PRIMARY KEY,          -- UUID
  archive_date INTEGER NOT NULL,-- 时间戳
  snapshot_json TEXT NOT NULL   -- ScheduleData JSON 完整快照
);

-- 模板表
CREATE TABLE template (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  template_json TEXT NOT NULL   -- ScheduleData JSON
);

-- 设置表（键值对）
CREATE TABLE settings (
  key TEXT PRIMARY KEY,         -- 如 "app.elderMode"
  value TEXT NOT NULL           -- JSON 序列化的值
);

-- 索引
CREATE INDEX idx_slot_schedule_day_hour ON slot(schedule_id, day_index, hour);
CREATE INDEX idx_archive_date ON archive(archive_date DESC);
```

**注意**：元数据（d1name, d2name, d1date, d2date, merges）存储在 `settings` 表中，key 为 `schedule.active.meta`，value 为 JSON 字符串。

---

## 5. Repository 层详解

每个 Repository 都有 **接口定义** + **两个实现** + **工厂函数** 模式。

### 5.1 数据库路由逻辑 (`database.ts`)

```typescript
// 运行环境检测
function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// SQLite 使用策略：Tauri 桌面端用 SQLite，Android WebView 用 LocalStorage
function shouldUseSqlite(): boolean {
  return isTauriRuntime() && !/Android/i.test(window.navigator.userAgent);
}

// 工厂函数模式 —— 每个 Repository 都这样
function createScheduleRepository(): ScheduleRepository {
  return shouldUseSqlite() ? new SqliteScheduleRepository() : new LocalStorageScheduleRepository();
}
```

### 5.2 scheduleRepository

接口：
```typescript
interface ScheduleRepository {
  getActiveSchedule(): Promise<ScheduleData>;
  saveSchedule(data: ScheduleData): Promise<void>;
  clearSchedule(): Promise<ScheduleData>;
}
```

SQLite 实现要点：
- `getActiveSchedule()`：从 `slot` 表查询所有格子 + 从 `settings` 表读取元数据
- `saveSchedule()`：先更新 `schedule.updated_at`，再 UPSERT 元数据到 `settings`，最后 UPSERT 48 个时间格（2天 × 24小时）
- `clearSchedule()`：保存一个空的 ScheduleData
- 使用 `ensureActiveSchedule()` 确保 `schedule` 表中有 id='active' 的记录

### 5.3 archiveRepository

接口：
```typescript
interface ArchiveRepository {
  listArchives(): Promise<ArchiveRecord[]>;
  getArchive(id: string): Promise<ArchiveRecord | null>;
  createArchive(snapshot: ScheduleData): Promise<ArchiveRecord>;
  replaceArchives(archives: ArchiveRecord[]): Promise<void>;
}
```

SQLite 实现要点：
- `listArchives()`：按 `archive_date DESC` 排序查询
- `createArchive()`：生成 UUID，快照整个 ScheduleData 为 JSON，插入 archive 表
- `replaceArchives()`：先 DELETE 全部，再逐条 INSERT（用于备份导入）

### 5.4 settingsRepository

接口：
```typescript
interface SettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  getAll(): Promise<Record<string, string>>;
}
```

纯键值存储，值为 JSON 序列化的字符串。所有设置 key 以 `app.` 为前缀。

### 5.5 templateRepository

接口：
```typescript
interface TemplateRepository {
  listTemplates(): Promise<TemplateRecord[]>;
  getTemplate(id: string): Promise<TemplateRecord | null>;
  saveTemplate(template: TemplateRecord): Promise<void>;
}
```

SQLite 实现要点：
- `listTemplates()` 首次调用时执行 `seedPresetTemplates()`，将 3 个预置模板 INSERT（ON CONFLICT DO NOTHING）
- 预置模板：退休生活、健康管理、阅读学习

---

## 6. Store 层详解

所有 Store 使用 Zustand 的 `create` 函数，每个 Store 对应一个 Repository。

### 6.1 scheduleStore

```typescript
interface ScheduleState {
  data: ScheduleData;        // 当前日程数据
  loading: boolean;          // 加载状态
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';  // 保存状态

  load: () => Promise<void>;  // 从数据库加载
  updateMeta: (field, value) => Promise<void>;  // 更新元数据
  updateSlot: (dayKey, hour, value) => Promise<void>;  // 更新时间格内容
  toggleChecked: (dayKey, hour) => Promise<void>;  // 切换完成状态
  replaceSchedule: (data) => Promise<void>;  // 替换整个日程（模板/导入）
  clearAll: () => Promise<void>;  // 清空
}
```

**persist 模式**：每次更新都调用 `persist(data, set)` 函数，该函数：
1. 设置 `saveStatus: 'saving'`
2. 调用 `scheduleRepository.saveSchedule(data)`
3. 成功则设置 `saveStatus: 'saved'`，失败则设置 `saveStatus: 'error'`

### 6.2 archiveStore

```typescript
interface ArchiveState {
  archives: ArchiveRecord[];
  selectedArchive: ArchiveRecord | null;
  loading: boolean;

  loadArchives: () => Promise<void>;
  createArchive: (snapshot: ScheduleData) => Promise<ArchiveRecord | null>;
  importArchives: (archives: ArchiveRecord[]) => Promise<void>;
  selectArchive: (id: string) => Promise<void>;
}
```

### 6.3 settingsStore

```typescript
interface SettingsState {
  settings: AppSettings;
  loading: boolean;

  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  importSettings: (settings: Record<string, string>) => Promise<void>;
  exportSettings: () => Promise<Record<string, string>>;
}
```

设置解析逻辑：从 SQLite 的键值对中读取 `app.*` 前缀的 key，通过 `JSON.parse` 反序列化为正确的类型。

### 6.4 templateStore

```typescript
interface TemplateState {
  templates: TemplateRecord[];
  loading: boolean;

  loadTemplates: () => Promise<void>;
}
```

只读 Store，模板应用通过 scheduleStore.replaceSchedule 完成。

---

## 7. UI 层详解

### 7.1 页面路由

**无路由库**。App 组件维护一个 `page` 状态变量：

```typescript
const [page, setPage] = useState<'planner' | 'history' | 'settings' | 'templates' | 'stats' | 'backup' | 'help' | 'update'>('planner');
```

通过条件渲染切换页面：
```tsx
{page === 'planner' ? <PlannerPage /> : page === 'history' ? <HistoryPage /> : ...}
```

### 7.2 页面列表

| 页面 | 功能 | 组件 |
|---|---|---|
| planner（规划） | 主页面，两天时间轴编辑器 | 内联在 App.tsx |
| history（历史） | 归档列表 + 详情查看 | HistoryPage, ArchiveDetail |
| templates（模板） | 模板列表 + 应用 | TemplatesPage |
| stats（统计） | 完成率、连续天数 | StatsPage |
| settings（设置） | 长者模式、对比度等 | SettingsPage |
| backup（备份） | 导出/导入 backup.json | BackupPage |
| help（帮助） | 使用说明 | HelpPage |
| update（更新） | 检查 OTA 更新 | UpdatePage |

### 7.3 核心组件

**App.tsx 中的子组件**：

1. **DayPane** — 单天面板，包含日期输入和时间格列表
2. **TimeSlotCell** — 单个时间格，显示时段标签 + 内容 + 完成勾选框
3. **SlotEditPanel** — 弹出式编辑面板（手机端点击时间格时弹出）
4. **ArchiveDetail** — 归档详情（只读版 DayPane）
5. **StatCard** — 统计卡片

### 7.4 响应式设计

- 移动端：时间格点击弹出 SlotEditPanel 编辑
- 桌面端：直接在 textarea 中编辑
- 通过 `window.matchMedia('(max-width: 720px)')` 检测
- CSS 类：`mobile-day-switcher`、`mobile-editable`、`is-switchable`

### 7.5 无障碍与适老化

通过 CSS 类控制：
- `elder-mode`：超大字体与按钮
- `high-contrast-mode`：高对比度
- `simplified-layout`：简化布局

---

## 8. Service 层

### 8.1 backupService

```typescript
// 导出
function createBackupPayload(input): BackupPayload
function downloadBackup(payload: BackupPayload): void  // 创建 Blob + 触发下载

// 导入
function parseBackup(text: string): BackupPayload  // 校验 app + version 字段
```

导出流程：序列化 ScheduleData + Archives + Settings → JSON → Blob → 下载 backup.json

导入流程：读取文件 → parseBackup 校验格式 → replaceSchedule + importArchives + importSettings

### 8.2 updateService

```typescript
async function checkForUpdate(manifestUrl: string): Promise<UpdateCheckResult>
async function openApkDownload(apkUrl: string): Promise<void>
```

更新流程：
1. fetch 远程 update.json（带 cache-buster 参数 `_t=Date.now()`）
2. 校验 manifest 格式（必须有 version 和 apkUrl）
3. 比较版本号（逐段数字比较）
4. 有更新则通过 `@tauri-apps/plugin-opener` 打开 APK 下载链接
5. Fallback：`window.location.href = apkUrl`

版本比较：`compareVersions("1.0.2", "1.0.1")` → 逐段数字差值

---

## 9. Tauri 后端配置

### 9.1 tauri.conf.json 关键配置

```json
{
  "productName": "蓝杉长者",
  "identifier": "com.bluefir.companion",
  "app": {
    "windows": [{
      "title": "蓝杉长者",
      "width": 1180, "height": 820,
      "minWidth": 360, "minHeight": 640
    }]
  },
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  }
}
```

### 9.2 Rust 端插件注册 (`lib.rs`)

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())      // 文件对话框
    .plugin(tauri_plugin_fs::init())           // 文件系统
    .plugin(tauri_plugin_notification::init()) // 通知
    .plugin(tauri_plugin_opener::init())       // 打开外部链接
    .plugin(tauri_plugin_sql::Builder::default().build())  // SQLite
    .run(tauri::generate_context!())
```

### 9.3 权限声明 (`capabilities/default.json`)

```json
{
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:default",
    "notification:default",
    "opener:default",
    "sql:default"
  ]
}
```

### 9.4 构建产物

- 桌面端：各平台原生安装包
- 移动端：`BlueFir-Companion-arm64-debug.apk`（Android ARM64）
- crate-type: `staticlib`, `cdylib`, `rlib`（支持多种链接方式）

---

## 10. Legacy Web 模式（server.js）

### 10.1 双存储后端

`server.js` 支持两种存储驱动：
- **PostgreSQL**（默认）：使用 Neon 托管数据库
- **File**（降级）：本地 JSON 文件 `data/local-store.json`

### 10.2 API 路由

| 方法 | 路径 | 功能 |
|---|---|---|
| GET | `/api/schedule` | 获取当前日程 |
| POST | `/api/schedule` | 保存日程 |
| GET | `/api/archives` | 列出所有归档 |
| GET | `/api/archives/:id` | 获取单个归档 |
| POST | `/api/archives` | 创建归档 |
| GET | `/api/export` | 导出完整快照 |
| GET | `/health` | 健康检查 |

### 10.3 Realm（多租户）

server.js 支持 realm 参数实现多用户隔离：
- 通过 `?realm=xxx` 查询参数传递
- realm slug 规则：`/^[一-龥a-z0-9]+(-[一-龥a-z0-9]+)*$/`
- 每个 realm 独立的日程和归档
- 默认 realm 为 `main`

### 10.4 备份机制

- 每次写入后自动备份到 `data/backups/time-river-latest.json`
- 归档创建时额外备份到 `data/backups/archives/{timestamp}-{title}.json`
- 使用原子写入（先写 .tmp 再 rename）

---

## 11. 构建与部署

### 11.1 开发

```bash
# Tauri 开发模式（前端 + Rust 热重载）
npm run tauri dev

# 仅前端开发（Legacy 模式）
npm run dev

# Legacy 服务端
npm run legacy:dev
```

### 11.2 构建

```bash
# 构建前端 + Rust
npm run tauri build

# 仅构建前端
npm run build
```

### 11.3 部署

- **Render.com**：通过 `render.yaml` 配置，Node.js 运行时，使用 Neon PostgreSQL
- **Android**：通过 Tauri 交叉编译为 ARM64 APK
- **桌面**：通过 Tauri 构建各平台原生安装包

---

## 12. 复用指南：如何用此架构实现新项目

### 12.1 替换域模型

1. 定义你的核心数据结构（类似 ScheduleData）
2. 在 `src/lib/` 下创建对应的 `xxx.ts`，包含类型定义、工厂函数、工具函数
3. 定义常量（如 HOURS 替换为你的维度）

### 12.2 替换数据层

1. 在 `database.ts` 中添加新的 `CREATE TABLE` 语句
2. 在 `src/repositories/` 下创建新的 `xxxRepository.ts`
3. 实现接口 + SQLite 实现 + LocalStorage 实现 + 工厂函数

### 12.3 替换状态层

1. 在 `src/stores/` 下创建新的 `xxxStore.ts`
2. 使用 Zustand 的 `create` 函数
3. Store 中调用对应的 Repository

### 12.4 替换 UI

1. 在 `App.tsx` 中添加新的 page 分支
2. 创建对应的页面组件
3. 在顶部导航栏添加按钮
4. 定义新的 Page 类型联合

### 12.5 关键模式总结

| 模式 | 实现方式 |
|---|---|
| 无路由页面切换 | `useState<'page1' \| 'page2' \| ...>` + 条件渲染 |
| 双存储后端 | 接口 + SQLite/LocalStorage 双实现 + 工厂函数 |
| 状态管理 | Zustand store，每个实体一个 store |
| 数据持久化 | Repository → SQLite (via tauri-plugin-sql) 或 LocalStorage |
| 全量备份 | JSON 序列化所有数据 → Blob → 下载 |
| OTA 更新 | 远程 JSON manifest + 版本比较 + opener 打开链接 |
| 响应式 | CSS media query + 移动端弹出编辑面板 |
| 适老化 | CSS 类切换（elder-mode / high-contrast / simplified） |

---

## 13. 依赖清单

### 前端运行时依赖
- `@tauri-apps/api` ^2.11.0 — Tauri 前端 API
- `@tauri-apps/plugin-dialog` ^2.7.1 — 文件对话框
- `@tauri-apps/plugin-fs` ^2.5.1 — 文件系统
- `@tauri-apps/plugin-notification` ^2.3.3 — 系统通知
- `@tauri-apps/plugin-opener` ^2.5.4 — 打开外部链接
- `@tauri-apps/plugin-sql` ^2.4.0 — SQLite 数据库
- `react` ^19.2.7 — UI 框架
- `react-dom` ^19.2.7 — React DOM 渲染
- `zustand` ^5.0.14 — 状态管理
- `express` ^4.18.3 — Legacy 服务端框架
- `pg` ^8.21.0 — PostgreSQL 客户端

### 前端开发依赖
- `@tauri-apps/cli` ^2.11.2 — Tauri CLI
- `@types/react` ^19.2.16 — React 类型
- `@types/react-dom` ^19.2.3 — ReactDOM 类型
- `@vitejs/plugin-react` ^6.0.2 — Vite React 插件
- `typescript` ^6.0.3 — TypeScript 编译器
- `vite` ^8.0.16 — 构建工具

### Rust 依赖
- `tauri` 2 — Tauri 框架
- `tauri-build` 2 — Tauri 构建工具
- `tauri-plugin-dialog` 2 — 对话框插件
- `tauri-plugin-fs` 2 — 文件系统插件
- `tauri-plugin-notification` 2 — 通知插件
- `tauri-plugin-opener` 2 — 链接打开插件
- `tauri-plugin-sql` 2 (features=["sqlite"]) — SQL 插件
- `serde` 1 (features=["derive"]) — 序列化
- `serde_json` 1 — JSON 序列化
