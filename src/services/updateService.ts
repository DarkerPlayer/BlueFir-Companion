import { openUrl } from '@tauri-apps/plugin-opener';

export const CURRENT_APP_VERSION = '1.0.1';

export interface UpdateManifest {
  version: string;
  apkUrl: string;
  notes: string;
  publishedAt?: string;
}

export interface UpdateCheckResult {
  currentVersion: string;
  manifest: UpdateManifest;
  hasUpdate: boolean;
}

export async function checkForUpdate(manifestUrl: string): Promise<UpdateCheckResult> {
  if (!manifestUrl.trim()) {
    throw new Error('请先填写 update.json 地址');
  }

  const response = await fetch(withCacheBuster(manifestUrl.trim()), {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`检查更新失败：HTTP ${response.status}`);
  }

  const manifest = normalizeManifest(await response.json());
  return {
    currentVersion: CURRENT_APP_VERSION,
    manifest,
    hasUpdate: compareVersions(manifest.version, CURRENT_APP_VERSION) > 0,
  };
}

export async function openApkDownload(apkUrl: string): Promise<void> {
  if (!apkUrl.trim()) {
    throw new Error('APK 下载地址为空');
  }

  try {
    await openUrl(apkUrl);
  } catch {
    window.location.href = apkUrl;
  }
}

function normalizeManifest(value: unknown): UpdateManifest {
  if (!value || typeof value !== 'object') {
    throw new Error('update.json 格式不正确');
  }

  const manifest = value as Partial<UpdateManifest>;
  if (!manifest.version || !manifest.apkUrl) {
    throw new Error('update.json 必须包含 version 和 apkUrl');
  }

  return {
    version: String(manifest.version),
    apkUrl: String(manifest.apkUrl),
    notes: String(manifest.notes || '发现新版本'),
    publishedAt: manifest.publishedAt ? String(manifest.publishedAt) : undefined,
  };
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number(part) || 0);
  const rightParts = right.split('.').map((part) => Number(part) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

function withCacheBuster(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('_t', String(Date.now()));
  return parsed.toString();
}
