/**
 * Push Notification & Reminder Service for NotebookSmart
 * Handles Web Notifications API, Service Worker dispatch, audio chime, and in-app alerts.
 */

import { Note } from '../types';
import {
  isAndroidNativeApp,
  requestAndroidNotificationPermissions,
  sendAndroidTestAlarm,
} from './nativeBridge';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface InAppAlert {
  id: string;
  noteId: string;
  title: string;
  body: string;
  category: 'event' | 'shopping' | 'note';
  timestamp: number;
}

type AlertListener = (alert: InAppAlert) => void;
const alertListeners = new Set<AlertListener>();

export function subscribeToInAppAlerts(listener: AlertListener): () => void {
  alertListeners.add(listener);
  return () => alertListeners.delete(listener);
}

function notifyInAppAlert(alert: InAppAlert) {
  alertListeners.forEach((l) => {
    try {
      l(alert);
    } catch (e) {
      console.error('Error in alert listener', e);
    }
  });
}

/**
 * Checks current notification permission (Android OS level if native, else browser)
 */
export function getNotificationPermission(): NotificationPermissionState {
  if (isAndroidNativeApp() && window.AndroidNative) {
    return window.AndroidNative.isNotificationsEnabled() ? 'granted' : 'denied';
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Requests permission for system Android notifications (or Web Push in browser)
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (isAndroidNativeApp() && window.AndroidNative) {
    requestAndroidNotificationPermissions();
    return window.AndroidNative.isNotificationsEnabled();
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  } catch (e) {
    console.error('Notification.requestPermission failed', e);
    return false;
  }
}

/**
 * Plays a warm, harmonious two-tone chime using Web Audio API
 */
export function playReminderChime(): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Note 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.25, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.95);

    // Note 2: A5 (880 Hz) - delayed by 130ms for chime harmony
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.13);

    gain2.gain.setValueAtTime(0.001, now + 0.13);
    gain2.gain.exponentialRampToValueAtTime(0.3, now + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.13);
    osc2.stop(now + 1.25);
  } catch (e) {
    // Audio context may be restricted by autoplay policy
    console.warn('Audio chime could not play:', e);
  }
}

/**
 * Haptic vibration for mobile devices
 */
export function triggerHapticNotification(): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([150, 80, 180]);
    } catch {
      // Ignore vibration error
    }
  }
}

/**
 * Sends a native push notification + triggers sound and in-app banner
 */
export async function sendPushNotification(
  title: string,
  options?: NotificationOptions & { noteId?: string; category?: 'event' | 'shopping' | 'note' }
): Promise<boolean> {
  // Always trigger sound and vibration
  playReminderChime();
  triggerHapticNotification();

  // Always emit in-app toast for users active in the app
  notifyInAppAlert({
    id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    noteId: options?.noteId || '',
    title,
    body: options?.body || '',
    category: options?.category || 'note',
    timestamp: Date.now(),
  });

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const notificationOptions: NotificationOptions & { renotify?: boolean } = {
    icon: '/pwa-192x192.png',
    badge: '/favicon.ico',
    tag: options?.tag || `notebooksmart-reminder-${Date.now()}`,
    renotify: true,
    ...options,
  };

  try {
    // Prefer ServiceWorker showNotification if available (works when backgrounded/PWA)
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, notificationOptions);
        return true;
      }
    }

    // Fallback to standard window Notification
    new Notification(title, notificationOptions);
    return true;
  } catch (err) {
    console.warn('Native notification failed, falling back:', err);
    try {
      new Notification(title, notificationOptions);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Send an immediate test notification / native Android alarm to verify lockscreen & sound
 */
export async function sendTestNotification(): Promise<boolean> {
  if (isAndroidNativeApp()) {
    requestAndroidNotificationPermissions();
    const ok = sendAndroidTestAlarm(
      '🔔 NotebookSmart: Будильник активен',
      'Системные напоминания будут звучать даже при заблокированном экране и в спящем режиме.'
    );
    playReminderChime();
    notifyInAppAlert({
      id: `alert-${Date.now()}`,
      noteId: '',
      title: '🔔 Тест системного будильника Android',
      body: ok ? 'Системное уведомление и сигнал отправлены в Android!' : 'Проверьте разрешения уведомлений Android.',
      category: 'event',
      timestamp: Date.now(),
    });
    return ok;
  }

  await requestNotificationPermission();
  return sendPushNotification('🔔 NotebookSmart: Уведомления работают!', {
    body: 'Вы будете вовремя получать напоминания о покупках и событиях в тетрадке.',
    tag: 'test-notification',
  });
}

/**
 * Formats a reminder datetime string into a human readable Russian format
 */
export function formatReminderDateTime(isoStr?: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      d.getDate() === tomorrow.getDate() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getFullYear() === tomorrow.getFullYear();

    const timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Сегодня в ${timeStr}`;
    if (isTomorrow) return `Завтра в ${timeStr}`;

    return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} в ${timeStr}`;
  } catch {
    return isoStr;
  }
}

/**
 * Helper to get ISO date-time string from Date object for input[type="datetime-local"]
 */
export function toDateTimeLocalString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
