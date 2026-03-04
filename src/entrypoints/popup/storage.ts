import type { FeishuConfig } from "./types";

const STORAGE_KEY = "weread_feishu_sync_config";

const DEFAULT_CONFIG: FeishuConfig = {
  docUrl: "",
  appId: "",
  appSecret: "",
  tenantAccessToken: "",
};

function hasBrowserStorage(): boolean {
  try {
    return typeof browser !== "undefined" && !!browser.storage?.local;
  } catch {
    return false;
  }
}

function hasChromeStorage(): boolean {
  try {
    return typeof chrome !== "undefined" && !!chrome.storage?.local;
  } catch {
    return false;
  }
}

export async function loadConfig(): Promise<FeishuConfig> {
  if (hasBrowserStorage()) {
    const result = await browser.storage.local.get(STORAGE_KEY);
    return {
      ...DEFAULT_CONFIG,
      ...(result?.[STORAGE_KEY] ?? {}),
    };
  }

  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return {
      ...DEFAULT_CONFIG,
      ...(result?.[STORAGE_KEY] ?? {}),
    };
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    return {
      ...DEFAULT_CONFIG,
      ...JSON.parse(raw),
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: FeishuConfig): Promise<void> {
  if (hasBrowserStorage()) {
    await browser.storage.local.set({ [STORAGE_KEY]: config });
    return;
  }

  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [STORAGE_KEY]: config });
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
