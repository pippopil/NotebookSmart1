import React, { useState, useMemo } from 'react';
import { Note, ArchivedBudgetMonth, ArchivedShoppingTrip } from '../types';
import { formatMoney, analyzeNote } from '../utils/mathEngine';
import { extractShoppingItems } from '../utils/shoppingParser';
import { MonthlyExpenseChart } from './MonthlyExpenseChart';
import {
  Archive,
  Calendar,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Wallet,
  CheckCircle2,
  Share2,
  RotateCcw,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  ArrowRight,
  PackageCheck,
  Percent,
} from 'lucide-react';

interface ArchiveViewProps {
  notes: Note[];
  archivedBudgets: ArchivedBudgetMonth[];
  archivedShopping: ArchivedShoppingTrip[];
  onSaveArchivedBudgets: (budgets: ArchivedBudgetMonth[]) => void;
  onSaveArchivedShopping: (trips: ArchivedShoppingTrip[]) => void;
  onRestoreNote: (note: Note) => void;
  onCloseCurrentMonth: (monthName: string, selectedNoteIds: string[], comment?: string) => void;
  onArchiveCompletedShoppingNotes: () => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  notes,
  archivedBudgets,
  archivedShopping,
  onSaveArchivedBudgets,
  onSaveArchivedShopping,
  onRestoreNote,
  onCloseCurrentMonth,
  onArchiveCompletedShoppingNotes,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'budgets' | 'shopping'>('budgets');
  const [expandedBudgetId, setExpandedBudgetId] = useState<string | null>(null);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [showCloseMonthModal, setShowCloseMonthModal] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  // New month closing form state
  const currentMonthDefaultName = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  }, []);

  const [closeMonthName, setCloseMonthName] = useState(
    currentMonthDefaultName.charAt(0).toUpperCase() + currentMonthDefaultName.slice(1)
  );
  const [closeMonthComment, setCloseMonthComment] = useState('');

  // Eligible active payment / budget notes that can be closed
  const activeBudgetNotes = useMemo(() => {
    return notes.filter((n) => !n.isArchived && ((n.cachedTotal || 0) > 0 || n.category === 'payment'));
  }, [notes]);

  const [selectedBudgetNoteIds, setSelectedBudgetNoteIds] = useState<string[]>(() =>
    activeBudgetNotes.map((n) => n.id)
  );

  // Fully completed active shopping notes eligible for archive
  const completedActiveShoppingNotes = useMemo(() => {
    return notes.filter((n) => {
      if (n.isArchived) return false;
      const items = extractShoppingItems(n.content);
      return items.length > 0 && items.every((i) => i.isCompleted);
    });
  }, [notes]);

  // Overall financial statistics from closed months
  const allTimeStats = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalBalance = 0;

    archivedBudgets.forEach((b) => {
      totalIncome += b.totalIncome;
      totalExpenses += b.totalExpenses;
      totalBalance += b.netBalance;
    });

    const avgMonthlySavings =
      archivedBudgets.length > 0 ? Math.round(totalBalance / archivedBudgets.length) : 0;

    const overallSavingsRate =
      totalIncome > 0 ? Math.round((totalBalance / totalIncome) * 100) : 0;

    return {
      totalIncome,
      totalExpenses,
      totalBalance,
      avgMonthlySavings,
      overallSavingsRate,
      count: archivedBudgets.length,
    };
  }, [archivedBudgets]);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  };

  // Share archived budget report
  const handleShareBudget = async (b: ArchivedBudgetMonth) => {
    triggerHaptic();
    const text = `📊 Финансовый отчет: ${b.monthName}\n` +
      `📈 Доходы (Прибыль): ${formatMoney(b.totalIncome, b.currency)}\n` +
      `📉 Расходы: ${formatMoney(b.totalExpenses, b.currency)}\n` +
      `💰 Чистый остаток: ${formatMoney(b.netBalance, b.currency)}\n` +
      `🏆 Норма сбережений: ${b.totalIncome > 0 ? Math.round((b.netBalance / b.totalIncome) * 100) : 0}%\n` +
      (b.summaryComment ? `\nЗаметка: ${b.summaryComment}\n` : '') +
      `\nСохранено в NotebookSmart 📓`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Отчет за ${b.monthName}`, text });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedNotice(`Отчет за ${b.monthName} скопирован!`);
      setTimeout(() => setCopiedNotice(null), 2500);
    }
  };

  // Restore snapshot notes to active notebook
  const handleRestoreBudgetSnapshot = (b: ArchivedBudgetMonth) => {
    triggerHaptic();
    if (
      !window.confirm(
        `Восстановить заметки бюджета за ${b.monthName} в активную тетрадь?`
      )
    ) {
      return;
    }

    b.notesSnapshot.forEach((snap) => {
      const restoredNote: Note = {
        id: `restored-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: snap.title || `Бюджет (${b.monthName})`,
        content: snap.content,
        category: 'payment',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        paperStyle: 'grid',
        isPinned: false,
        tags: ['Архив', b.monthName],
      };
      onRestoreNote(restoredNote);
    });

    setCopiedNotice(`Заметки за ${b.monthName} возвращены в активную тетрадь!`);
    setTimeout(() => setCopiedNotice(null), 2500);
  };

  // Delete budget archive entry
  const handleDeleteBudget = (id: string, monthName: string) => {
    triggerHaptic();
    if (window.confirm(`Удалить архивный отчет за ${monthName}?`)) {
      onSaveArchivedBudgets(archivedBudgets.filter((b) => b.id !== id));
    }
  };

  // Re-order or re-create shopping trip as a new active shopping list
  const handleRepeatShoppingTrip = (trip: ArchivedShoppingTrip) => {
    triggerHaptic();
    const contentLines = trip.items.map((i) => `- [ ] ${i.name}`);
    const newNote: Note = {
      id: `shopping-repeat-${Date.now()}`,
      title: `Повтор: ${trip.title.replace(/^🛒\s*/, '')}`,
      content: `Список продуктов (повтор из архива):\n${contentLines.join('\n')}`,
      category: 'shopping',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      paperStyle: 'grid',
      isPinned: false,
      tags: ['Покупки', 'Из архива'],
    };

    onRestoreNote(newNote);
    setCopiedNotice(`Создан новый активный список покупок по шаблону «${trip.title}»!`);
    setTimeout(() => setCopiedNotice(null), 2500);
  };

  // Delete shopping trip
  const handleDeleteShoppingTrip = (id: string) => {
    triggerHaptic();
    if (window.confirm('Удалить эту запись из архива покупок?')) {
      onSaveArchivedShopping(archivedShopping.filter((t) => t.id !== id));
    }
  };

  // Confirm close month
  const handleConfirmCloseMonth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeMonthName.trim()) return;

    onCloseCurrentMonth(closeMonthName.trim(), selectedBudgetNoteIds, closeMonthComment.trim());
    setShowCloseMonthModal(false);
    setCloseMonthComment('');
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-28 text-stone-900 dark:text-stone-100">
      {/* Toast Notice */}
      {copiedNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 px-4 py-2 rounded-2xl shadow-xl text-xs font-bold animate-in fade-in slide-in-from-top-3 flex items-center gap-2">
          <span>✓</span>
          <span>{copiedNotice}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 rounded-3xl p-4 sm:p-5 mb-5 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Archive className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-stone-900 dark:text-white tracking-tight">
                Архив прошлых периодов
              </h2>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Закрытые месяцы бюджета, чистая прибыль, история трат и завершенные покупки
            </p>
          </div>

          {activeSubTab === 'budgets' ? (
            <button
              onClick={() => {
                triggerHaptic();
                setSelectedBudgetNoteIds(activeBudgetNotes.map((n) => n.id));
                setShowCloseMonthModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs transition active:scale-95 shrink-0 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Закрыть и архивировать месяц</span>
            </button>
          ) : (
            completedActiveShoppingNotes.length > 0 && (
              <button
                onClick={() => {
                  triggerHaptic();
                  onArchiveCompletedShoppingNotes();
                  setCopiedNotice('Все завершенные покупки перенесены в архив!');
                  setTimeout(() => setCopiedNotice(null), 2500);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition active:scale-95 shrink-0 cursor-pointer self-start sm:self-auto"
              >
                <PackageCheck className="w-4 h-4" />
                <span>Архивировать завершенные ({completedActiveShoppingNotes.length})</span>
              </button>
            )
          )}
        </div>

        {/* Subtabs Switcher */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-amber-900/10 dark:border-stone-800">
          <button
            onClick={() => {
              triggerHaptic();
              setActiveSubTab('budgets');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'budgets'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Закрытые месяцы бюджета ({archivedBudgets.length})</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              setActiveSubTab('shopping');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'shopping'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Завершенные покупки ({archivedShopping.length})</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: ARCHIVED BUDGET MONTHS */}
      {activeSubTab === 'budgets' && (
        <div className="space-y-4">
          {/* Graphical visualization of monthly expenses using recharts */}
          <MonthlyExpenseChart
            archivedBudgets={archivedBudgets}
            activeNotes={notes}
            selectedMonthId={expandedBudgetId}
            onSelectMonth={(id) => setExpandedBudgetId(id)}
          />

          {/* All-time archive statistics card */}
          {archivedBudgets.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block">
                  Всего накоплено
                </span>
                <span className="text-base font-extrabold text-emerald-900 dark:text-emerald-200 font-mono">
                  {formatMoney(allTimeStats.totalBalance, 'руб')}
                </span>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider block">
                  В среднем в месяц
                </span>
                <span className="text-base font-extrabold text-amber-900 dark:text-amber-200 font-mono">
                  {formatMoney(allTimeStats.avgMonthlySavings, 'руб')}
                </span>
              </div>

              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wider block">
                  Всего расходов
                </span>
                <span className="text-base font-extrabold text-rose-900 dark:text-rose-200 font-mono">
                  {formatMoney(allTimeStats.totalExpenses, 'руб')}
                </span>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider block">
                  Норма сбережений
                </span>
                <span className="text-base font-extrabold text-blue-900 dark:text-blue-200 font-mono">
                  {allTimeStats.overallSavingsRate}%
                </span>
              </div>
            </div>
          )}

          {/* List of Archived Months */}
          {archivedBudgets.length === 0 ? (
            <div className="text-center py-14 px-4 bg-white dark:bg-stone-900/60 rounded-3xl border border-amber-900/10 dark:border-stone-800">
              <Archive className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-2" />
              <h4 className="font-bold text-stone-900 dark:text-white text-base mb-1">
                Архив месяцев пока пуст
              </h4>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto mb-4">
                Когда месяц заканчивается, нажмите «Закрыть и архивировать месяц». Итоговые цифры сохранятся в историю, а в тетрадке освободится место для новых записей.
              </p>
              <button
                onClick={() => setShowCloseMonthModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Закрыть текущий период</span>
              </button>
            </div>
          ) : (
            archivedBudgets.map((b) => {
              const isExpanded = expandedBudgetId === b.id;
              const savingsRate =
                b.totalIncome > 0 ? Math.round((b.netBalance / b.totalIncome) * 100) : 0;

              return (
                <div
                  key={b.id}
                  className={`bg-white dark:bg-stone-900 border rounded-3xl p-4 sm:p-5 shadow-xs transition ${
                    isExpanded
                      ? 'border-amber-500 ring-2 ring-amber-500/25 shadow-md'
                      : 'border-amber-900/10 dark:border-stone-800 hover:border-amber-500/40'
                  }`}
                >
                  {/* Top line: Month name, date closed, actions */}
                  <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-amber-900/10 dark:border-stone-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-stone-900 dark:text-white">
                          {b.monthName}
                        </h3>
                        <span className="text-[11px] text-stone-500 dark:text-stone-400">
                          Закрыт: {new Date(b.closedAt).toLocaleDateString('ru-RU')} • Записей: {b.notesCount}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleShareBudget(b)}
                        className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 transition cursor-pointer"
                        title="Поделиться отчетом за месяц"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRestoreBudgetSnapshot(b)}
                        className="p-2 rounded-xl bg-stone-100 hover:bg-amber-100 dark:bg-stone-800 dark:hover:bg-amber-950/40 text-stone-700 dark:text-stone-300 hover:text-amber-700 transition cursor-pointer"
                        title="Восстановить в активную тетрадь"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBudget(b.id, b.monthName)}
                        className="p-2 rounded-xl bg-stone-100 hover:bg-rose-100 dark:bg-stone-800 dark:hover:bg-rose-950/40 text-stone-500 hover:text-rose-600 transition cursor-pointer"
                        title="Удалить из архива"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 3-Column Financial Breakdown */}
                  <div className="grid grid-cols-3 gap-2 py-2 mb-3 bg-stone-50/80 dark:bg-stone-950/60 rounded-2xl p-3 border border-stone-200/60 dark:border-stone-800">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block uppercase">
                        Прибыль (доходы)
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-emerald-800 dark:text-emerald-300 font-mono">
                        +{formatMoney(b.totalIncome, b.currency)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block uppercase">
                        Все расходы
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-rose-800 dark:text-rose-300 font-mono">
                        -{formatMoney(b.totalExpenses, b.currency)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block uppercase">
                        Остаток (итог)
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-amber-800 dark:text-amber-300 font-mono">
                        {formatMoney(b.netBalance, b.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Optional user comment */}
                  {b.summaryComment && (
                    <p className="text-xs text-stone-600 dark:text-stone-300 italic mb-3 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                      «{b.summaryComment}»
                    </p>
                  )}

                  {/* Expand / Collapse Snapshot Notes */}
                  <button
                    onClick={() => {
                      triggerHaptic();
                      setExpandedBudgetId(isExpanded ? null : b.id);
                    }}
                    className="w-full flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 pt-2 transition cursor-pointer"
                  >
                    <span>
                      {isExpanded ? 'Скрыть детализацию записей' : `Показать сохраненные записи (${b.notesSnapshot.length})`}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-amber-900/10 dark:border-stone-800 space-y-2 animate-in fade-in">
                      {b.notesSnapshot.map((snap, i) => (
                        <div
                          key={snap.id || i}
                          className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold text-stone-900 dark:text-white mb-1.5">
                            <span className="truncate">{snap.title || 'Запись без названия'}</span>
                            <span className="font-mono text-emerald-700 dark:text-emerald-400 shrink-0">
                              Остаток: {formatMoney(snap.balance, b.currency)}
                            </span>
                          </div>
                          <pre className="font-mono text-[11px] text-stone-700 dark:text-stone-300 whitespace-pre-wrap line-clamp-4 bg-white/70 dark:bg-stone-900/70 p-2 rounded-xl">
                            {snap.content}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SUBTAB 2: COMPLETED SHOPPING TRIPS ARCHIVE */}
      {activeSubTab === 'shopping' && (
        <div className="space-y-4">
          {archivedShopping.length === 0 ? (
            <div className="text-center py-14 px-4 bg-white dark:bg-stone-900/60 rounded-3xl border border-amber-900/10 dark:border-stone-800">
              <ShoppingCart className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-2" />
              <h4 className="font-bold text-stone-900 dark:text-white text-base mb-1">
                Архив покупок пока пуст
              </h4>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto mb-3">
                Когда вы завершаете покупки в тетради (ставите все галочки), их можно отправить в архив, чтобы не загромождать активный список.
              </p>
            </div>
          ) : (
            archivedShopping.map((trip) => {
              const isExpanded = expandedTripId === trip.id;
              return (
                <div
                  key={trip.id}
                  className="bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 rounded-3xl p-4 sm:p-5 shadow-xs transition hover:border-emerald-500/40"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-stone-900 dark:text-white">
                          {trip.title}
                        </h3>
                        <span className="text-[11px] text-stone-500 dark:text-stone-400">
                          {trip.monthName} • {trip.itemsCount} купленных товаров
                          {trip.totalSpent ? ` • Итого: ${formatMoney(trip.totalSpent, trip.currency)}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRepeatShoppingTrip(trip)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700 text-xs font-bold transition cursor-pointer"
                        title="Создать новый активный список с этими же товарами"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Повторить</span>
                      </button>
                      <button
                        onClick={() => handleDeleteShoppingTrip(trip.id)}
                        className="p-1.5 rounded-xl bg-stone-100 hover:bg-rose-100 dark:bg-stone-800 text-stone-500 hover:text-rose-600 transition cursor-pointer"
                        title="Удалить из архива"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Checklist preview */}
                  <div className="bg-stone-50/80 dark:bg-stone-950/60 p-3 rounded-2xl border border-stone-200/60 dark:border-stone-800 mt-3">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200 dark:border-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300">
                      <span>Список приобретенных товаров:</span>
                      <button
                        onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
                        className="text-stone-500 hover:text-stone-800 dark:hover:text-white flex items-center gap-1"
                      >
                        <span>{isExpanded ? 'Свернуть' : 'Развернуть все'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="space-y-1.5 text-xs text-stone-700 dark:text-stone-300">
                      {(isExpanded ? trip.items : trip.items.slice(0, 4)).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-600">✓</span>
                            <span className="line-through text-stone-500 dark:text-stone-400">
                              {item.name}
                            </span>
                          </div>
                          {item.estimatedPrice && (
                            <span className="font-mono text-stone-500 text-[11px]">
                              {formatMoney(item.estimatedPrice, trip.currency)}
                            </span>
                          )}
                        </div>
                      ))}
                      {!isExpanded && trip.items.length > 4 && (
                        <span className="text-[11px] text-stone-400 italic block pt-1">
                          + еще {trip.items.length - 4} товаров...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL: CLOSE & ARCHIVE CURRENT MONTH */}
      {showCloseMonthModal && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/60 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 transition-all"
          onClick={() => setShowCloseMonthModal(false)}
        >
          <div
            className="w-full max-w-md bg-[#fffdfa] dark:bg-stone-900 border border-amber-900/20 dark:border-stone-700 rounded-3xl p-5 shadow-2xl text-stone-900 dark:text-stone-100 space-y-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-amber-900/10 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-xl bg-amber-500/15 text-amber-600">
                  <Archive className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-sm text-stone-900 dark:text-white">
                  Закрыть и архивировать месяц
                </h3>
              </div>
              <button
                onClick={() => setShowCloseMonthModal(false)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmCloseMonth} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Название периода:
                </label>
                <input
                  type="text"
                  value={closeMonthName}
                  onChange={(e) => setCloseMonthName(e.target.value)}
                  placeholder="Октябрь 2026"
                  required
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-3.5 py-2 text-xs text-stone-900 dark:text-white focus:outline-none focus:border-amber-500 font-semibold"
                />
              </div>

              {/* Notes to include */}
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Записи для включения в отчет:
                </label>
                {activeBudgetNotes.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">
                    Нет активных записей с расчетами доходов или расходов.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-stone-200 dark:border-stone-800 rounded-xl p-2 bg-stone-50 dark:bg-stone-950">
                    {activeBudgetNotes.map((n) => {
                      const isChecked = selectedBudgetNoteIds.includes(n.id);
                      return (
                        <label
                          key={n.id}
                          className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-stone-200/50 dark:hover:bg-stone-900 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBudgetNoteIds([...selectedBudgetNoteIds, n.id]);
                              } else {
                                setSelectedBudgetNoteIds(selectedBudgetNoteIds.filter((id) => id !== n.id));
                              }
                            }}
                            className="rounded text-amber-600 focus:ring-0"
                          />
                          <span className="font-medium truncate flex-1">{n.title || 'Без названия'}</span>
                          <span className="font-mono text-[11px] text-stone-500">
                            {formatMoney(n.cachedNetBalance || n.cachedTotal || 0, n.currency)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Комментарий или итог месяца (необязательно):
                </label>
                <textarea
                  value={closeMonthComment}
                  onChange={(e) => setCloseMonthComment(e.target.value)}
                  placeholder="Выполнили цель по сбережениям, закрыли страховку..."
                  rows={2}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl p-2.5 text-xs text-stone-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-amber-900/10 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowCloseMonthModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-stone-500 hover:text-stone-800 dark:text-stone-400"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition"
                >
                  Закрыть и зафиксировать месяц
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
