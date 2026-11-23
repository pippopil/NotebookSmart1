export type TimezoneMode = 'default_msk' | 'device_local';

const TIMEZONE_PREF_KEY = 'notebook_smart_timezone_mode';

export function getSavedTimezoneMode(): TimezoneMode {
  try {
    const val = localStorage.getItem(TIMEZONE_PREF_KEY);
    if (val === 'device_local' || val === 'default_msk') {
      return val;
    }
  } catch {}
  return 'default_msk';
}

export function saveTimezoneMode(mode: TimezoneMode): void {
  try {
    localStorage.setItem(TIMEZONE_PREF_KEY, mode);
    // Dispatch a storage event or custom event for multi-component reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notebook_timezone_changed', { detail: mode }));
    }
  } catch {}
}

export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
  } catch {
    return 'Europe/Moscow';
  }
}

export function isLocalDifferentFromMsk(): boolean {
  const deviceTz = getDeviceTimezone();
  return deviceTz !== 'Europe/Moscow';
}

export function getActiveTimezone(mode: TimezoneMode): string {
  if (mode === 'default_msk') {
    return 'Europe/Moscow';
  }
  return getDeviceTimezone();
}

export function getTimezoneLabel(mode: TimezoneMode): {
  label: string;
  offsetStr: string;
  nowStr: string;
  tzName: string;
  isDifferentFromMsk: boolean;
  diffFromMskHours: number;
} {
  const tz = getActiveTimezone(mode);
  const now = new Date();

  let offsetStr = '+03:00';
  let nowStr = '';

  try {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(now);
    const timeZonePart = parts.find((p) => p.type === 'timeZoneName');
    if (timeZonePart) {
      offsetStr = timeZonePart.value;
    }
    nowStr = formatter.format(now);
  } catch {
    nowStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  // Calculate approximate hours difference with Moscow
  let diffFromMskHours = 0;
  try {
    const mskFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Moscow',
      hour: 'numeric',
      hour12: false,
    });
    const localFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    const mskHour = parseInt(mskFormatter.format(now), 10);
    const localHour = parseInt(localFormatter.format(now), 10);
    diffFromMskHours = localHour - mskHour;
    if (diffFromMskHours > 12) diffFromMskHours -= 24;
    if (diffFromMskHours < -12) diffFromMskHours += 24;
  } catch {}

  const isDifferent = isLocalDifferentFromMsk();

  const label =
    mode === 'default_msk'
      ? 'МСК (по умолчанию, UTC+3)'
      : `Местное время (${tz})`;

  return {
    label,
    offsetStr,
    nowStr,
    tzName: tz,
    isDifferentFromMsk: isDifferent,
    diffFromMskHours,
  };
}

/**
 * Format a timestamp or date into current active timezone string
 */
export function formatInActiveTimezone(
  date: Date | number,
  mode: TimezoneMode,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const tz = getActiveTimezone(mode);
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: tz,
      ...options,
    }).format(d);
  } catch {
    return d.toLocaleString('ru-RU');
  }
}

/**
 * Returns today's date formatted as YYYY-MM-DD in the active timezone
 */
export function getActiveTodayDateStr(mode: TimezoneMode): string {
  const tz = getActiveTimezone(mode);
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export interface ConvertedEventTime {
  date: string; // YYYY-MM-DD in target timezone
  time: string; // HH:mm in target timezone
  originalMskDate: string;
  originalMskTime: string;
  isConverted: boolean;
  dateShifted: boolean;
  badgeLabel?: string;
}

/**
 * Converts an event's date and time (assumed authored in Moscow reference time)
 * to the active timezone if device_local is selected.
 */
export function convertEventToActiveTimezone(
  eventDate?: string,
  eventTime?: string,
  mode: TimezoneMode = 'default_msk'
): ConvertedEventTime {
  const defaultDate = eventDate || new Date().toISOString().slice(0, 10);
  const defaultTime = eventTime || '12:00';

  // If in default_msk mode or local timezone is already Moscow, no conversion is needed
  if (mode === 'default_msk' || !isLocalDifferentFromMsk()) {
    return {
      date: defaultDate,
      time: defaultTime,
      originalMskDate: defaultDate,
      originalMskTime: defaultTime,
      isConverted: false,
      dateShifted: false,
    };
  }

  try {
    const [year, month, day] = defaultDate.split('-').map(Number);
    const [hour, min] = defaultTime.split(':').map(Number);
    // MSK is UTC+3
    const utcDate = new Date(Date.UTC(year, (month || 1) - 1, day || 1, (hour || 12) - 3, min || 0, 0));

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: getDeviceTimezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(utcDate);
    const y = parts.find((p) => p.type === 'year')?.value || defaultDate.slice(0, 4);
    const m = parts.find((p) => p.type === 'month')?.value || defaultDate.slice(5, 7);
    const d = parts.find((p) => p.type === 'day')?.value || defaultDate.slice(8, 10);
    const h = parts.find((p) => p.type === 'hour')?.value || '12';
    const mn = parts.find((p) => p.type === 'minute')?.value || '00';

    const convertedDate = `${y}-${m}-${d}`;
    const convertedTime = `${h}:${mn}`;
    const dateShifted = convertedDate !== defaultDate;

    return {
      date: convertedDate,
      time: convertedTime,
      originalMskDate: defaultDate,
      originalMskTime: defaultTime,
      isConverted: true,
      dateShifted,
      badgeLabel: `${convertedTime} (местн.) • ${defaultTime} МСК`,
    };
  } catch (err) {
    return {
      date: defaultDate,
      time: defaultTime,
      originalMskDate: defaultDate,
      originalMskTime: defaultTime,
      isConverted: false,
      dateShifted: false,
    };
  }
}
