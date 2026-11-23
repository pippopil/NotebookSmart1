import React from 'react';
import { Note, EVENT_CATEGORY_CONFIG } from '../types';
import { formatMoney } from '../utils/mathEngine';
import {
  Pin,
  ShoppingCart,
  Calculator,
  Calendar,
  FileText,
  Tag,
  ArrowRight,
  Clock,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Bell,
  Lock,
  Package,
  Share2,
} from 'lucide-react';
import { formatReminderDateTime } from '../services/notifications';

interface NoteCardProps {
  note: Note;
  onOpen: (note: Note) => void;
  onTogglePin: (id: string) => void;
  onOpenShopping: (note: Note) => void;
  isLocked?: boolean;
  globalAutoCalculate?: boolean;
  onTagClick?: (tag: string) => void;
  onShare?: (note: Note) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onOpen,
  onTogglePin,
  onOpenShopping,
  isLocked = false,
  globalAutoCalculate = true,
  onTagClick,
  onShare,
}) => {
  const isShopping = note.category === 'shopping' || (note.shoppingItemsCount || 0) > 0;
  const isEvent = note.category === 'event';
  const isAutoCalcEnabled = globalAutoCalculate;
  const hasIncome = (note.cachedIncome || 0) > 0;
  const hasExpenses = (note.cachedExpenses || 0) > 0;
  const hasCashflow = hasIncome && hasExpenses;
  const hasMoneyCurrency = Boolean(note.currency && note.currency.trim().length > 0);
  const hasAnyCalc =
    isAutoCalcEnabled &&
    ((note.cachedTotal !== undefined && note.cachedTotal !== 0) ||
      hasIncome ||
      hasExpenses ||
      (note.cachedPieces !== undefined && note.cachedPieces > 0));
  const hasPayments =
    isAutoCalcEnabled &&
    ((note.cachedTotal !== undefined && note.cachedTotal !== 0) || hasIncome || hasExpenses);

  const shoppingDone = note.completedItemsCount || 0;
  const shoppingTotal = note.shoppingItemsCount || 0;
  const shoppingProgress = shoppingTotal > 0 ? (shoppingDone / shoppingTotal) * 100 : 0;

  const dateStr = new Date(note.updatedAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const categoryConfig = {
    shopping: {
      label: 'Покупки',
      icon: ShoppingCart,
      bgColor: 'bg-emerald-100/90 dark:bg-emerald-500/20',
      textColor: 'text-emerald-900 dark:text-emerald-300 font-bold',
      borderColor: 'border-emerald-300 dark:border-emerald-500/40',
    },
    event: {
      label: 'Событие',
      icon: Calendar,
      bgColor: 'bg-purple-100/90 dark:bg-purple-500/20',
      textColor: 'text-purple-900 dark:text-purple-300 font-bold',
      borderColor: 'border-purple-300 dark:border-purple-500/40',
    },
    payment: {
      label: 'Финансы',
      icon: Calculator,
      bgColor: 'bg-amber-100/90 dark:bg-amber-500/20',
      textColor: 'text-amber-950 dark:text-amber-300 font-bold',
      borderColor: 'border-amber-300 dark:border-amber-500/40',
    },
    calculation: {
      label: 'Расчёт',
      icon: Calculator,
      bgColor: 'bg-teal-100/90 dark:bg-teal-500/20',
      textColor: 'text-teal-950 dark:text-teal-300 font-bold',
      borderColor: 'border-teal-300 dark:border-teal-500/40',
    },
    general: {
      label: 'Заметка',
      icon: FileText,
      bgColor: 'bg-stone-200/90 dark:bg-stone-500/20',
      textColor: 'text-stone-900 dark:text-stone-300 font-bold',
      borderColor: 'border-stone-300 dark:border-stone-500/40',
    },
    budget: {
      label: 'Бюджет',
      icon: Wallet,
      bgColor: 'bg-emerald-100/90 dark:bg-emerald-500/20',
      textColor: 'text-emerald-950 dark:text-emerald-300 font-bold',
      borderColor: 'border-emerald-300 dark:border-emerald-500/40',
    },
    note: {
      label: 'Заметка',
      icon: FileText,
      bgColor: 'bg-blue-100/90 dark:bg-blue-500/20',
      textColor: 'text-blue-950 dark:text-blue-300 font-bold',
      borderColor: 'border-blue-300 dark:border-blue-500/40',
    },
  }[note.category] || {
    label: 'Заметка',
    icon: FileText,
    bgColor: 'bg-stone-200/90 dark:bg-stone-500/20',
    textColor: 'text-stone-900 dark:text-stone-300 font-bold',
    borderColor: 'border-stone-300 dark:border-stone-500/40',
  };

  const CatIcon = categoryConfig.icon;

  // Paper styling class
  const paperClass = {
    'dark-grid': 'notebook-grid-dark',
    lines: 'notebook-lines',
    kraft: 'notebook-kraft',
    dots: 'notebook-dots',
    plain: 'notebook-plain',
    grid: 'notebook-grid-warm',
  }[note.paperStyle || 'grid'] || 'notebook-grid-warm';

  return (
    <div
      onClick={() => onOpen(note)}
      className={`group relative ${paperClass} page-dog-ear notebook-paper-shadow rounded-2xl p-4 transition-all duration-200 cursor-pointer hover:shadow-lg border border-amber-900/15 dark:border-stone-800 hover:border-amber-500/60 dark:hover:border-amber-500/50 overflow-hidden text-stone-900 dark:text-stone-100`}
    >
      {/* Тетрадный переплет: левая полоса с полями и спиралью */}
      <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-b from-amber-100 via-amber-200 to-amber-100 dark:from-stone-800 dark:via-stone-700 dark:to-stone-800 border-r border-amber-300/50 dark:border-stone-700/80" />
      {/* Красные поля школьной тетради */}
      <div className="absolute left-7 top-0 bottom-0 w-[1.5px] bg-rose-500/60 dark:bg-rose-500/40 pointer-events-none" />

      {/* Main card body with indent for notebook margins */}
      <div className="pl-6">
        {/* Header row: Category Pill + Title + Pin */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider border shadow-2xs ${categoryConfig.bgColor} ${categoryConfig.textColor} ${categoryConfig.borderColor}`}
            >
              <CatIcon className="w-3 h-3" />
              <span>{categoryConfig.label}</span>
            </span>

            {/* Event category badge if set */}
            {isEvent && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-2xs ${EVENT_CATEGORY_CONFIG[note.eventCategory || 'meeting'].badgeClass}`}>
                <span>{EVENT_CATEGORY_CONFIG[note.eventCategory || 'meeting'].icon}</span>
                <span>{EVENT_CATEGORY_CONFIG[note.eventCategory || 'meeting'].label}</span>
              </span>
            )}

            {/* Event date badge if set */}
            {isEvent && (note.eventDate || note.eventTime) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-800/60">
                <Clock className="w-3 h-3 text-purple-700 dark:text-purple-400" />
                <span>
                  {note.eventDate ? new Date(note.eventDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''}
                  {note.eventTime ? ` в ${note.eventTime}` : ''}
                </span>
              </span>
            )}

            {/* Scheduled Reminder badge (Event or Shopping) */}
            {note.reminderEnabled && note.reminderDateTime && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60"
                title={`Установлено push-напоминание: ${formatReminderDateTime(note.reminderDateTime)}`}
              >
                <Bell className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>{formatReminderDateTime(note.reminderDateTime)}</span>
              </span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(note.id);
            }}
            className={`p-1.5 rounded-lg transition active:scale-90 ${
              note.isPinned
                ? 'text-amber-700 dark:text-amber-400 bg-amber-400/25 border border-amber-400/40'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
            title={note.isPinned ? 'Открепить' : 'Закрепить сверху'}
          >
            <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-amber-500 text-amber-700' : ''}`} />
          </button>
        </div>

        {/* High-contrast Title */}
        <h3 className="font-bold text-base text-stone-900 dark:text-white group-hover:text-amber-800 dark:group-hover:text-amber-300 transition line-clamp-1 mb-1">
          {note.title || (isLocked ? 'Защищенная запись' : 'Новая запись в тетради')}
        </h3>

        {isLocked ? (
          <div className="py-4 my-2 flex items-center gap-3 px-3 rounded-xl bg-amber-500/10 dark:bg-stone-900/80 border border-amber-500/20 dark:border-stone-800">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                Запись защищена
              </p>
              <p className="text-[10px] text-stone-500 dark:text-stone-400">
                Нажмите для разблокировки по PIN или биометрии
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* High-contrast handwritten text snippet */}
            <p className="text-xs text-stone-900 dark:text-stone-100 line-clamp-2 leading-relaxed mb-3 font-mono font-semibold">
              {note.content || 'Пустая страница в тетрадке...'}
            </p>

            {/* Automatic smart calculations (shown whenever autoCalculate !== false and numbers/pieces exist) */}
            {hasAnyCalc && (
              hasCashflow ? (
                <div className="bg-amber-500/10 dark:bg-stone-950/80 rounded-xl p-2.5 border border-amber-900/20 dark:border-stone-800 mb-3 space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-400 font-bold">
                    <span className="flex items-center gap-1 text-[11px]">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Прибыль (доходы):</span>
                    </span>
                    <span>+{formatMoney(note.cachedIncome!, note.currency || '₽')}</span>
                  </div>
                  <div className="flex items-center justify-between text-rose-800 dark:text-rose-400 font-bold">
                    <span className="flex items-center gap-1 text-[11px]">
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>Расходы (траты):</span>
                    </span>
                    <span>−{formatMoney(note.cachedExpenses!, note.currency || '₽')}</span>
                  </div>
                  <div className="pt-1 border-t border-amber-900/20 dark:border-stone-800 flex items-center justify-between font-extrabold text-stone-950 dark:text-white">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Wallet className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Остаток в итоге:</span>
                    </span>
                    <span className={(note.cachedNetBalance || 0) >= 0 ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : 'text-rose-700 dark:text-rose-400 font-extrabold'}>
                      {formatMoney(note.cachedNetBalance || 0, note.currency || '₽')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {hasPayments && (hasMoneyCurrency || hasIncome || hasExpenses || note.category === 'payment' || note.category === 'budget') && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/80 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 text-emerald-950 dark:text-emerald-300 font-mono text-xs font-bold shadow-2xs w-fit">
                      <Calculator className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                      <span>
                        {hasIncome && !hasExpenses ? 'Доходы: ' : 'Сумма: '}
                        {formatMoney(note.cachedTotal || note.cachedExpenses || note.cachedIncome || 0, note.currency || '₽')}
                      </span>
                    </div>
                  )}
                  {hasPayments && !hasMoneyCurrency && !hasIncome && !hasExpenses && note.category !== 'payment' && note.category !== 'budget' && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-100/80 dark:bg-teal-500/20 border border-teal-300 dark:border-teal-500/30 text-teal-950 dark:text-teal-300 font-mono text-xs font-bold shadow-2xs w-fit">
                      <Calculator className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                      <span>Расчёт: = {formatMoney(note.cachedTotal || 0, '')}</span>
                    </div>
                  )}
                  {note.cachedPieces !== undefined && note.cachedPieces > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-100/90 dark:bg-sky-500/20 border border-sky-300 dark:border-sky-500/30 text-sky-950 dark:text-sky-300 font-mono text-xs font-bold shadow-2xs w-fit">
                      <Package className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
                      <span>Итого: {note.cachedPieces} шт.</span>
                    </div>
                  )}
                </div>
              )
            )}

            {/* Shopping list button indicator */}
            {isShopping && shoppingTotal > 0 && (
              <div className="mb-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenShopping(note);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100/90 hover:bg-amber-200 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 border border-amber-300 dark:border-amber-500/40 text-amber-950 dark:text-amber-300 text-xs font-semibold transition cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>
                    Куплено: {shoppingDone}/{shoppingTotal}
                  </span>
                  <ArrowRight className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                </button>

                {/* Shopping progress bar */}
                <div className="w-full bg-stone-200 dark:bg-stone-800 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 dark:bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${shoppingProgress}%` }}
                  />
                </div>
              </div>
            )}

            {isEvent && (
              <div className="flex items-center gap-1 text-[11px] text-purple-900 dark:text-purple-300 font-bold mb-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" />
                <span>{note.isEventDone ? 'Завершено' : 'Запланировано'}</span>
              </div>
            )}
          </>
        )}

        {/* Footer tags, share button and date */}
        <div className="flex items-center justify-between text-[11px] text-stone-700 dark:text-stone-300 pt-2 border-t border-amber-900/15 dark:border-stone-800/80 font-mono font-medium">
          <div className="flex items-center gap-1.5 line-clamp-1">
            {note.tags && note.tags.length > 0 ? (
              note.tags.slice(0, 3).map((tag) => {
                const formatted = tag.startsWith('#') ? tag : `#${tag}`;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={(e) => {
                      if (onTagClick) {
                        e.stopPropagation();
                        onTagClick(formatted);
                      }
                    }}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-stone-200/80 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-200 border border-stone-300/80 dark:border-stone-700 font-semibold cursor-pointer transition active:scale-95"
                    title={`Фильтровать по тегу ${formatted}`}
                  >
                    <Tag className="w-2.5 h-2.5 text-stone-500 dark:text-stone-400" />
                    <span>{formatted}</span>
                  </button>
                );
              })
            ) : (
              <span className="capitalize">{categoryConfig.label}</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onShare && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(note);
                }}
                className="p-1 rounded-md text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-800 transition active:scale-90 cursor-pointer"
                title="Поделиться заметкой"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
            <span>{dateStr}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
