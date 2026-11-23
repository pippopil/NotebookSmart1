/**
 * In-App Application Updater Service
 * Allows users to check for updates and update the Progressive Web App directly
 * from within the UI without needing to reinstall.
 */

export interface UpdateStatus {
  isChecking: boolean;
  isUpdateAvailable: boolean;
  message: string | null;
  lastChecked: number;
}

type UpdateListener = (status: UpdateStatus) => void;
const listeners: Set<UpdateListener> = new Set();

let currentStatus: UpdateStatus = {
  isChecking: false,
  isUpdateAvailable: false,
  message: null,
  lastChecked: Date.now(),
};

function notify() {
  listeners.forEach((l) => l({ ...currentStatus }));
}

export function subscribeToAppUpdates(listener: UpdateListener): () => void {
  listeners.add(listener);
  listener({ ...currentStatus });
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Initiates an in-app check for Service Worker updates and refreshes cache
 */
export async function checkAndApplyAppUpdate(): Promise<{
  success: boolean;
  message: string;
  hasNewVersion: boolean;
}> {
  if (typeof window === 'undefined') {
    return { success: false, message: 'Окружение не поддерживает обновление', hasNewVersion: false };
  }

  currentStatus.isChecking = true;
  currentStatus.message = 'Проверка наличия обновлений...';
  notify();

  try {
    // 1. Check Service Worker registrations
    let swUpdated = false;
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        try {
          await reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            swUpdated = true;
          }
        } catch {
          // Continue checking
        }
      }
    }

    // 2. Fetch version or health timestamp to ensure server connectivity
    const response = await fetch(`/api/health?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });

    // 3. Clear stale cache storage entries
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        // Keep active cache or clean older revisions
        if (key.includes('old') || key.includes('v1')) {
          await caches.delete(key);
        }
      }
    }

    currentStatus.isChecking = false;
    currentStatus.lastChecked = Date.now();

    if (swUpdated) {
      currentStatus.isUpdateAvailable = true;
      currentStatus.message = 'Доступна новая версия! Перезагрузка...';
      notify();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return { success: true, message: 'Обновление загружено и применяется', hasNewVersion: true };
    }

    currentStatus.isUpdateAvailable = false;
    currentStatus.message = 'У вас установлена самая свежая версия NotebookSmart!';
    notify();

    return {
      success: true,
      message: 'Приложение актуально, все данные синхронизированы',
      hasNewVersion: false,
    };
  } catch (err: any) {
    currentStatus.isChecking = false;
    currentStatus.message = 'Ошибка проверки обновления. Проверьте интернет-соединение.';
    notify();
    return {
      success: false,
      message: err.message || 'Не удалось проверить обновление',
      hasNewVersion: false,
    };
  }
}
