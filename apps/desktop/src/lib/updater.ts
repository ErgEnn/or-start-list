import { check } from '@tauri-apps/plugin-updater';

export async function checkForAppUpdate(): Promise<void> {
  try {
    const update = await check();
    if (update) {
      console.log(`Update available: ${update.version}`);
      await update.downloadAndInstall();
    }
  } catch (e) {
    console.error('Update check failed:', e);
  }
}
