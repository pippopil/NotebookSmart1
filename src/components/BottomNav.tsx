import React, { useState } from 'react';
import {
  FileText,
  ShoppingCart,
  Calendar,
  Calculator,
  Plus,
  X,
  Archive,
  Info,
} from 'lucide-react';
import { NoteCategory } from '../types';

export type NavTabType = 'notes' | 'shopping' | 'events' | 'calc' | 'sync' | 'archive' | 'about';

interface BottomNavProps {
  activeTab: NavTabType;
  onTabChange: (tab: NavTabType) => void;
  onNewNote: (category: NoteCategory) => void;
  onOpenTemplates?: () => void;
  pendingShoppingCount: number;
  upcomingEventsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  onNewNote,
  onOpenTemplates,
  pendingShoppingCount,
  upcomingEventsCount = 0,
}) => {
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  };

  const handleCreateCategory = (cat: NoteCategory) => {
    triggerHaptic();
    setShowQuickMenu(false);
    onNewNote(cat);
  };

  return (
    <>
      {/* Quick Add Popover Menu */}
      {showQuickMenu && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/60 dark:bg-black/70 backdrop-blur-xs flex items-end justify-center pb-24 px-4 transition-all"
          onClick={() => setShowQuickMenu(false)}
        >
          <div
            className="w-full max-w-xs bg-[#fffdfa] dark:bg-stone-900 border border-amber-900/15 dark:border-stone-700/80 rounded-3xl p-4 shadow-2xl space-y-2.5 text-stone-900 dark:text-stone-100 animate-in fade-in slide-in-from-bottom-5 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-amber-900/10 dark:border-stone-800">
              <span className="text-xs font-bold text-amber-900/70 dark:text-stone-400 uppercase tracking-wider">
                Создать в тетради
              </span>
              <button
                onClick={() => setShowQuickMenu(false)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => handleCreateCategory('note')}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-blue-50/60 hover:bg-blue-100/70 dark:bg-stone-800/80 dark:hover:bg-stone-800 border border-blue-200/60 dark:border-stone-700/60 text-left transition active:scale-98"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-stone-900 dark:text-white block">📝 Новая запись</span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">Текст, доходы, расходы и числа считаются сами</span>
              </div>
            </button>

            <button
              onClick={() => handleCreateCategory('shopping')}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-stone-800/80 dark:hover:bg-stone-800 border border-emerald-300/70 dark:border-stone-700/60 text-left transition active:scale-98"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-stone-900 dark:text-white block">🛒 Список покупок</span>
                <span className="text-[11px] text-stone-600 dark:text-stone-400">Чек-лист товаров с отметками</span>
              </div>
            </button>

            <button
              onClick={() => handleCreateCategory('event')}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-purple-50/60 hover:bg-purple-100/70 dark:bg-stone-800/80 dark:hover:bg-stone-800 border border-purple-200/60 dark:border-stone-700/60 text-left transition active:scale-98"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-stone-900 dark:text-white block">📅 Событие / Напоминание</span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">Календарь, встречи и системный будильник</span>
              </div>
            </button>

            {onOpenTemplates && (
              <button
                onClick={() => {
                  triggerHaptic();
                  setShowQuickMenu(false);
                  onOpenTemplates();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 border border-amber-400/40 text-left transition active:scale-98"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 font-bold">
                  ⚡
                </div>
                <div>
                  <span className="text-sm font-bold text-amber-950 dark:text-amber-300 block">
                    Готовые шаблоны на каждый день
                  </span>
                  <span className="text-[11px] text-stone-600 dark:text-stone-400">
                    Бюджет, авто, аптечка, отпуск, чеклисты
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#fcfaf7]/95 dark:bg-[#141210]/95 backdrop-blur-xl border-t border-amber-900/10 dark:border-stone-800/80 safe-bottom transition-colors">
        <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between relative">
          {/* Notes tab */}
          <button
            onClick={() => onTabChange('notes')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'notes'
                ? 'text-amber-600 dark:text-amber-400 font-bold scale-105'
                : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px]">Заметки</span>
          </button>

          {/* Shopping tab */}
          <button
            onClick={() => onTabChange('shopping')}
            className={`flex flex-col items-center gap-1 transition relative ${
              activeTab === 'shopping'
                ? 'text-amber-600 dark:text-amber-400 font-bold scale-105'
                : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300'
            }`}
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              {pendingShoppingCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-emerald-600 text-white text-[10px] font-bold px-1 rounded-full min-w-[15px] text-center shadow">
                  {pendingShoppingCount}
                </span>
              )}
            </div>
            <span className="text-[10px]">Покупки</span>
          </button>

          {/* Center Big Add Button: Warm Amber/Orange */}
          <div className="relative -top-5">
            <button
              onClick={() => {
                triggerHaptic();
                setShowQuickMenu(!showQuickMenu);
              }}
              className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/35 flex items-center justify-center hover:scale-105 active:scale-95 transition"
              title="Создать запись в тетради"
            >
              <Plus className={`w-7 h-7 stroke-[2.5] transition-transform duration-200 ${showQuickMenu ? 'rotate-45' : ''}`} />
            </button>
          </div>

          {/* Events tab */}
          <button
            onClick={() => onTabChange('events')}
            className={`flex flex-col items-center gap-1 transition relative ${
              activeTab === 'events'
                ? 'text-amber-600 dark:text-amber-400 font-bold scale-105'
                : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300'
            }`}
          >
            <div className="relative">
              <Calendar className="w-5 h-5" />
              {upcomingEventsCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-purple-600 text-white text-[10px] font-bold px-1 rounded-full min-w-[15px] text-center shadow">
                  {upcomingEventsCount}
                </span>
              )}
            </div>
            <span className="text-[10px]">События</span>
          </button>

          {/* Finances & Calculator Summary tab */}
          <button
            onClick={() => onTabChange('calc')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'calc'
                ? 'text-amber-600 dark:text-amber-400 font-bold scale-105'
                : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300'
            }`}
            title="Финансы: сводка доходов, расходов, диаграмма трат и калькулятор"
          >
            <Calculator className="w-5 h-5" />
            <span className="text-[10px]">Финансы</span>
          </button>

          {/* Archive tab */}
          <button
            onClick={() => onTabChange('archive')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'archive'
                ? 'text-amber-600 dark:text-amber-400 font-bold scale-105'
                : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300'
            }`}
            title="Архив прошлых месяцев и покупок"
          >
            <Archive className="w-5 h-5" />
            <span className="text-[10px]">Архив</span>
          </button>

          {/* About App tab per user request */}
          <button
            onClick={() => onTabChange('about')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'about'
                ? 'text-amber-600 dark:text-amber-400 font-bold scale-105'
                : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300'
            }`}
            title="О приложении: версия сборки, название, лицензия и возможности"
          >
            <Info className="w-5 h-5" />
            <span className="text-[10px] whitespace-nowrap">О приложении</span>
          </button>
        </div>
      </nav>
    </>
  );
};
