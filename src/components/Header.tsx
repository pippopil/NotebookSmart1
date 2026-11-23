import React from 'react';
import { PWAInstallButton } from './PWAInstallButton';
import { SyncStatus } from '../types';
import { Cloud, CloudOff, RefreshCw, Github, WifiOff, Search, Shield, ShieldCheck, Lock, Settings } from 'lucide-react';
import { AppLogo } from './AppLogo';
import { ThemeToggle } from './ThemeToggle';
import { APP_VERSION } from '../version';

import { checkAndApplyAppUpdate } from '../services/appUpdater';

interface HeaderProps {
  syncStatus: SyncStatus;
  isOnline: boolean;
  onOpenSync: () => void;
  onOpenSettings?: () => void;
  onOpenChangelog?: () => void;
  onOpenTemplates?: () => void;
  onOpenSearch?: () => void;
  onOpenSecurity?: () => void;
  isSecurityConfigured?: boolean;
  isUnlocked?: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  syncStatus,
  isOnline,
  onOpenSync,
  onOpenSettings,
  onOpenChangelog,
  onOpenTemplates,
  onOpenSecurity,
  isSecurityConfigured = false,
  isUnlocked = false,
  searchQuery,
  onSearchChange,
}) => {
  const [isUpdatingApp, setIsUpdatingApp] = React.useState(false);
  const [updateFeedback, setUpdateFeedback] = React.useState<string | null>(null);

  const handleTriggerUpdate = async () => {
    setIsUpdatingApp(true);
    setUpdateFeedback('Проверка обновлений...');
    const res = await checkAndApplyAppUpdate();
    setUpdateFeedback(res.message);
    setIsUpdatingApp(false);
    setTimeout(() => setUpdateFeedback(null), 3500);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#fcfaf7]/90 dark:bg-[#161412]/90 backdrop-blur-xl border-b border-amber-900/10 dark:border-stone-800/80 px-4 py-3 safe-top transition-colors">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2.5">
        {/* Brand: App Icon & In-App Updater (Version moved to About App tab per user request) */}
        <div className="flex items-center gap-2">
          <AppLogo size={34} />
          <div className="flex items-center gap-1.5">
            {/* In-app update button without reinstalling */}
            <button
              onClick={handleTriggerUpdate}
              disabled={isUpdatingApp}
              className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 transition active:scale-95 cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
              title="Проверить и обновить приложение прямо сейчас без переустановки"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${isUpdatingApp ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Обновить</span>
            </button>
          </div>
        </div>

        {/* Right tools: Settings, Theme Toggle (День/Ночь), Templates, Sync, PWA, GitHub */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* App Settings Modal (Timezone MSK/Local, Theme, Security) */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 transition active:scale-95 cursor-pointer flex items-center justify-center"
              title="Настройки приложения (выбор часового пояса МСК / локальный)"
            >
              <Settings className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </button>
          )}

          {/* Day / Night Mode Toggle */}
          <ThemeToggle />

          {/* Security Protection (PIN / Biometrics) */}
          {onOpenSecurity && (
            <button
              onClick={onOpenSecurity}
              className={`p-1.5 rounded-xl border transition active:scale-95 cursor-pointer flex items-center justify-center ${
                isSecurityConfigured
                  ? isUnlocked
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/30'
                  : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700'
              }`}
              title={
                isSecurityConfigured
                  ? isUnlocked
                    ? 'Защита активна (разблокировано). Нажмите для настроек или блокировки'
                    : 'Категории заблокированы. Нажмите для настроек'
                  : 'Настроить защиту данных (PIN-код / биометрия)'
              }
            >
              {isSecurityConfigured ? (
                isUnlocked ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                )
              ) : (
                <Shield className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Quick Life Templates button */}
          {onOpenTemplates && (
            <button
              onClick={onOpenTemplates}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-amber-900 dark:text-amber-300 border border-amber-200/80 dark:border-stone-700 text-xs font-bold transition active:scale-95 cursor-pointer"
              title="Готовые шаблоны: Бюджет, Продукты, Авто, Аптечка"
            >
              <span>⚡</span>
              <span className="hidden md:inline">Шаблоны</span>
            </button>
          )}

          {/* Offline notice */}
          {!isOnline && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[11px]">
              <WifiOff className="w-3 h-3" />
              <span className="hidden sm:inline">Офлайн</span>
            </div>
          )}

          {/* Sync status button */}
          <button
            onClick={onOpenSync}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 hover:bg-stone-200/80 dark:bg-stone-850 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 text-xs font-medium transition active:scale-95"
            title="Синхронизация Firebase & GitHub Actions"
          >
            {syncStatus.isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 hidden sm:inline">Синхрон</span>
              </>
            ) : syncStatus.isConfigured ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-spin" />
                <span className="text-[11px] text-amber-700 dark:text-amber-300 hidden sm:inline">Подключение</span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-[11px] text-stone-500 dark:text-stone-400 hidden sm:inline">Firebase</span>
              </>
            )}
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton compact />

          {/* GitHub Action repo link button */}
          <a
            href="https://github.com/pippopil/NotebookSmart"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white border border-stone-200 dark:border-stone-700 transition"
            title="GitHub: pippopil/NotebookSmart"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Quick Search bar */}
      <div className="max-w-4xl mx-auto mt-2.5">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск по заметкам, товарам или суммам..."
            className="w-full bg-white/95 dark:bg-stone-900/90 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 rounded-xl px-3.5 py-1.5 pl-9 border border-amber-900/15 dark:border-stone-800 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition shadow-2xs"
          />
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2 text-xs text-stone-400 hover:text-stone-700 dark:hover:text-white bg-stone-200 dark:bg-stone-800 rounded-full w-4 h-4 flex items-center justify-center transition"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Floating in-app update feedback banner */}
      {updateFeedback && (
        <div className="max-w-4xl mx-auto mt-2">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 dark:bg-emerald-950/60 border border-emerald-400/40 text-emerald-900 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between animate-fade-in shadow-xs">
            <div className="flex items-center gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingApp ? 'animate-spin' : ''}`} />
              <span>{updateFeedback}</span>
            </div>
            <button
              onClick={() => setUpdateFeedback(null)}
              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-xs p-0.5"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
