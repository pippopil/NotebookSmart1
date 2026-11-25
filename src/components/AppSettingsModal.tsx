import React, { useState, useEffect } from 'react';
import {
  Settings,
  Globe,
  Check,
  X,
  Shield,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Bell,
  Volume2,
  BatteryCharging,
  Calculator,
  EyeOff,
  BotOff,
  Trash2,
  Download,
} from 'lucide-react';
import { Note, ArchivedBudgetMonth, ArchivedShoppingTrip } from '../types';
import { triggerTextFileDownload } from '../utils/exportFormats';
import {
  TimezoneMode,
  getTimezoneLabel,
  getDeviceTimezone,
  isLocalDifferentFromMsk,
} from '../services/timezone';
import {
  isAndroidNativeApp,
  getAndroidNotificationStatus,
  requestAndroidNotificationPermissions,
  requestAndroidBatteryExemption,
  AndroidNotificationStatus,
} from '../services/nativeBridge';
import { sendTestNotification } from '../services/notifications';
import { getLiteMode, saveLiteMode } from '../services/storage';
import {
  isAiDisabled,
  setAiDisabled,
  hasAiConsent,
  setAiConsent,
  getAiCallLogs,
  clearAiCallLogs,
} from '../services/aiTagging';
import { ThemeToggle } from './ThemeToggle';

interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes?: Note[];
  archivedBudgets?: ArchivedBudgetMonth[];
  archivedShopping?: ArchivedShoppingTrip[];
  timezoneMode: TimezoneMode;
  onTimezoneModeChange: (mode: TimezoneMode) => void;
  globalAutoCalculate?: boolean;
  onGlobalAutoCalculateChange?: (enabled: boolean) => void;
  onForceRecalculateAll?: () => void;
  onOpenSecurity?: () => void;
  onOpenChangelog?: () => void;
}

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({
  isOpen,
  onClose,
  notes = [],
  archivedBudgets = [],
  archivedShopping = [],
  timezoneMode,
  onTimezoneModeChange,
  globalAutoCalculate = true,
  onGlobalAutoCalculateChange,
  onForceRecalculateAll,
  onOpenSecurity,
  onOpenChangelog,
}) => {
  const [, setClockTick] = useState(Date.now());
  const [androidStatus, setAndroidStatus] = useState<AndroidNotificationStatus | null>(() =>
    getAndroidNotificationStatus()
  );
  const [testAlarmSent, setTestAlarmSent] = useState(false);
  const [liteMode, setLiteModeState] = useState<boolean>(() => getLiteMode());
  const [aiDisabledState, setAiDisabledState] = useState<boolean>(() => isAiDisabled());
  const [aiConsentState, setAiConsentState] = useState<boolean>(() => hasAiConsent());
  const [aiLogCount, setAiLogCount] = useState<number>(() => getAiCallLogs().length);
  const [recalcDone, setRecalcDone] = useState(false);
  const [jsonExportStatus, setJsonExportStatus] = useState<string | null>(null);

  const handleExportAllNotesJson = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const backupPayload = {
      app: 'NotebookSmart',
      formatVersion: 2,
      exportedAt: new Date().toISOString(),
      totalNotes: notes.length,
      notes,
      archivedBudgets,
      archivedShopping,
    };
    const jsonString = JSON.stringify(backupPayload, null, 2);
    triggerTextFileDownload(
      jsonString,
      `notebook-smart-backup-${dateStamp}.json`,
      'application/json;charset=utf-8'
    );
    setJsonExportStatus(`Экспортировано заметок: ${notes.length}`);
    setTimeout(() => setJsonExportStatus(null), 3500);
  };

  useEffect(() => {
    if (!isOpen) return;
    setAndroidStatus(getAndroidNotificationStatus());
    setLiteModeState(getLiteMode());
    setAiDisabledState(isAiDisabled());
    setAiConsentState(hasAiConsent());
    setAiLogCount(getAiCallLogs().length);
    const prevCallback = window.onNativePermissionResult;
    window.onNativePermissionResult = (json: string) => {
      try {
        setAndroidStatus(JSON.parse(json) as AndroidNotificationStatus);
      } catch {}
      if (prevCallback) prevCallback(json);
    };
    const interval = setInterval(() => setClockTick(Date.now()), 1000);
    return () => {
      clearInterval(interval);
      window.onNativePermissionResult = prevCallback;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const tzInfo = getTimezoneLabel(timezoneMode);
  const deviceTz = getDeviceTimezone();
  const isDiff = isLocalDifferentFromMsk();

  // Moscow current live time
  const mskTimeStr = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());

  // Device local current live time
  const localTimeStr = new Intl.DateTimeFormat('ru-RU', {
    timeZone: deviceTz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-lg bg-[#fffdfa] dark:bg-stone-900 border border-amber-900/20 dark:border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-stone-900 dark:text-stone-100 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-amber-900/10 dark:border-stone-800 flex items-center justify-between bg-amber-500/5 dark:bg-stone-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-purple-500/15 text-purple-700 dark:text-purple-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-white">
                Настройки приложения
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Часовой пояс, оформление, приватность AI и параметры тетради
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть настройки"
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1">
          {/* SECTION 0: GLOBAL AUTOMATIC CALCULATION SWITCH */}
          {onGlobalAutoCalculateChange && (
            <div className="bg-stone-50 dark:bg-stone-800/80 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      globalAutoCalculate
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-stone-200 dark:bg-stone-800 text-stone-500'
                    }`}
                  >
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-stone-900 dark:text-white">
                      Автоматический расчёт
                    </h4>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Парсинг финансовых выражений и чисел во всех заметках сразу
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={globalAutoCalculate}
                  onClick={() => onGlobalAutoCalculateChange(!globalAutoCalculate)}
                  className="flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <span
                    className={`text-[11px] font-bold ${
                      globalAutoCalculate ? 'text-emerald-700 dark:text-emerald-400' : 'text-stone-500'
                    }`}
                  >
                    {globalAutoCalculate ? 'ВКЛ' : 'ВЫКЛ'}
                  </span>
                  <div
                    className={`w-11 h-6 flex items-center rounded-full p-0.5 transition ${
                      globalAutoCalculate ? 'bg-emerald-600' : 'bg-stone-300 dark:bg-stone-700'
                    }`}
                  >
                    <div
                      className={`bg-white w-5 h-5 rounded-full shadow-md transform transition duration-200 ${
                        globalAutoCalculate ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-stone-900/70 border border-emerald-500/20 dark:border-stone-800 text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed flex flex-col gap-2">
                <span>
                  {globalAutoCalculate
                    ? 'Включено: заметки пересчитываются инкрементально (только при изменении текста), экономя батарею и ресурсы.'
                    : 'Выключено: парсинг финансовых выражений отключён для всех заметок одновременно — на страницах и карточках отображается только чистый текст.'}
                </span>
                {onForceRecalculateAll && (
                  <button
                    type="button"
                    onClick={() => {
                      onForceRecalculateAll();
                      setRecalcDone(true);
                      setTimeout(() => setRecalcDone(false), 2500);
                    }}
                    className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 font-bold text-[11px] hover:border-emerald-500 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 text-emerald-600" />
                    <span>{recalcDone ? '✓ Все заметки пересчитаны' : 'Полный пересчёт всех заметок'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* SECTION 0.5: PRIVACY & AI CONTROLS (DS R-AI-04) */}
          <div className="bg-stone-50 dark:bg-stone-800/80 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    aiDisabledState
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                      : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400'
                  }`}
                >
                  <BotOff className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-stone-900 dark:text-white">
                    Отключить AI полностью
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Блокирует все сетевые запросы в Gemini — работают только локальные теги
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={aiDisabledState}
                aria-label="Отключить AI полностью"
                onClick={() => {
                  const next = !aiDisabledState;
                  setAiDisabledState(next);
                  setAiDisabled(next);
                }}
                className="flex items-center gap-2 cursor-pointer shrink-0"
              >
                <div
                  className={`w-11 h-6 flex items-center rounded-full p-0.5 transition ${
                    aiDisabledState ? 'bg-rose-600' : 'bg-stone-300 dark:bg-stone-700'
                  }`}
                >
                  <div
                    className={`bg-white w-5 h-5 rounded-full shadow-md transform transition duration-200 ${
                      aiDisabledState ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-200/80 dark:border-stone-700/60 text-[11px] text-stone-600 dark:text-stone-400">
              <span>
                Согласие на отправку в Gemini:{' '}
                <strong className="text-stone-900 dark:text-stone-200">
                  {aiConsentState ? 'дано' : 'не дано'}
                </strong>
                {' • '}Запросов в журнале: <strong className="font-mono">{aiLogCount}</strong>
              </span>
              <div className="flex items-center gap-2">
                {aiConsentState && (
                  <button
                    type="button"
                    onClick={() => {
                      setAiConsent(false);
                      setAiConsentState(false);
                    }}
                    className="text-amber-700 dark:text-amber-400 hover:underline font-bold cursor-pointer"
                  >
                    Отозвать согласие
                  </button>
                )}
                {aiLogCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearAiCallLogs();
                      setAiLogCount(0);
                    }}
                    className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Очистить лог</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 1: TIMEZONE SETTINGS (USER'S EXPLICIT REQUEST) */}
          <div className="bg-stone-50 dark:bg-stone-800/80 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <div>
                  <h4 className="font-bold text-sm text-stone-900 dark:text-white">
                    Часовой пояс событий и календаря
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Автоматический пересчет времени всех событий в EventsView
                  </p>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 font-mono text-[11px] font-bold border border-purple-400/30">
                {tzInfo.offsetStr}
              </span>
            </div>

            {/* Timezone Switcher Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: Moscow Time (Default) */}
              <button
                type="button"
                onClick={() => onTimezoneModeChange('default_msk')}
                className={`p-3 rounded-2xl border text-left transition active:scale-98 cursor-pointer flex flex-col justify-between gap-2 ${
                  timezoneMode === 'default_msk'
                    ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 ring-2 ring-purple-500/30 shadow-sm'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-xs flex items-center gap-1.5 text-stone-900 dark:text-white">
                    <span className="text-base">🇷🇺</span>
                    <span>МСК (по умолчанию)</span>
                  </span>
                  {timezoneMode === 'default_msk' && (
                    <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 block font-medium">
                    Московское время (UTC+3)
                  </span>
                  <span className="font-mono font-bold text-xs text-purple-700 dark:text-purple-300 block">
                    {mskTimeStr}
                  </span>
                </div>
              </button>

              {/* Option 2: Device Local Time */}
              <button
                type="button"
                onClick={() => onTimezoneModeChange('device_local')}
                className={`p-3 rounded-2xl border text-left transition active:scale-98 cursor-pointer flex flex-col justify-between gap-2 ${
                  timezoneMode === 'device_local'
                    ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 ring-2 ring-purple-500/30 shadow-sm'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-xs flex items-center gap-1.5 text-stone-900 dark:text-white">
                    <span className="text-base">🌐</span>
                    <span>Местное время</span>
                  </span>
                  {timezoneMode === 'device_local' && (
                    <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 block font-medium truncate">
                    {deviceTz}
                  </span>
                  <span className="font-mono font-bold text-xs text-purple-700 dark:text-purple-300 block">
                    {localTimeStr}
                  </span>
                </div>
              </button>
            </div>

            {/* Explanation & Automatic Event Recalculation Badge */}
            <div className="p-2.5 rounded-xl bg-purple-500/10 dark:bg-purple-950/40 border border-purple-500/20 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-purple-900 dark:text-purple-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>Автоматическое применение к событиям:</span>
              </div>
              <p className="text-stone-600 dark:text-stone-400 leading-relaxed pl-5">
                {timezoneMode === 'default_msk'
                  ? 'Все события, дедлайны и встречи отображаются по Московскому времени (UTC+3) независимо от региона поездки.'
                  : `Все события автоматически пересчитываются под часовой пояс устройства (${deviceTz}). Время встреч и календарная сетка адаптируются автоматически.`}
              </p>
              {isDiff && timezoneMode === 'device_local' && (
                <div className="pl-5 pt-0.5 text-purple-800 dark:text-purple-300 font-semibold font-mono text-[10px]">
                  Разница с Москвой: {tzInfo.diffFromMskHours > 0 ? `+${tzInfo.diffFromMskHours}` : tzInfo.diffFromMskHours} ч.
                </div>
              )}
            </div>
          </div>

          {/* SECTION 1.5: ANDROID SYSTEM NOTIFICATIONS & ALARM CLOCK PERMISSIONS */}
          <div className="bg-stone-50 dark:bg-stone-800/80 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <h4 className="font-bold text-sm text-stone-900 dark:text-white">
                    Уведомления и будильник Android
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Системные оповещения при заблокированном экране и спящем режиме
                  </p>
                </div>
              </div>
              {isAndroidNativeApp() && androidStatus && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    androidStatus.notificationsEnabled
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400/40'
                  }`}
                >
                  {androidStatus.notificationsEnabled ? 'Разрешены' : 'Отключены'}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  requestAndroidNotificationPermissions();
                  setTimeout(() => setAndroidStatus(getAndroidNotificationStatus()), 500);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Разрешить в системе Android</span>
              </button>

              {isAndroidNativeApp() && (
                <button
                  type="button"
                  onClick={() => {
                    requestAndroidBatteryExemption();
                    setTimeout(() => setAndroidStatus(getAndroidNotificationStatus()), 700);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <BatteryCharging className="w-3.5 h-3.5" />
                  <span>
                    {androidStatus?.batteryOptimizationIgnored ? '✓ Без ограничений батареи' : 'Разрешить в фоне'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={async () => {
                  await sendTestNotification();
                  setTestAlarmSent(true);
                  setTimeout(() => setTestAlarmSent(false), 2500);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{testAlarmSent ? '✓ Будильник сработал!' : 'Тест будильника'}</span>
              </button>
            </div>
          </div>

          {/* SECTION 2: THEME & LITE MODE (DS R-INFRA-05) */}
          <div className="bg-stone-50 dark:bg-stone-800/80 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm text-stone-900 dark:text-white flex items-center gap-2">
                  <span>🎨</span>
                  <span>Тема оформления</span>
                </h4>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Переключение между светлой крафтовой тетрадью и ночным режимом
                </p>
              </div>
              <ThemeToggle />
            </div>

            <div className="pt-3 border-t border-stone-200 dark:border-stone-700/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-stone-200/80 dark:bg-stone-700 text-stone-700 dark:text-stone-200 shrink-0">
                  <EyeOff className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-stone-900 dark:text-white">
                    Режим «Только текст» (облегчённый)
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Отключает тени, размытие, клетку и анимации для максимальной скорости
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={liteMode}
                aria-label="Режим Только текст"
                onClick={() => {
                  const next = !liteMode;
                  setLiteModeState(next);
                  saveLiteMode(next);
                }}
                className="cursor-pointer shrink-0"
              >
                <div
                  className={`w-11 h-6 flex items-center rounded-full p-0.5 transition ${
                    liteMode ? 'bg-amber-600' : 'bg-stone-300 dark:bg-stone-700'
                  }`}
                >
                  <div
                    className={`bg-white w-5 h-5 rounded-full shadow-md transform transition duration-200 ${
                      liteMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>

          {/* SECTION 2.5: LOCAL JSON BACKUP EXPORT */}
          <div className="bg-stone-50 dark:bg-stone-800/80 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-stone-900 dark:text-white">
                    Резервная копия заметок (JSON)
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    Скачайте локальный JSON-файл со всеми заметками ({notes.length}) и архивами для надёжного хранения на устройстве
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportAllNotesJson}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Экспортировать все заметки в JSON</span>
              </button>

              {jsonExportStatus && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{jsonExportStatus}</span>
                </span>
              )}
            </div>
          </div>

          {/* SECTION 3: SECURITY & DATA PROTECTION */}
          {onOpenSecurity && (
            <div className="bg-stone-50 dark:bg-stone-800/80 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm text-stone-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>Безопасность и PIN-код</span>
                </h4>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Защита разделов «Финансы», «Покупки» и «Архив» цифровым кодом и биометрией
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSecurity();
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition active:scale-95 cursor-pointer shadow-2xs shrink-0"
              >
                Настроить
              </button>
            </div>
          )}

          {/* SECTION 4: VERSION & CHANGELOG */}
          {onOpenChangelog && (
            <div className="bg-stone-50 dark:bg-stone-800/80 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm text-stone-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>История версий и обновления</span>
                </h4>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Что нового в последних версиях NotebookSmart
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenChangelog();
                }}
                className="px-3 py-1.5 rounded-xl bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100 font-bold text-xs transition active:scale-95 cursor-pointer shrink-0"
              >
                История
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-amber-900/10 dark:border-stone-800 bg-amber-500/5 dark:bg-stone-800/50 flex items-center justify-between">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
            Настройки сохраняются автоматически
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
