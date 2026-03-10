import { invoke } from "@tauri-apps/api/core";

const PORTAL_BASE_URL_KEY = "portalBaseUrl";
const API_KEY_KEY = "apiKey";
const TEXT_SCALE_KEY = "textScale";

export const DEFAULT_TEXT_SCALE = 1.5;
export const MIN_TEXT_SCALE = 1;
export const MAX_TEXT_SCALE = 2.5;
export const TEXT_SCALE_STEP = 0.1;

export type DeviceConfig = {
  portalBaseUrl: string;
  apiKey: string;
  textScale: number;
};

function clampTextScale(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_TEXT_SCALE;
  }

  return Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, value));
}

let initDbPromise: Promise<void> | null = null;

function normalizeConfig(configMap: Record<string, string>): DeviceConfig {
  const parsedTextScale = Number.parseFloat(configMap.textScale ?? "");

  return {
    portalBaseUrl: (configMap.portalBaseUrl ?? "").trim().replace(/\/+$/, ""),
    apiKey: (configMap.apiKey ?? "").trim(),
    textScale: clampTextScale(parsedTextScale),
  };
}

async function ensureTauriDatabaseInitialized() {
  if (!initDbPromise) {
    initDbPromise = invoke("init_db")
      .then(() => undefined)
      .catch((error) => {
        initDbPromise = null;
        throw error;
      });
  }

  await initDbPromise;
}

export async function loadDeviceConfig() {
  await ensureTauriDatabaseInitialized();
  const configMap = await invoke<Record<string, string>>("get_device_config");
  return normalizeConfig(configMap);
}

export async function saveDeviceSettings(settings: DeviceConfig) {
  const portalBaseUrl = settings.portalBaseUrl.trim().replace(/\/+$/, "");
  const apiKey = settings.apiKey.trim();
  const textScale = clampTextScale(settings.textScale);

  await ensureTauriDatabaseInitialized();
  const existingConfig = await loadDeviceConfig();
  const writes = [
    invoke("set_device_config", {
      key: TEXT_SCALE_KEY,
      value: textScale.toFixed(1),
    }),
  ];

  if (!existingConfig.portalBaseUrl && portalBaseUrl) {
    writes.push(
      invoke("set_device_config", { key: PORTAL_BASE_URL_KEY, value: portalBaseUrl }),
    );
  }

  if (!existingConfig.apiKey && apiKey) {
    writes.push(invoke("set_device_config", { key: API_KEY_KEY, value: apiKey }));
  }

  await Promise.all(writes);

  const configMap = await invoke<Record<string, string>>("get_device_config");
  return normalizeConfig(configMap);
}
