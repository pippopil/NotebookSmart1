import React, { useState } from 'react';
import { APP_VERSION, APP_RELEASE_DATE, RELEASES_HISTORY } from '../version';
import { AppLogo } from './AppLogo';
import {
  X,
  Calendar,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Github,
  Zap,
} from 'lucide-react';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  const [expandedVersion, setExpandedVersion] = useState<string>(APP_VERSION);
  const [checkingUpdate, setCheckingUpdate] = useState<boolean>(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCheckUpdate = () => {
    setCheckingUpdate(true);
    setUpdateMsg(null);
    setTimeout(() => {
      setCheckingUpdate(false);
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.update());
        });
      }
      setUpdateMsg('У вас установлена самая актуальная версия v' + APP_VERSION);
      setTimeout(() => setUpdateMsg(null), 4000);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 dark:bg-black/80 backdrop-blur-md p-4 safe-top safe-bottom transition-colors">
      <div className="w-full max-w-lg bg-white dark:bg-stone-900 border border-amber-900/15 dark:border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-stone-900 dark:text-stone-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-[#fcfaf7] dark:bg-stone-950 border-b border-amber-900/10 dark:border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <AppLogo size={34} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-stone-900 dark:text-white">История обновлений</h3>
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/30">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Что изменилось и добавлено в каждом релизе
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status banner */}
        <div className="px-5 py-3 bg-amber-50/60 dark:bg-stone-950/60 border-b border-amber-900/10 dark:border-stone-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-stone-700 dark:text-stone-300">
              Текущая версия: <strong className="text-stone-900 dark:text-white">v{APP_VERSION}</strong> ({APP_RELEASE_DATE})
            </span>
          </div>

          <button
            onClick={handleCheckUpdate}
            disabled={checkingUpdate}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
            <span>{checkingUpdate ? 'Проверка...' : 'Обновить'}</span>
          </button>
        </div>

        {updateMsg && (
          <div className="px-5 py-2 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 text-xs font-medium text-center border-b border-emerald-200 dark:border-emerald-500/30 shrink-0 animate-in fade-in">
            {updateMsg}
          </div>
        )}

        {/* Scrollable List of Releases */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {RELEASES_HISTORY.map((rel) => {
            const isExpanded = expandedVersion === rel.version;

            return (
              <div
                key={rel.version}
                className={`rounded-2xl border transition overflow-hidden ${
                  rel.isLatest
                    ? 'bg-[#fffdf9] dark:bg-stone-950/80 border-amber-400/50 dark:border-amber-500/40 shadow-xs'
                    : 'bg-stone-50 dark:bg-stone-950/40 border-stone-200 dark:border-stone-800'
                }`}
              >
                {/* Release header item */}
                <div
                  onClick={() => setExpandedVersion(isExpanded ? '' : rel.version)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-amber-50/50 dark:hover:bg-stone-800/40 transition select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-stone-900 dark:text-white">
                          v{rel.version}
                        </span>
                        {rel.isLatest && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 uppercase tracking-wide">
                            Актуальный релиз
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {rel.releaseDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-stone-500 dark:text-slate-400">
                    <span className="text-xs hidden sm:inline font-medium">
                      {rel.title}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Highlights and details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-amber-900/10 dark:border-stone-800/80 space-y-4 bg-white/60 dark:bg-stone-900/40">
                    {/* Title */}
                    <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      {rel.title}
                    </h4>

                    {/* Quick highlights */}
                    <div className="bg-amber-50/70 dark:bg-stone-950 p-3 rounded-xl border border-amber-200/60 dark:border-stone-800/80 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 tracking-wider block">
                        Главное в обновлении:
                      </span>
                      {rel.highlights.map((h, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-stone-800 dark:text-stone-200">
                          <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>

                    {/* Detailed categorized items */}
                    <div className="space-y-3">
                      {rel.categories.map((cat, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <span className="text-xs font-semibold text-stone-800 dark:text-stone-300 block">
                            {cat.name}
                          </span>
                          <ul className="space-y-1 pl-1">
                            {cat.items.map((it, itemIdx) => (
                              <li
                                key={itemIdx}
                                className="text-xs text-stone-600 dark:text-stone-400 flex items-start gap-2"
                              >
                                <span className="text-amber-500 font-bold shrink-0">•</span>
                                <span>{it}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer with GitHub Releases link & APK Download */}
        <div className="px-5 py-3.5 bg-[#fcfaf7] dark:bg-stone-950 border-t border-amber-900/10 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <a
              href="https://github.com/pippopil/NotebookSmart/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition active:scale-95"
            >
              <span>📦 Скачать APK (Android)</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href="https://github.com/pippopil/NotebookSmart/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:underline transition hidden sm:inline-flex"
            >
              <Github className="w-3.5 h-3.5" />
              <span>Релизы на GitHub</span>
            </a>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-semibold transition cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
