import React, { useState } from 'react';
import {
  APP_VERSION,
  APP_BUILD,
  APP_RELEASE_DATE,
  RELEASES_HISTORY,
} from '../version';
import { AppLogo } from './AppLogo';
import { checkAndApplyAppUpdate } from '../services/appUpdater';
import { Note } from '../types';
import {
  ShieldCheck,
  RefreshCw,
  GitBranch,
  Github,
  Award,
  Sparkles,
  Database,
  Lock,
  Share2,
  PieChart,
  ShoppingCart,
  Calculator,
  Download,
  Upload,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Info,
  Clock,
  Layers,
  Heart,
  Mic,
  Smartphone,
  Zap,
  BellRing,
  Activity,
  Cpu,
  Fingerprint,
  FolderDown,
  Trash,
  Check,
  Globe,
  Settings,
  HardDrive,
  FileCheck,
} from 'lucide-react';
import {
  TimezoneMode,
  getTimezoneLabel,
  getDeviceTimezone,
  isLocalDifferentFromMsk,
  getSavedTimezoneMode,
  saveTimezoneMode,
} from '../services/timezone';
import {
  getNativeAppInfo,
  isAndroidNativeApp,
  nativeHaptic,
  isNativeBiometricAvailable,
  authenticateWithNativeBiometrics,
  saveNativeBackup,
  listNativeBackups,
  readNativeBackup,
  deleteNativeBackup,
  NativeBackupItem,
} from '../services/nativeBridge';

interface AboutViewProps {
  notes: Note[];
  onOpenChangelog?: () => void;
  onOpenSecurity?: () => void;
  onOpenSettings?: () => void;
  timezoneMode?: TimezoneMode;
  onTimezoneModeChange?: (mode: TimezoneMode) => void;
  onRestoreNotes?: (notes: Note[]) => void;
}

export const AboutView: React.FC<AboutViewProps> = ({
  notes,
  onOpenChangelog,
  onOpenSecurity,
  onOpenSettings,
  timezoneMode: propTimezoneMode,
  onTimezoneModeChange: propOnTimezoneModeChange,
  onRestoreNotes,
}) => {
  const [internalTimezoneMode, setInternalTimezoneMode] = useState<TimezoneMode>(() => getSavedTimezoneMode());
  const effectiveTimezoneMode = propTimezoneMode || internalTimezoneMode;

  const handleTimezoneChange = (mode: TimezoneMode) => {
    setInternalTimezoneMode(mode);
    saveTimezoneMode(mode);
    nativeHaptic('light');
    if (propOnTimezoneModeChange) {
      propOnTimezoneModeChange(mode);
    }
  };

  const tzInfo = getTimezoneLabel(effectiveTimezoneMode);
  const deviceTz = getDeviceTimezone();

  const mskTimeStr = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  const localTimeStr = new Intl.DateTimeFormat('ru-RU', {
    timeZone: deviceTz,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [hapticTested, setHapticTested] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<string | null>(null);
  const [nativeBackups, setNativeBackups] = useState<NativeBackupItem[]>(() => listNativeBackups());
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const appInfo = getNativeAppInfo();

  const handleTestHaptic = () => {
    nativeHaptic('success');
    setHapticTested(true);
    setTimeout(() => setHapticTested(false), 2000);
  };

  const handleTestBiometrics = async () => {
    setBiometricStatus('Запрос системной биометрии Android...');
    const res = await authenticateWithNativeBiometrics(
      'Тестирование биометрии',
      'Подтвердите отпечаток пальца или Face ID'
    );
    if (res.success) {
      nativeHaptic('success');
      setBiometricStatus('✓ Биометрия успешно подтверждена!');
    } else {
      nativeHaptic('warning');
      setBiometricStatus(`Ошибка: ${res.error || 'Отменено пользователем'}`);
    }
    setTimeout(() => setBiometricStatus(null), 3500);
  };

  const handleSaveNativeBackup = async () => {
    nativeHaptic('medium');
    setBackupMsg('Сохранение в папку Documents/NotebookSmart...');
    const res = await saveNativeBackup(notes);
    if (res.success) {
      nativeHaptic('success');
      setBackupMsg(`✓ Сохранено в Documents/NotebookSmart/ (${notes.length} заметок)`);
      setNativeBackups(listNativeBackups());
    } else {
      nativeHaptic('warning');
      setBackupMsg(`Ошибка: ${res.error}`);
    }
    setTimeout(() => setBackupMsg(null), 4000);
  };

  const handleRestoreNativeBackup = async (fileName: string) => {
    if (!window.confirm(`Восстановить заметки из файла "${fileName}"? Они добавятся в вашу тетрадь.`)) return;
    nativeHaptic('medium');
    const restoredNotes = await readNativeBackup(fileName);
    if (restoredNotes && onRestoreNotes) {
      nativeHaptic('success');
      onRestoreNotes(restoredNotes);
      alert(`Успешно восстановлено ${restoredNotes.length} заметок!`);
    } else {
      nativeHaptic('warning');
      alert('Ошибка при чтении файла резервной копии.');
    }
  };

  const handleDeleteNativeBackup = (fileName: string) => {
    if (!window.confirm(`Удалить резервную копию "${fileName}"?`)) return;
    deleteNativeBackup(fileName);
    setNativeBackups(listNativeBackups());
    nativeHaptic('light');
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    setUpdateMessage('Проверка новой версии в репозитории...');
    const res = await checkAndApplyAppUpdate();
    setUpdateMessage(res.message);
    setIsUpdating(false);
    setTimeout(() => {
      setUpdateMessage(null);
    }, 4000);
  };

  // Export all user data as backup JSON
  const handleExportData = () => {
    try {
      const dataStr = JSON.stringify(
        {
          appName: 'NotebookSmart',
          version: APP_VERSION,
          exportedAt: new Date().toISOString(),
          notesCount: notes.length,
          notes,
        },
        null,
        2
      );
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `notebook_backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Ошибка при выгрузке резервной копии.');
    }
  };

  // Import backup JSON
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.notes) && onRestoreNotes) {
          if (
            window.confirm(
              `Импортировать ${parsed.notes.length} заметок из резервной копии? Они добавятся в вашу тетрадь.`
            )
          ) {
            onRestoreNotes(parsed.notes);
            alert('Заметки успешно импортированы!');
          }
        } else {
          alert('Неверный формат файла резервной копии.');
        }
      } catch {
        alert('Ошибка при чтении JSON файла.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-28 animate-in fade-in duration-200">
      {/* HERO CARD */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-600/5 dark:from-stone-850 dark:to-stone-900 border border-amber-900/15 dark:border-stone-700/80 p-6 sm:p-8 text-center shadow-sm">
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-4 drop-shadow-md">
            <AppLogo size={76} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight">
            Умная Тетрадь
          </h1>
          <p className="text-sm sm:text-base font-semibold text-amber-900/80 dark:text-amber-300/90 mt-1">
            Заметки • Расчёты • Покупки • Аналитика
          </p>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 max-w-lg mt-3 leading-relaxed">
            Интеллектуальная цифровая тетрадь со встроенным калькулятором сумм и штук,
            диаграммами расходов Recharts, умными списками покупок и конфиденциальным локальным хранением.
          </p>

          {/* Quick Version Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 dark:bg-amber-400/10 border border-amber-500/30 text-amber-950 dark:text-amber-300 font-mono text-xs font-bold">
              <span>Версия: v{APP_VERSION}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </span>

            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono text-xs font-semibold">
              <Layers className="w-3.5 h-3.5 text-stone-500" />
              <span>Сборка #{APP_BUILD}</span>
            </span>

            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>PWA Офлайн готов</span>
            </span>
          </div>

          {/* Update Action Button */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
              <span>{isUpdating ? 'Обновление...' : 'Проверить обновления приложения'}</span>
            </button>

            {onOpenChangelog && (
              <button
                onClick={onOpenChangelog}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 font-bold text-xs sm:text-sm border border-stone-200 dark:border-stone-700 shadow-2xs active:scale-95 transition cursor-pointer"
              >
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>История версий</span>
              </button>
            )}
          </div>

          {updateMessage && (
            <div className="mt-3.5 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 dark:text-emerald-300 text-xs font-medium animate-in fade-in">
              {updateMessage}
            </div>
          )}
        </div>
      </div>

      {/* TIMEZONE SETTINGS CARD */}
      <div className="bg-[#fffdf9] dark:bg-stone-900 rounded-3xl border border-amber-900/15 dark:border-stone-800 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:lg font-bold text-stone-900 dark:text-white">
                Часовой пояс приложения
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Автоматическое применение ко всем событиям и календарю
              </p>
            </div>
          </div>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-stone-500" />
              <span>Все настройки</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Option 1: Moscow Time */}
          <button
            type="button"
            onClick={() => handleTimezoneChange('default_msk')}
            className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
              effectiveTimezoneMode === 'default_msk'
                ? 'bg-amber-500/10 border-amber-500 text-stone-900 dark:text-white shadow-2xs'
                : 'bg-white dark:bg-stone-800/60 border-stone-200 dark:border-stone-750 text-stone-700 dark:text-stone-300 hover:border-amber-400'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🇷🇺</span>
                <div>
                  <div className="font-bold text-sm">Московское время (МСК)</div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">UTC+3 (стандарт)</div>
                </div>
              </div>
              {effectiveTimezoneMode === 'default_msk' && (
                <div className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-stone-200/50 dark:border-stone-700/50">
              <span className="text-stone-500 dark:text-stone-400">Текущее время:</span>
              <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{mskTimeStr}</span>
            </div>
          </button>

          {/* Option 2: Device Local Time */}
          <button
            type="button"
            onClick={() => handleTimezoneChange('device_local')}
            className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
              effectiveTimezoneMode === 'device_local'
                ? 'bg-amber-500/10 border-amber-500 text-stone-900 dark:text-white shadow-2xs'
                : 'bg-white dark:bg-stone-800/60 border-stone-200 dark:border-stone-750 text-stone-700 dark:text-stone-300 hover:border-amber-400'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌐</span>
                <div>
                  <div className="font-bold text-sm">Местное время устройства</div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-[150px]">
                    {deviceTz}
                  </div>
                </div>
              </div>
              {effectiveTimezoneMode === 'device_local' && (
                <div className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-stone-200/50 dark:border-stone-700/50">
              <span className="text-stone-500 dark:text-stone-400">Текущее время:</span>
              <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{localTimeStr}</span>
            </div>
          </button>
        </div>

        <div className="p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/20 text-xs text-stone-700 dark:text-stone-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p>
            Активен режим: <strong className="text-amber-700 dark:text-amber-400">{tzInfo.label}</strong> ({tzInfo.offsetStr}). Все события во вкладке «События» и в виджете календаря автоматически пересчитываются и группируются с учетом этого часового пояса.
          </p>
        </div>
      </div>

      {/* ENHANCED HYBRID ARCHITECTURE CARD */}
      <div className="bg-[#fffdf9] dark:bg-stone-900 rounded-3xl border border-amber-900/15 dark:border-stone-800 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span>Архитектура: Усиленный гибрид (Enhanced Hybrid)</span>
          </h2>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{appInfo.isNative ? 'Native Bridge Активен' : 'Hybrid Web/PWA Ready'}</span>
          </span>
        </div>

        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
          В версии 1.9.6 реализованы все 5 ключевых шагов архитектуры <strong>«Усиленный гибрид»</strong>: мощное ядро React 19 / TypeScript объединено с прямым Java/Android мостом. Это даёт идеальный баланс: мгновенный отзывчивый UI и полный доступ ко всем системным API Android.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
          {/* STEP 1 & 2: Widget */}
          <div className="p-3.5 rounded-2xl bg-stone-50/80 dark:bg-stone-950/50 border border-stone-200/60 dark:border-stone-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-stone-900 dark:text-white block mb-0.5">
                Шаг 1-2: Виджет рабочего стола (AppWidget)
              </strong>
              <p className="text-stone-600 dark:text-stone-400 leading-snug">
                RemoteViews виджет 3x2 / 4x2 прямо на домашнем экране с живым списком покупок и суммами счетов.
              </p>
            </div>
          </div>

          {/* ALARM MANAGER */}
          <div className="p-3.5 rounded-2xl bg-stone-50/80 dark:bg-stone-950/50 border border-stone-200/60 dark:border-stone-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-stone-900 dark:text-white block mb-0.5">
                Точные будильники (AlarmManager)
              </strong>
              <p className="text-stone-600 dark:text-stone-400 leading-snug">
                setExactAndAllowWhileIdle + BroadcastReceiver будят телефон и присылают пуш даже при закрытом приложении.
              </p>
            </div>
          </div>

          {/* STEP 3: Shortcuts & Share */}
          <div className="p-3.5 rounded-2xl bg-stone-50/80 dark:bg-stone-950/50 border border-stone-200/60 dark:border-stone-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-stone-900 dark:text-white block mb-0.5">
                Шаг 3: Ярлыки (Shortcuts) & Прием шаринга
              </strong>
              <p className="text-stone-600 dark:text-stone-400 leading-snug">
                Быстрые действия по долгому нажатию на иконку и приём текста/списков из других приложений (ACTION_SEND).
              </p>
            </div>
          </div>

          {/* STEP 4: Native Biometrics */}
          <div className="p-3.5 rounded-2xl bg-stone-50/80 dark:bg-stone-950/50 border border-stone-200/60 dark:border-stone-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Fingerprint className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-stone-900 dark:text-white block mb-0.5">
                Шаг 4: Нативная биометрия (BiometricPrompt)
              </strong>
              <p className="text-stone-600 dark:text-stone-400 leading-snug">
                Системный диалог подтверждения личности через сканер отпечатка пальца, Face Unlock и PIN экрана.
              </p>
            </div>
          </div>

          {/* STEP 5: Native Documents Storage */}
          <div className="p-3.5 rounded-2xl bg-stone-50/80 dark:bg-stone-950/50 border border-stone-200/60 dark:border-stone-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-stone-900 dark:text-white block mb-0.5">
                Шаг 5: Бэкап в Documents/NotebookSmart/
              </strong>
              <p className="text-stone-600 dark:text-stone-400 leading-snug">
                Прямое сохранение резервных копий базы заметок в системное файловое хранилище Android без браузера.
              </p>
            </div>
          </div>

          {/* Haptics */}
          <div className="p-3.5 rounded-2xl bg-stone-50/80 dark:bg-stone-950/50 border border-stone-200/60 dark:border-stone-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-stone-900 dark:text-white block mb-0.5">
                Аппаратный виброотклик (Haptics)
              </strong>
              <p className="text-stone-600 dark:text-stone-400 leading-snug">
                Прямое управление системным вибратором смартфона (VibrationEffect) для приятного тактильного ощущения.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons for Interactive Testing */}
        <div className="pt-2 flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleTestHaptic}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-950 dark:text-amber-300 border border-amber-400/40 font-bold text-xs transition active:scale-95 cursor-pointer"
          >
            <Zap className={`w-4 h-4 ${hapticTested ? 'text-amber-600 fill-amber-500 animate-bounce' : 'text-amber-600'}`} />
            <span>{hapticTested ? '✓ Тактильный отклик сработал!' : 'Тест виброотклика'}</span>
          </button>

          <button
            onClick={handleTestBiometrics}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-950 dark:text-indigo-300 border border-indigo-400/40 font-bold text-xs transition active:scale-95 cursor-pointer"
          >
            <Fingerprint className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Тест биометрии Android</span>
          </button>

          <button
            onClick={handleSaveNativeBackup}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-950 dark:text-emerald-300 border border-emerald-400/40 font-bold text-xs transition active:scale-95 cursor-pointer"
          >
            <FolderDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Сохранить в Documents/</span>
          </button>
        </div>

        {biometricStatus && (
          <div className="mt-2 px-4 py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-900 dark:text-indigo-300 text-xs font-medium animate-in fade-in">
            {biometricStatus}
          </div>
        )}

        {backupMsg && (
          <div className="mt-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 dark:text-emerald-300 text-xs font-medium animate-in fade-in">
            {backupMsg}
          </div>
        )}

        {/* Saved Native Backups List */}
        {nativeBackups.length > 0 && (
          <div className="mt-4 pt-3 border-t border-stone-200/80 dark:border-stone-800">
            <h3 className="text-xs font-bold text-stone-900 dark:text-white mb-2 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Резервные копии на устройстве ({nativeBackups.length}):</span>
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {nativeBackups.map((b) => (
                <div
                  key={b.fileName}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200/70 dark:border-stone-800 text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-mono font-semibold text-stone-800 dark:text-stone-200 truncate">
                      {b.fileName}
                    </div>
                    <div className="text-[10px] text-stone-500 dark:text-stone-400">
                      {new Date(b.lastModified).toLocaleString('ru-RU')} • {(b.size / 1024).toFixed(1)} КБ
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleRestoreNativeBackup(b.fileName)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition active:scale-95 cursor-pointer"
                    >
                      Восстановить
                    </button>
                    <button
                      onClick={() => handleDeleteNativeBackup(b.fileName)}
                      className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/40 text-stone-400 hover:text-rose-600 transition cursor-pointer"
                      title="Удалить файл"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SYSTEM & BUILD SPECIFICATIONS */}
      <div className="bg-[#fffdf9] dark:bg-stone-900 rounded-3xl border border-amber-900/15 dark:border-stone-800 p-5 sm:p-6 shadow-sm space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
          <Info className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span>Спецификация сборки и лицензия</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm font-mono">
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200/80 dark:border-stone-800">
            <span className="text-stone-500 dark:text-stone-400 block text-[11px] mb-1">
              Название программы
            </span>
            <span className="font-bold text-stone-900 dark:text-stone-100">
              «Умная Тетрадь» (NotebookSmart)
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200/80 dark:border-stone-800">
            <span className="text-stone-500 dark:text-stone-400 block text-[11px] mb-1">
              Версия и Дата сборки
            </span>
            <span className="font-bold text-stone-900 dark:text-stone-100">
              v{APP_VERSION} (Сборка #{APP_BUILD}) • {APP_RELEASE_DATE}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200/80 dark:border-stone-800">
            <span className="text-stone-500 dark:text-stone-400 block text-[11px] mb-1">
              Лицензия на ПО
            </span>
            <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
              <Award className="w-4 h-4" />
              <span>MIT License (Свободное ПО)</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200/80 dark:border-stone-800">
            <span className="text-stone-500 dark:text-stone-400 block text-[11px] mb-1">
              Репозиторий проекта
            </span>
            <a
              href="https://github.com/pippopil/NotebookSmart"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 hover:underline"
            >
              <Github className="w-4 h-4" />
              <span>github.com/pippopil/NotebookSmart</span>
              <ExternalLink className="w-3 h-3 ml-auto opacity-70" />
            </a>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
          <p>
            <strong>Условия лицензии MIT:</strong> Предоставляется бесплатно любому лицу право на использование, копирование, изменение, объединение, публикацию и распространение копий программного обеспечения без ограничений.
          </p>
        </div>
      </div>

      {/* PRIVACY & SECURITY BANNER */}
      <div className="bg-[#fffdf9] dark:bg-stone-900 rounded-3xl border border-emerald-900/20 dark:border-emerald-900/40 p-5 sm:p-6 shadow-sm space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>Приватность и безопасность данных</span>
        </h2>

        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
          Все ваши данные, сметы, списки покупок и личные записи хранятся <strong>исключительно на вашем устройстве</strong> в локальном хранилище браузера (LocalStorage / IndexedDB).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs">
          <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
            <span className="font-bold text-emerald-900 dark:text-emerald-300 block mb-1">
              🔒 100% Локально
            </span>
            <span className="text-stone-600 dark:text-stone-400">
              Никакой слежки, аналитики и передачи персональных данных третьим лицам.
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40">
            <span className="font-bold text-purple-900 dark:text-purple-300 block mb-1">
              🔑 PIN & Биометрия
            </span>
            <span className="text-stone-600 dark:text-stone-400">
              Возможность защитить разделы оплат и покупок кодом или Touch ID / Face ID.
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-800/40">
            <span className="font-bold text-sky-900 dark:text-sky-300 block mb-1">
              ⚡ Автономный режим
            </span>
            <span className="text-stone-600 dark:text-stone-400">
              Приложение полноценно работает без подключения к интернету в офлайн-режиме.
            </span>
          </div>
        </div>

        {onOpenSecurity && (
          <div className="pt-2">
            <button
              onClick={onOpenSecurity}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 text-xs font-bold transition active:scale-95 cursor-pointer border border-stone-200 dark:border-stone-700"
            >
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>Настроить защиту доступа (PIN / Face ID)</span>
            </button>
          </div>
        )}
      </div>

      {/* CORE FEATURES LIST */}
      <div className="bg-[#fffdf9] dark:bg-stone-900 rounded-3xl border border-amber-900/15 dark:border-stone-800 p-5 sm:p-6 shadow-sm space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span>Ключевые возможности приложения</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-stone-50/80 dark:bg-stone-950/50 border border-stone-200/60 dark:border-stone-800">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-stone-900 dark:text-white block mb-0.5">
                Калькулятор прямо в тексте
              </strong>
              <p className="text-stone-600 dark:text-stone-400 leading-snug">
                Мгновенный автоматический подсчет денежных сумм (₽, $, €) и количеств в штуках («шт.»).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-stone-50/80 dark:bg-stone-950/50 border border-stone-200/60 dark:border-stone-800">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-stone-900 dark:text-white block mb-0.5">
                График расходов Recharts
              </strong>
              <p className="text-stone-600 dark:text-stone-400 leading-snug">
                Наглядная интерактивная круговая диаграмма распределения затрат по умным тегам заметок.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-stone-50/80 dark:bg-stone-950/50 border border-stone-200/60 dark:border-stone-800">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-stone-900 dark:text-white block mb-0.5">
                Умная корзина и память брендов
              </strong>
              <p className="text-stone-600 dark:text-stone-400 leading-snug">
                Расчет полной стоимости корзины по минимальным ценам, расчет экономии и запоминание любимых марок.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-stone-50/80 dark:bg-stone-950/50 border border-stone-200/60 dark:border-stone-800">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-700 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-stone-900 dark:text-white block mb-0.5">
                Отправка в МАКС и соцсети
              </strong>
              <p className="text-stone-600 dark:text-stone-400 leading-snug">
                Красивое оформление заметок для отправки в мессенджер МАКС, Telegram, WhatsApp и VKontakte.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-stone-50/80 dark:bg-stone-950/50 border border-stone-200/60 dark:border-stone-800">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-stone-900 dark:text-white block mb-0.5">
                Голосовой ввод (Web Speech API)
              </strong>
              <p className="text-stone-600 dark:text-stone-400 leading-snug">
                Быстрая диктовка мыслей и списков голосом в NoteEditor с умной авто-пунктуацией и голосовыми командами.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BACKUP & RESTORE DATA */}
      <div className="bg-[#fffdf9] dark:bg-stone-900 rounded-3xl border border-amber-900/15 dark:border-stone-800 p-5 sm:p-6 shadow-sm space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span>Резервное копирование и управление данными</span>
        </h2>

        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300">
          Сохраните резервную копию всех записей вашей тетради в JSON-файл или восстановите данные на новом устройстве.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleExportData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-950 dark:text-amber-300 border border-amber-400/40 font-bold text-xs sm:text-sm transition active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Скачать резервную копию ({notes.length} заметок)</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 font-bold text-xs sm:text-sm transition active:scale-95 cursor-pointer">
            <Upload className="w-4 h-4 text-stone-500" />
            <span>Восстановить из файла JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportData}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* FOOTER NOTE */}
      <div className="text-center text-xs text-stone-500 dark:text-stone-400 py-3 space-y-1">
        <p className="flex items-center justify-center gap-1">
          <span>Сделано с</span>
          <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 inline" />
          <span>для удобных расчетов и заметок</span>
        </p>
        <p className="font-mono text-[11px] text-stone-400 dark:text-stone-500">
          NotebookSmart v{APP_VERSION} (Build {APP_BUILD}) • MIT License
        </p>
      </div>
    </div>
  );
};
