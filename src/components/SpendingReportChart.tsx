import React, { useMemo, useState } from 'react';
import { Note } from '../types';
import { formatMoney } from '../utils/mathEngine';
import { normalizeTag } from '../services/aiTagging';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import {
  PieChart as PieChartIcon,
  BarChart3,
  Tag,
  Layers,
  TrendingDown,
  Receipt,
  Calendar,
} from 'lucide-react';

export type SpendingGroupBy = 'categories' | 'tags';

export interface SpendingSliceSelection {
  groupBy: SpendingGroupBy;
  key: string;
  label: string;
}

interface SpendingReportChartProps {
  notes: Note[];
  globalAutoCalculate?: boolean;
  groupBy?: SpendingGroupBy;
  onGroupByChange?: (mode: SpendingGroupBy) => void;
  activeFilterKey?: string | null;
  onSelectSlice?: (selection: SpendingSliceSelection | null) => void;
}

interface ExpenseSlice {
  key: string;
  name: string;
  value: number;
  color: string;
  percent: number;
  noteCount: number;
  isUntagged?: boolean;
}

const TAG_PALETTE = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#84cc16', // lime
  '#64748b', // slate
];

export const UNTAGGED_SLICE_KEY = '__untagged__';

export const NOTE_CATEGORY_META: Record<string, { key: string; label: string; color: string }> = {
  payment: { key: 'payment', label: 'Платежи', color: '#f43f5e' },
  budget: { key: 'budget', label: 'Бюджет', color: '#f59e0b' },
  shopping: { key: 'shopping', label: 'Покупки', color: '#10b981' },
  event: { key: 'event', label: 'События', color: '#8b5cf6' },
  calculation: { key: 'calculation', label: 'Расчёты', color: '#3b82f6' },
  note: { key: 'note', label: 'Заметки', color: '#06b6d4' },
  general: { key: 'note', label: 'Заметки', color: '#06b6d4' },
};

function isNoteInCurrentMonth(note: Note, year: number, month: number): boolean {
  if (note.eventDate) {
    const parsed = new Date(`${note.eventDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getFullYear() === year && parsed.getMonth() === month;
    }
  }
  const ts = note.updatedAt || note.createdAt;
  if (!ts) return true;
  const d = new Date(ts);
  return d.getFullYear() === year && d.getMonth() === month;
}

function getNoteExpenseAmount(note: Note): number {
  if (note.cachedExpenses && note.cachedExpenses > 0) {
    return note.cachedExpenses;
  }
  if (note.cachedTotal && note.cachedTotal > 0 && (note.cachedIncome || 0) === 0) {
    return note.cachedTotal;
  }
  return 0;
}

export const SpendingReportChart: React.FC<SpendingReportChartProps> = ({
  notes,
  globalAutoCalculate = true,
  groupBy: controlledGroupBy,
  onGroupByChange,
  activeFilterKey: controlledFilterKey,
  onSelectSlice,
}) => {
  const [internalGroupBy, setInternalGroupBy] = useState<SpendingGroupBy>('categories');
  const [internalFilterKey, setInternalFilterKey] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<'current_month' | 'all'>('current_month');
  const [chartMode, setChartMode] = useState<'bar' | 'pie'>('bar');
  const [hideUntagged, setHideUntagged] = useState<boolean>(false);

  const effectiveGroupBy = controlledGroupBy ?? internalGroupBy;
  const activeFilterKey =
    controlledFilterKey !== undefined ? controlledFilterKey : internalFilterKey;

  const handleGroupBySwitch = (nextMode: SpendingGroupBy) => {
    if (nextMode === effectiveGroupBy) return;
    if (onGroupByChange) {
      onGroupByChange(nextMode);
    } else {
      setInternalGroupBy(nextMode);
    }
    setInternalFilterKey(null);
    if (onSelectSlice) {
      onSelectSlice(null);
    }
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentMonthLabel = now.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

  // Aggregate expenses either by general note categories or by explicit user tags
  const {
    chartData,
    totalExpenseAmount,
    topSlice,
    totalPaymentNotesCount,
    customTagCount,
    hasUntaggedNotes,
  } = useMemo(() => {
    if (!globalAutoCalculate) {
      return {
        chartData: [] as ExpenseSlice[],
        totalExpenseAmount: 0,
        topSlice: null as ExpenseSlice | null,
        totalPaymentNotesCount: 0,
        customTagCount: 0,
        hasUntaggedNotes: false,
      };
    }

    const bucketMap: Record<
      string,
      { label: string; total: number; count: number; color?: string; isUntagged?: boolean }
    > = {};
    const distinctCustomTags = new Set<string>();
    let grandTotal = 0;
    let paymentNotesCount = 0;
    let untaggedFound = false;

    notes.forEach((note) => {
      if (note.isArchived) return;
      if (periodMode === 'current_month' && !isNoteInCurrentMonth(note, currentYear, currentMonth)) {
        return;
      }

      const expense = getNoteExpenseAmount(note);
      if (expense <= 0) return;

      // Always track unique custom tags present on expense notes for the switcher badge
      const uniqueUserTags = Array.from(
        new Set(
          (note.tags || [])
            .map((t) => normalizeTag(t))
            .filter((t) => t.length > 1)
        )
      );
      uniqueUserTags.forEach((t) => distinctCustomTags.add(t));

      if (effectiveGroupBy === 'categories') {
        grandTotal += expense;
        paymentNotesCount++;

        const meta = NOTE_CATEGORY_META[note.category] || NOTE_CATEGORY_META.note;
        if (!bucketMap[meta.key]) {
          bucketMap[meta.key] = {
            label: meta.label,
            total: 0,
            count: 0,
            color: meta.color,
          };
        }
        bucketMap[meta.key].total += expense;
        bucketMap[meta.key].count += 1;
      } else {
        if (uniqueUserTags.length === 0) {
          untaggedFound = true;
          if (hideUntagged) return;

          grandTotal += expense;
          paymentNotesCount++;
          if (!bucketMap[UNTAGGED_SLICE_KEY]) {
            bucketMap[UNTAGGED_SLICE_KEY] = {
              label: 'Без тега',
              total: 0,
              count: 0,
              color: '#94a3b8',
              isUntagged: true,
            };
          }
          bucketMap[UNTAGGED_SLICE_KEY].total += expense;
          bucketMap[UNTAGGED_SLICE_KEY].count += 1;
        } else {
          grandTotal += expense;
          paymentNotesCount++;
          const share = expense / uniqueUserTags.length;
          uniqueUserTags.forEach((tag) => {
            if (!bucketMap[tag]) {
              bucketMap[tag] = {
                label: tag,
                total: 0,
                count: 0,
              };
            }
            bucketMap[tag].total += share;
            bucketMap[tag].count += 1;
          });
        }
      }
    });

    // In 'tags' mode, if no custom tags exist at all in the period, show an explicit empty prompt
    if (effectiveGroupBy === 'tags' && distinctCustomTags.size === 0) {
      return {
        chartData: [] as ExpenseSlice[],
        totalExpenseAmount: 0,
        topSlice: null as ExpenseSlice | null,
        totalPaymentNotesCount: 0,
        customTagCount: 0,
        hasUntaggedNotes: untaggedFound,
      };
    }

    let paletteIndex = 0;
    const slices: ExpenseSlice[] = Object.entries(bucketMap)
      .map(([key, data]) => {
        const assignedColor = data.color || TAG_PALETTE[paletteIndex++ % TAG_PALETTE.length];
        return {
          key,
          name: data.label,
          value: Math.round(data.total),
          color: assignedColor,
          percent: grandTotal > 0 ? Math.round((data.total / grandTotal) * 100) : 0,
          noteCount: data.count,
          isUntagged: data.isUntagged,
        };
      })
      .sort((a, b) => {
        if (a.isUntagged && !b.isUntagged) return 1;
        if (!a.isUntagged && b.isUntagged) return -1;
        return b.value - a.value;
      });

    const top = slices.find((s) => !s.isUntagged) || (slices.length > 0 ? slices[0] : null);

    return {
      chartData: slices,
      totalExpenseAmount: grandTotal,
      topSlice: top,
      totalPaymentNotesCount: paymentNotesCount,
      customTagCount: distinctCustomTags.size,
      hasUntaggedNotes: untaggedFound,
    };
  }, [notes, globalAutoCalculate, periodMode, currentYear, currentMonth, effectiveGroupBy, hideUntagged]);

  const activeSliceLabel = useMemo(
    () => chartData.find((item) => item.key === activeFilterKey)?.name || activeFilterKey,
    [chartData, activeFilterKey]
  );

  const handleToggleSliceFilter = (slice: ExpenseSlice) => {
    const isSame = activeFilterKey === slice.key;
    const nextSelection: SpendingSliceSelection | null = isSame
      ? null
      : {
          groupBy: effectiveGroupBy,
          key: slice.key,
          label: slice.name,
        };
    setInternalFilterKey(nextSelection ? nextSelection.key : null);
    if (onSelectSlice) {
      onSelectSlice(nextSelection);
    }
  };

  const handleClearFilter = () => {
    setInternalFilterKey(null);
    if (onSelectSlice) {
      onSelectSlice(null);
    }
  };

  // Custom Recharts Tooltip
  const renderCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: ExpenseSlice = payload[0].payload;
      return (
        <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-md p-3 rounded-2xl border border-amber-900/15 dark:border-stone-700 shadow-xl font-mono text-xs z-50">
          <div className="flex items-center gap-2 mb-1.5 font-bold text-stone-900 dark:text-stone-100">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: data.color }}
            />
            <span>{data.name}</span>
          </div>
          <div className="space-y-1 text-stone-700 dark:text-stone-300">
            <div className="flex justify-between gap-4">
              <span className="text-stone-500 dark:text-stone-400">Сумма расходов:</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">
                {formatMoney(data.value, '₽')}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-stone-500 dark:text-stone-400">Доля трат:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {data.percent}%
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-stone-500 dark:text-stone-400">Количество счетов:</span>
              <span className="font-semibold">{data.noteCount} шт.</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 rounded-3xl p-4 sm:p-5 mb-5 shadow-sm transition-colors">
      {/* Header, Grouping Switcher, Period Switcher & Chart Type Controls */}
      <div className="flex flex-col gap-3 mb-4 pb-3 border-b border-amber-900/10 dark:border-stone-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400">
                {effectiveGroupBy === 'tags' ? (
                  <Tag className="w-5 h-5" />
                ) : (
                  <PieChartIcon className="w-5 h-5" />
                )}
              </span>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white tracking-tight">
                {effectiveGroupBy === 'tags' ? 'Расходы по тегам' : 'Расходы по категориям'}
              </h3>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-400/30 capitalize inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{periodMode === 'current_month' ? currentMonthLabel : 'Все активные'}</span>
              </span>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {effectiveGroupBy === 'tags'
                ? `Детализация трат по пользовательским тегам заметок за ${
                    periodMode === 'current_month' ? `текущий месяц (${currentMonthLabel})` : 'весь активный период'
                  }`
                : `Распределение трат по общим категориям заметок за ${
                    periodMode === 'current_month' ? `текущий месяц (${currentMonthLabel})` : 'весь активный период'
                  }`}
            </p>
          </div>

          {topSlice && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-50 dark:bg-stone-950 border border-amber-200 dark:border-stone-800 self-start sm:self-auto shrink-0">
              <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <div className="text-xs font-mono">
                <span className="text-stone-500 dark:text-stone-400 text-[10px] block">
                  {effectiveGroupBy === 'tags' ? 'Топ тег:' : 'Топ категория:'}
                </span>
                <span className="font-bold text-stone-900 dark:text-white">
                  {topSlice.name} ({topSlice.percent}%)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Grouping (Categories vs Custom Tags), Period & Chart Mode Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Grouping Switcher: General Categories vs Custom Note Tags */}
            <div
              role="group"
              aria-label="Группировка графика расходов"
              className="inline-flex items-center gap-1 p-1 rounded-xl bg-amber-100/70 dark:bg-stone-800 border border-amber-300/60 dark:border-stone-700"
            >
              <button
                type="button"
                onClick={() => handleGroupBySwitch('categories')}
                aria-pressed={effectiveGroupBy === 'categories'}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                  effectiveGroupBy === 'categories'
                    ? 'bg-white dark:bg-stone-950 text-stone-950 dark:text-white shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>По категориям</span>
              </button>
              <button
                type="button"
                onClick={() => handleGroupBySwitch('tags')}
                aria-pressed={effectiveGroupBy === 'tags'}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                  effectiveGroupBy === 'tags'
                    ? 'bg-white dark:bg-stone-950 text-stone-950 dark:text-white shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>По тегам</span>
                {customTagCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-300 font-mono text-[10px]">
                    {customTagCount}
                  </span>
                )}
              </button>
            </div>

            {/* Period Switcher */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700">
              <button
                type="button"
                onClick={() => setPeriodMode('current_month')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  periodMode === 'current_month'
                    ? 'bg-white dark:bg-stone-950 text-stone-950 dark:text-white shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Текущий месяц
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  periodMode === 'all'
                    ? 'bg-white dark:bg-stone-950 text-stone-950 dark:text-white shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Все активные
              </button>
            </div>
          </div>

          {/* Chart Visualization Mode */}
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1 ${
                chartMode === 'bar'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Столбцы</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('pie')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1 ${
                chartMode === 'pie'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              <span>Круговая</span>
            </button>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="text-center py-9 px-4 bg-stone-50/50 dark:bg-stone-950/40 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 space-y-2.5">
          {effectiveGroupBy === 'tags' && globalAutoCalculate ? (
            <Tag className="w-10 h-10 text-amber-500 mx-auto opacity-70" />
          ) : (
            <Receipt className="w-10 h-10 text-stone-400 mx-auto opacity-60" />
          )}
          <div>
            <h4 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">
              {!globalAutoCalculate
                ? 'Автоматический расчёт отключён'
                : effectiveGroupBy === 'tags'
                ? periodMode === 'current_month'
                  ? `Нет расходов с пользовательскими тегами за ${currentMonthLabel}`
                  : 'У заметок с расходами пока нет пользовательских тегов'
                : periodMode === 'current_month'
                ? `Нет расходов за ${currentMonthLabel}`
                : 'Пока нет расходов для построения диаграммы'}
            </h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {!globalAutoCalculate
                ? 'Включите глобальный переключатель «Автоматический расчёт» выше или в настройках, чтобы видеть графики и суммы по всем заметкам.'
                : effectiveGroupBy === 'tags'
                ? 'Откройте любую финансовую заметку и добавьте пользовательские теги (например, #еда, #транспорт, #дом) через кнопку управления тегами.'
                : 'Добавьте финансовые заметки с суммами, чтобы увидеть распределение расходов по категориям.'}
            </p>
          </div>
          {globalAutoCalculate && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {effectiveGroupBy === 'tags' && (
                <button
                  type="button"
                  onClick={() => handleGroupBySwitch('categories')}
                  className="px-3 py-1.5 rounded-xl bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold transition cursor-pointer"
                >
                  Показать по категориям
                </button>
              )}
              {periodMode === 'current_month' && (
                <button
                  type="button"
                  onClick={() => setPeriodMode('all')}
                  className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-amber-900 dark:text-amber-300 text-xs font-bold transition cursor-pointer"
                >
                  Показать за все активные заметки
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-stone-950/60 border border-rose-200/60 dark:border-stone-800/80">
              <span className="text-[11px] text-stone-600 dark:text-stone-400 block mb-0.5">
                {periodMode === 'current_month' ? 'Траты за месяц:' : 'Всего расходов:'}
              </span>
              <span className="text-base sm:text-lg font-bold text-rose-700 dark:text-rose-400 font-mono">
                {formatMoney(totalExpenseAmount, '₽')}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-stone-950/60 border border-blue-200/60 dark:border-stone-800/80">
              <span className="text-[11px] text-stone-600 dark:text-stone-400 block mb-0.5">
                {effectiveGroupBy === 'tags' ? 'Пользовательских тегов:' : 'Категорий:'}
              </span>
              <span className="text-base sm:text-lg font-bold text-blue-700 dark:text-blue-400 font-mono">
                {effectiveGroupBy === 'tags' ? customTagCount : chartData.length}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-stone-950/60 border border-emerald-200/60 dark:border-stone-800/80 col-span-2 sm:col-span-1">
              <span className="text-[11px] text-stone-600 dark:text-stone-400 block mb-0.5">Заметок с тратами:</span>
              <span className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                {totalPaymentNotesCount} шт.
              </span>
            </div>
          </div>

          {/* Interactive Recharts Chart (BarChart or PieChart) */}
          <div className="h-64 sm:h-72 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'bar' ? (
                <BarChart
                  data={chartData.slice(0, 10)}
                  margin={{ top: 12, right: 12, left: -8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(168, 162, 158, 0.22)" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(168, 162, 158, 0.3)' }}
                    tick={{ fill: '#78716c', fontSize: 11, fontFamily: 'monospace' }}
                    interval={0}
                    angle={chartData.length > 4 ? -18 : 0}
                    textAnchor={chartData.length > 4 ? 'end' : 'middle'}
                    height={chartData.length > 4 ? 48 : 28}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(168, 162, 158, 0.3)' }}
                    tick={{ fill: '#78716c', fontSize: 10, fontFamily: 'monospace' }}
                    tickFormatter={(val: number) =>
                      Math.abs(val) >= 1000 ? `${Math.round(val / 1000)}k` : `${val}`
                    }
                  />
                  <Tooltip content={renderCustomTooltip} cursor={{ fill: 'rgba(245, 158, 11, 0.08)' }} />
                  <Bar
                    dataKey="value"
                    name="Расходы"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={44}
                    onClick={(data: any) => {
                      const slice: ExpenseSlice | undefined = data?.payload || data;
                      if (slice?.key) handleToggleSliceFilter(slice);
                    }}
                    className="cursor-pointer"
                  >
                    {chartData.slice(0, 10).map((entry) => (
                      <Cell
                        key={`bar-cell-${entry.key}`}
                        fill={entry.color}
                        fillOpacity={activeFilterKey && activeFilterKey !== entry.key ? 0.35 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: any) =>
                      percent > 0.08 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''
                    }
                    labelLine={false}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={`cell-${entry.key}`}
                        fill={entry.color}
                        fillOpacity={activeFilterKey && activeFilterKey !== entry.key ? 0.35 : 1}
                        stroke="rgba(0,0,0,0.1)"
                        strokeWidth={1}
                        className="cursor-pointer transition-transform hover:opacity-85"
                        onClick={() => handleToggleSliceFilter(entry)}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={renderCustomTooltip} />
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-xs font-mono text-stone-800 dark:text-stone-200 font-semibold">
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Breakdown Grid */}
          <div className="pt-3 border-t border-amber-900/10 dark:border-stone-800">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                {effectiveGroupBy === 'tags' ? (
                  <Tag className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>
                  {effectiveGroupBy === 'tags'
                    ? 'Детализация расходов по пользовательским тегам:'
                    : 'Детализация расходов по категориям:'}
                </span>
              </span>

              <div className="flex items-center gap-3">
                {effectiveGroupBy === 'tags' && hasUntaggedNotes && (
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-stone-600 dark:text-stone-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hideUntagged}
                      onChange={(e) => {
                        setHideUntagged(e.target.checked);
                        if (e.target.checked && activeFilterKey === UNTAGGED_SLICE_KEY) {
                          handleClearFilter();
                        }
                      }}
                      className="rounded text-amber-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Скрыть «Без тега»</span>
                  </label>
                )}

                {activeFilterKey && (
                  <button
                    type="button"
                    onClick={handleClearFilter}
                    className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-bold cursor-pointer"
                  >
                    Сбросить фильтр ({activeSliceLabel})
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {chartData
                .filter((item) => (activeFilterKey ? item.key === activeFilterKey : true))
                .map((slice) => (
                  <button
                    type="button"
                    key={slice.key}
                    onClick={() => handleToggleSliceFilter(slice)}
                    className={`w-full text-left flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                      activeFilterKey === slice.key
                        ? 'bg-amber-100/70 dark:bg-stone-800 border-amber-400 dark:border-stone-600 shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-950/70 hover:bg-stone-100 dark:hover:bg-stone-800/60 border-stone-200 dark:border-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="font-mono text-xs font-bold text-stone-900 dark:text-white truncate">
                        {slice.name}
                      </span>
                      <span className="text-[10px] text-stone-500 font-mono shrink-0">
                        ({slice.noteCount} сч.)
                      </span>
                    </div>

                    <div className="text-right font-mono shrink-0 ml-2">
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-400 block">
                        {formatMoney(slice.value, '₽')}
                      </span>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block">
                        {slice.percent}% трат
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
