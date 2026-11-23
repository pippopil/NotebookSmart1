import { Note } from '../types';
import { extractShoppingItems } from '../utils/shoppingParser';

// Type definition for Android WebView Javascript Interface
declare global {
  interface Window {
    AndroidNative?: {
      isNativeAndroid: () => boolean;
      getNativeVersion: () => string;
      triggerHaptic: (type: number) => void;
      updateWidgetData: (json: string) => boolean;
      scheduleReminder: (
        id: string,
        title: string,
        body: string,
        triggerAtMillis: number,
        category: string
      ) => boolean;
      cancelReminder: (id: string) => boolean;
      shareText: (title: string, text: string) => void;
      isNotificationsEnabled: () => boolean;

      // Step 3: Receive Share Content & App Shortcuts
      getPendingSharedContent?: () => string | null;
      getPendingAction?: () => string | null;

      // Step 4: Native Android Biometrics (BiometricPrompt)
      isBiometricAvailable?: () => boolean;
      promptBiometric?: (title: string, subtitle: string) => void;

      // Step 5: Native Documents & Storage Backup
      saveNativeBackupFile?: (jsonContent: string, customFileName: string) => string;
      listNativeBackupFiles?: () => string;
      readNativeBackupFile?: (fileName: string) => string | null;
      deleteNativeBackupFile?: (fileName: string) => boolean;

      // Step 6: Native Android SpeechRecognizer (Google Voice Typing)
      isNativeSpeechAvailable?: () => boolean;
      isSpeechActive?: () => boolean;
      startNativeSpeechRecognition?: (lang: string) => void;
      stopNativeSpeechRecognition?: () => void;

      // Step 7: System-level Android Notifications, Exact Alarms & Battery Optimization
      getSystemNotificationStatus?: () => string;
      requestSystemNotificationPermissions?: () => void;
      requestIgnoreBatteryOptimization?: () => void;
      sendTestNativeAlarm?: (title: string, body: string) => boolean;
    };

    // System event callbacks invoked by native Android
    onNativeBiometricResult?: (success: boolean, error: string) => void;
    onNativeSharedContent?: (title: string, text: string) => void;
    onNativeAction?: (action: string) => void;
    onNativeSpeechResult?: (text: string, isFinal: boolean) => void;
    onNativeSpeechError?: (errorMsg: string) => void;
    onNativeSpeechState?: (state: string) => void;
    onNativePermissionResult?: (statusJson: string) => void;
  }
}

export interface AndroidNotificationStatus {
  notificationsEnabled: boolean;
  exactAlarmAllowed: boolean;
  batteryOptimizationIgnored: boolean;
  androidSdk: number;
}

export function getAndroidNotificationStatus(): AndroidNotificationStatus | null {
  if (!isAndroidNativeApp()) return null;
  if (window.AndroidNative && typeof window.AndroidNative.getSystemNotificationStatus === 'function') {
    try {
      const raw = window.AndroidNative.getSystemNotificationStatus();
      return JSON.parse(raw) as AndroidNotificationStatus;
    } catch {
      return null;
    }
  }
  return {
    notificationsEnabled: window.AndroidNative?.isNotificationsEnabled?.() ?? false,
    exactAlarmAllowed: true,
    batteryOptimizationIgnored: false,
    androidSdk: 33,
  };
}

export function requestAndroidNotificationPermissions(): boolean {
  if (!isAndroidNativeApp()) return false;
  if (window.AndroidNative && typeof window.AndroidNative.requestSystemNotificationPermissions === 'function') {
    window.AndroidNative.requestSystemNotificationPermissions();
    return true;
  }
  return false;
}

export function requestAndroidBatteryExemption(): boolean {
  if (!isAndroidNativeApp()) return false;
  if (window.AndroidNative && typeof window.AndroidNative.requestIgnoreBatteryOptimization === 'function') {
    window.AndroidNative.requestIgnoreBatteryOptimization();
    return true;
  }
  return false;
}

export function sendAndroidTestAlarm(title: string, body: string): boolean {
  if (!isAndroidNativeApp()) return false;
  if (window.AndroidNative && typeof window.AndroidNative.sendTestNativeAlarm === 'function') {
    return window.AndroidNative.sendTestNativeAlarm(title, body);
  }
  return false;
}

/**
 * Returns true if native Android SpeechRecognizer is available on device
 */
export function isNativeSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.AndroidNative && typeof window.AndroidNative.isNativeSpeechAvailable === 'function') {
    return window.AndroidNative.isNativeSpeechAvailable();
  }
  return false;
}

/**
 * Starts native Android speech recognition
 */
export function startNativeSpeech(lang: string = 'ru-RU'): boolean {
  if (typeof window === 'undefined') return false;
  if (window.AndroidNative && typeof window.AndroidNative.startNativeSpeechRecognition === 'function') {
    window.AndroidNative.startNativeSpeechRecognition(lang);
    return true;
  }
  return false;
}

/**
 * Stops native Android speech recognition
 */
export function stopNativeSpeech(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.AndroidNative && typeof window.AndroidNative.stopNativeSpeechRecognition === 'function') {
    window.AndroidNative.stopNativeSpeechRecognition();
    return true;
  }
  return false;
}

/**
 * Checks if running inside native Android APK with Enhanced Hybrid Bridge active
 */
export function isAndroidNativeApp(): boolean {
  return typeof window !== 'undefined' && !!window.AndroidNative && typeof window.AndroidNative.isNativeAndroid === 'function';
}

/**
 * Returns native bridge information
 */
export function getNativeAppInfo(): { isNative: boolean; version: string; platform: string } {
  const isNative = isAndroidNativeApp();
  const version = isNative && window.AndroidNative ? window.AndroidNative.getNativeVersion() : 'Web / PWA';
  return {
    isNative,
    version,
    platform: isNative ? 'Android Native (Enhanced Hybrid)' : 'Web Platform / PWA',
  };
}

/**
 * Tactile haptic feedback: Native Android vibrator when available, with browser vibrate fallback
 */
export function nativeHaptic(style: 'light' | 'medium' | 'heavy' | 'success' | 'warning' = 'light'): void {
  if (typeof window === 'undefined') return;

  if (window.AndroidNative && typeof window.AndroidNative.triggerHaptic === 'function') {
    const codeMap = {
      light: 1,
      medium: 2,
      heavy: 3,
      success: 4,
      warning: 5,
    };
    window.AndroidNative.triggerHaptic(codeMap[style] || 1);
    return;
  }

  // Fallback to HTML5 vibration API in web browsers
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    switch (style) {
      case 'light':
        navigator.vibrate(12);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'heavy':
        navigator.vibrate(45);
        break;
      case 'success':
        navigator.vibrate([15, 30, 25]);
        break;
      case 'warning':
        navigator.vibrate([35, 40, 35]);
        break;
    }
  }
}

export interface WidgetEventSnippet {
  title: string;
  subtitle: string;
  category?: string;
}

export interface WidgetPayload {
  badge: string;
  summary: string;
  items: string[];
  remaining?: string;
  eventsByDate?: Record<string, number>;
  nearestEvent?: WidgetEventSnippet | null;
  nearestReminder?: WidgetEventSnippet | null;
  nearestTask?: WidgetEventSnippet | null;
}

/**
 * Syncs data to Android Home Screen Widget
 */
export function syncNativeWidget(data: WidgetPayload): boolean {
  if (typeof window === 'undefined') return false;
  if (window.AndroidNative && typeof window.AndroidNative.updateWidgetData === 'function') {
    return window.AndroidNative.updateWidgetData(JSON.stringify(data));
  }
  return false;
}

/**
 * Helper to automatically format notes and update Android Home Screen Calendar Widget
 */
export function syncWidgetFromNotes(notes: Note[]): void {
  if (!isAndroidNativeApp()) return;

  const now = Date.now();
  const eventsByDate: Record<string, number> = {};

  // Build workload map by YYYY-MM-DD for current & upcoming months
  for (const n of notes) {
    if (n.isArchived) continue;
    if (n.category === 'event' && n.eventDate && !n.isEventDone) {
      eventsByDate[n.eventDate] = (eventsByDate[n.eventDate] || 0) + 1;
    }
    if (n.reminderEnabled && !n.reminderTriggered && n.reminderDateTime) {
      const remDate = n.reminderDateTime.slice(0, 10);
      if (remDate && remDate !== n.eventDate) {
        eventsByDate[remDate] = (eventsByDate[remDate] || 0) + 1;
      }
    }
  }

  // 1. Nearest upcoming event
  let nearestEventNote: Note | null = null;
  let nearestEventDiff = Infinity;

  const eventNotes = notes.filter((n) => !n.isArchived && n.category === 'event' && !n.isEventDone);
  for (const en of eventNotes) {
    let eventTime = 0;
    if (en.eventDate) {
      const timeStr = en.eventTime || '09:00';
      eventTime = new Date(`${en.eventDate}T${timeStr}`).getTime();
    } else if (en.reminderDateTime) {
      eventTime = new Date(en.reminderDateTime).getTime();
    }
    if (eventTime && eventTime >= now - 1000 * 60 * 60 * 6) {
      const diff = eventTime - now;
      if (diff < nearestEventDiff) {
        nearestEventDiff = diff;
        nearestEventNote = en;
      }
    }
  }

  const nearestEvent: WidgetEventSnippet | null = nearestEventNote
    ? {
        title: (nearestEventNote.title || 'Событие').replace(/^\s*📅\s*/, ''),
        subtitle: `${
          nearestEventNote.eventDate
            ? new Date(nearestEventNote.eventDate + 'T00:00:00').toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
              })
            : 'Скоро'
        }${nearestEventNote.eventTime ? ` • ${nearestEventNote.eventTime}` : ''}`,
        category: nearestEventNote.eventCategory || 'meeting',
      }
    : null;

  // 2. Nearest active reminder
  let nearestReminderNote: Note | null = null;
  let nearestReminderDiff = Infinity;
  for (const n of notes) {
    if (n.isArchived || !n.reminderEnabled || n.reminderTriggered || !n.reminderDateTime) continue;
    const remTime = new Date(n.reminderDateTime).getTime();
    if (!isNaN(remTime) && remTime >= now - 1000 * 60 * 30) {
      const diff = remTime - now;
      if (diff < nearestReminderDiff) {
        nearestReminderDiff = diff;
        nearestReminderNote = n;
      }
    }
  }

  const nearestReminder: WidgetEventSnippet | null = nearestReminderNote
    ? {
        title: nearestReminderNote.title || 'Напоминание',
        subtitle: new Date(nearestReminderNote.reminderDateTime!).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }
    : null;

  // 3. Nearest active task (unchecked checklist/shopping item)
  let nearestTask: WidgetEventSnippet | null = null;
  const activeNotes = notes.filter((n) => !n.isArchived);
  let totalPending = 0;
  let firstTaskTitle = '';
  let firstTaskSource = '';

  for (const n of activeNotes) {
    const items = extractShoppingItems(n.content);
    for (const item of items) {
      if (!item.isCompleted) {
        totalPending++;
        if (!firstTaskTitle) {
          firstTaskTitle = item.name;
          firstTaskSource = n.title || 'Задачи';
        }
      }
    }
  }

  if (firstTaskTitle) {
    nearestTask = {
      title: firstTaskTitle,
      subtitle: totalPending > 1 ? `Ещё задач: ${totalPending - 1} (${firstTaskSource})` : firstTaskSource,
    };
  } else if (nearestEventNote) {
    nearestTask = {
      title: nearestEventNote.content?.split('\n').find((l) => l.trim().length > 0)?.slice(0, 40) || 'Открыть заметку',
      subtitle: 'План события',
    };
  }

  const fallbackDate = nearestEvent ? nearestEvent.subtitle : 'Нет ближайших событий';
  syncNativeWidget({
    badge: '📅 Календарь и События',
    summary: nearestEvent ? nearestEvent.title : 'Нет ближайших событий',
    items: [
      nearestEvent ? `Событие: ${nearestEvent.title} (${fallbackDate})` : 'Событий пока нет',
      nearestReminder ? `Напоминание: ${nearestReminder.title} (${nearestReminder.subtitle})` : 'Напоминаний нет',
      nearestTask ? `Задание: ${nearestTask.title}` : 'Все задания выполнены',
    ],
    remaining: 'Нажмите для перехода в календарь →',
    eventsByDate,
    nearestEvent,
    nearestReminder,
    nearestTask,
  });
}

/**
 * Schedules exact background alarm via Android AlarmManager
 */
export function scheduleNativeAlarm(
  id: string,
  title: string,
  body: string,
  triggerAtMillis: number,
  category: string = 'note'
): boolean {
  if (typeof window === 'undefined') return false;
  if (window.AndroidNative && typeof window.AndroidNative.scheduleReminder === 'function') {
    return window.AndroidNative.scheduleReminder(id, title, body, triggerAtMillis, category);
  }
  return false;
}

/**
 * Cancels exact background alarm via Android AlarmManager
 */
export function cancelNativeAlarm(id: string): boolean {
  if (typeof window === 'undefined') return false;
  if (window.AndroidNative && typeof window.AndroidNative.cancelReminder === 'function') {
    return window.AndroidNative.cancelReminder(id);
  }
  return false;
}

/**
 * Native Android share sheet or Web Share API
 */
export function nativeShareText(title: string, text: string): boolean {
  if (typeof window === 'undefined') return false;

  if (window.AndroidNative && typeof window.AndroidNative.shareText === 'function') {
    window.AndroidNative.shareText(title, text);
    return true;
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    navigator.share({ title, text }).catch(() => {});
    return true;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text);
    return false;
  }

  return false;
}

/* =========================================================================
 * STEP 3: Receive Share Content & App Shortcuts
 * ========================================================================= */

export interface NativeSharedContent {
  title: string;
  text: string;
}

/**
 * Checks for any pending shared content received when app was opened via ACTION_SEND
 */
export function getPendingNativeSharedContent(): NativeSharedContent | null {
  if (!isAndroidNativeApp()) return null;
  if (window.AndroidNative && typeof window.AndroidNative.getPendingSharedContent === 'function') {
    const raw = window.AndroidNative.getPendingSharedContent();
    if (raw) {
      try {
        return JSON.parse(raw) as NativeSharedContent;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Checks for any pending action triggered from Launcher App Shortcuts or Widget
 */
export function getPendingNativeAction(): string | null {
  if (!isAndroidNativeApp()) return null;
  if (window.AndroidNative && typeof window.AndroidNative.getPendingAction === 'function') {
    return window.AndroidNative.getPendingAction() || null;
  }
  return null;
}

/* =========================================================================
 * STEP 4: Native Android Biometrics (BiometricPrompt)
 * ========================================================================= */

/**
 * Returns true if Android device hardware supports biometrics and has enrolled credentials
 */
export function isNativeBiometricAvailable(): boolean {
  if (!isAndroidNativeApp()) return false;
  if (window.AndroidNative && typeof window.AndroidNative.isBiometricAvailable === 'function') {
    return window.AndroidNative.isBiometricAvailable();
  }
  return false;
}

/**
 * Prompts native Android BiometricPrompt system dialog (Fingerprint, Face Unlock, Device Credential)
 */
export function authenticateWithNativeBiometrics(
  title: string = 'Вход в NotebookSmart',
  subtitle: string = 'Подтвердите личность с помощью биометрии'
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!isAndroidNativeApp()) {
      resolve({ success: false, error: 'Нативный мост Android недоступен' });
      return;
    }

    if (!window.AndroidNative || typeof window.AndroidNative.promptBiometric !== 'function') {
      resolve({ success: false, error: 'Метод биометрии не поддерживается' });
      return;
    }

    // Set one-time callback
    window.onNativeBiometricResult = (success: boolean, error: string) => {
      resolve({ success, error: error || undefined });
    };

    window.AndroidNative.promptBiometric(title, subtitle);
  });
}

/* =========================================================================
 * STEP 5: Native Documents & Storage Backup
 * ========================================================================= */

export interface NativeBackupItem {
  fileName: string;
  size: number;
  lastModified: number;
  path: string;
}

/**
 * Saves a JSON backup directly to Android external storage & Documents/NotebookSmart/
 */
export function saveNativeBackup(
  notes: Note[],
  customFileName?: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  return new Promise((resolve) => {
    if (!isAndroidNativeApp()) {
      resolve({ success: false, error: 'Нативный мост Android недоступен' });
      return;
    }

    if (!window.AndroidNative || typeof window.AndroidNative.saveNativeBackupFile !== 'function') {
      resolve({ success: false, error: 'Функция нативного сохранения не поддерживается' });
      return;
    }

    try {
      const dataStr = JSON.stringify(
        {
          appName: 'NotebookSmart',
          version: '1.9.6',
          exportedAt: new Date().toISOString(),
          notesCount: notes.length,
          notes,
        },
        null,
        2
      );

      const fileName =
        customFileName || `notebook_backup_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.json`;
      const resultPath = window.AndroidNative.saveNativeBackupFile(dataStr, fileName);

      if (resultPath && !resultPath.startsWith('ERROR:')) {
        resolve({ success: true, filePath: resultPath });
      } else {
        resolve({ success: false, error: resultPath || 'Ошибка при сохранении' });
      }
    } catch (e: any) {
      resolve({ success: false, error: e.message || 'Ошибка сериализации' });
    }
  });
}

/**
 * Lists all native backup files saved on device
 */
export function listNativeBackups(): NativeBackupItem[] {
  if (!isAndroidNativeApp()) return [];
  if (window.AndroidNative && typeof window.AndroidNative.listNativeBackupFiles === 'function') {
    try {
      const raw = window.AndroidNative.listNativeBackupFiles();
      if (raw) {
        return JSON.parse(raw) as NativeBackupItem[];
      }
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Reads a native backup file and parses the notes
 */
export function readNativeBackup(fileName: string): Promise<Note[] | null> {
  return new Promise((resolve) => {
    if (!isAndroidNativeApp()) {
      resolve(null);
      return;
    }

    if (!window.AndroidNative || typeof window.AndroidNative.readNativeBackupFile !== 'function') {
      resolve(null);
      return;
    }

    try {
      const raw = window.AndroidNative.readNativeBackupFile(fileName);
      if (!raw) {
        resolve(null);
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.notes)) {
        resolve(parsed.notes);
      } else {
        resolve(null);
      }
    } catch {
      resolve(null);
    }
  });
}

/**
 * Deletes a native backup file from device
 */
export function deleteNativeBackup(fileName: string): boolean {
  if (!isAndroidNativeApp()) return false;
  if (window.AndroidNative && typeof window.AndroidNative.deleteNativeBackupFile === 'function') {
    return window.AndroidNative.deleteNativeBackupFile(fileName);
  }
  return false;
}
