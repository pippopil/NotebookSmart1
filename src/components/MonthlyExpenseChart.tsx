import React, { useMemo, useState } from 'react';
import { ArchivedBudgetMonth, Note } from '../types';
import { formatMoney } from '../utils/mathEngine';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  TrendingDown,
  TrendingUp,
  BarChart3,
  Calendar,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Layers,
  Info,
} from 'lucide-react';

interface MonthlyExpenseChartProps {
  archivedBudgets: ArchivedBudgetMonth[];
  activeNotes?: Note[];
  selectedMonthId?: string | null;
  onSelectMonth?: (monthId: string | null) => void;
}

interface MonthlyChartItem {
  id: string;
  monthName: string;
  shortName: string;
  expenses: number;
  income: number;
  netBalance: number;
  savingsRate: number;
  notesCount: number;
  currency: string;
  comment?: string;
  isCurrent?: boolean;
  diffAmount: number | null;
  diffPercent: number | null;
}

export const MonthlyExpenseChart: React.FC<MonthlyExpenseChartProps> = ({
  archivedBudgets,
  activeNotes = [],
  selectedMonthId,
  onSelectMonth,
}) => {
  const [viewMode, setViewMode] = useState<'expenses' | 'comparison'>('expenses');
  const [showAverageLine, setShowAverageLine] = useState(true);
  const [includeCurrentMonth, setIncludeCurrentMonth] = useState(false);

  // Shorten Russian month name (e.g. "Сентябрь 2026" -> "Сен 26")
  const formatShortMonth = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      const monthPart = parts[0].slice(0, 3);
      const yearPart = parts[1].slice(-2);
      return `${monthPart.charAt(0).toUpperCase() + monthPart.slice(1)} '${yearPart}`;
    }
    return fullName.slice(0, 5);
  };

  // Calculate current ongoing month totals from active notes
  const currentMonthData = useMemo(() => {
    let income = 0;
    let expenses = 0;
    let count = 0;

    activeNotes.forEach((n) => {
      if (n.isArchived) return;
      if (n.cachedIncome && n.cachedIncome > 0) income += n.cachedIncome;
      if (n.cachedExpenses && n.cachedExpenses > 0) expenses += n.cachedExpenses;
      else if (n.cachedTotal && n.cachedTotal > 0) expenses += n.cachedTotal;
      if (n.cachedIncome || n.cachedExpenses || n.cachedTotal) count++;
    });

    const now = new Date();
    const currentName =
      now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) + ' (сейчас)';

    return {
      income,
      expenses,
      balance: income - expenses,
      count,
      name: currentName,
    };
  }, [activeNotes]);

  // Prepare chronological chart data (oldest to newest)
  const { chartData, averageExpenses, minExpenseMonth, maxExpenseMonth, latestTrend } =
    useMemo<{
      chartData: MonthlyChartItem[];
      averageExpenses: number;
      minExpenseMonth: MonthlyChartItem | null;
      maxExpenseMonth: MonthlyChartItem | null;
      latestTrend: { diff: number; percent: number; isSavings: boolean } | null;
    }>(() => {
      // Sort archived budgets chronologically (ascending by closedAt)
      const sorted = [...archivedBudgets].sort((a, b) => a.closedAt - b.closedAt);

      const items: MonthlyChartItem[] = [];

      sorted.forEach((b, idx) => {
        const prev = idx > 0 ? items[idx - 1] : null;
        let diffAmount: number | null = null;
        let diffPercent: number | null = null;

        if (prev) {
          diffAmount = b.totalExpenses - prev.expenses;
          if (prev.expenses > 0) {
            diffPercent = Math.round((diffAmount / prev.expenses) * 100);
          }
        }

        const savingsRate =
          b.totalIncome > 0 ? Math.round((b.netBalance / b.totalIncome) * 100) : 0;

        items.push({
          id: b.id,
          monthName: b.monthName,
          shortName: formatShortMonth(b.monthName),
          expenses: b.totalExpenses,
          income: b.totalIncome,
          netBalance: b.netBalance,
          savingsRate,
          notesCount: b.notesCount,
          currency: b.currency || 'руб',
          comment: b.summaryComment,
          isCurrent: false,
          diffAmount,
          diffPercent,
        });
      });

      // Optionally append current month in progress
      if (includeCurrentMonth && (currentMonthData.expenses > 0 || currentMonthData.income > 0)) {
        const prev = items.length > 0 ? items[items.length - 1] : null;
        let diffAmount: number | null = null;
        let diffPercent: number | null = null;

        if (prev) {
          diffAmount = currentMonthData.expenses - prev.expenses;
          if (prev.expenses > 0) {
            diffPercent = Math.round((diffAmount / prev.expenses) * 100);
          }
        }

        const savingsRate =
          currentMonthData.income > 0
            ? Math.round((currentMonthData.balance / currentMonthData.income) * 100)
            : 0;

        items.push({
          id: 'current-month-draft',
          monthName: currentMonthData.name,
          shortName: 'Сейчас',
          expenses: currentMonthData.expenses,
          income: currentMonthData.income,
          netBalance: currentMonthData.balance,
          savingsRate,
          notesCount: currentMonthData.count,
          currency: 'руб',
          comment: 'Текущий месяц в процессе накопления',
          isCurrent: true,
          diffAmount,
          diffPercent,
        });
      }

      // Calculations for KPI insights
      const closedItems = items.filter((i) => !i.isCurrent);
      const targetItems = closedItems.length > 0 ? closedItems : items;

      let totalExpensesSum = 0;
      let minMonth: MonthlyChartItem | null = null;
      let maxMonth: MonthlyChartItem | null = null;

      targetItems.forEach((item) => {
        totalExpensesSum += item.expenses;
        if (!minMonth || item.expenses < minMonth.expenses) minMonth = item;
        if (!maxMonth || item.expenses > maxMonth.expenses) maxMonth = item;
      });

      const avg = targetItems.length > 0 ? Math.round(totalExpensesSum / targetItems.length) : 0;

      // Latest month dynamics
      let trend: { diff: number; percent: number; isSavings: boolean } | null = null;
      if (items.length >= 2) {
        const latest = items[items.length - 1];
        if (latest.diffAmount !== null && latest.diffPercent !== null) {
          trend = {
            diff: latest.diffAmount,
            percent: latest.diffPercent,
            isSavings: latest.diffAmount <= 0,
          };
        }
      }

      return {
        chartData: items,
        averageExpenses: avg,
        minExpenseMonth: minMonth,
        maxExpenseMonth: maxMonth,
        latestTrend: trend,
      };
    }, [archivedBudgets, includeCurrentMonth, currentMonthData]);

  // Interactive custom tooltip
  const renderCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: MonthlyChartItem = payload[0].payload;
      return (
        <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-amber-900/15 dark:border-stone-700 shadow-xl font-mono text-xs z-50 min-w-[210px] space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-stone-200 dark:border-stone-800">
            <span className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5 font-sans">
              <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{data.monthName}</span>
            </span>
            {data.isCurrent && (
              <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-md font-semibold">
                В процессе
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-stone-700 dark:text-stone-300">
            <div className="flex justify-between items-center">
              <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Расходы:</span>
              </span>
              <span className="font-extrabold text-rose-600 dark:text-rose-400">
                {formatMoney(data.expenses, data.currency)}
              </span>
            </div>

            {viewMode === 'comparison' && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Доходы:</span>
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatMoney(data.income, data.currency)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Остаток:</span>
                  </span>
                  <span
                    className={`font-bold ${
                      data.netBalance >= 0
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatMoney(data.netBalance, data.currency)}
                  </span>
                </div>
              </>
            )}

            {/* Dynamics compared to previous month */}
            {data.diffAmount !== null && (
              <div className="pt-1 border-t border-stone-200 dark:border-stone-800 flex justify-between items-center text-[11px]">
                <span className="text-stone-500 dark:text-stone-400">К прошлому мес.:</span>
                <span
                  className={`font-bold flex items-center gap-0.5 ${
                    data.diffAmount < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : data.diffAmount > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-stone-500'
                  }`}
                >
                  {data.diffAmount < 0 ? (
                    <ArrowDownRight className="w-3 h-3" />
                  ) : data.diffAmount > 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : null}
                  <span>
                    {data.diffAmount > 0 ? '+' : ''}
                    {formatMoney(data.diffAmount, data.currency)} ({data.diffPercent}%)
                  </span>
                </span>
              </div>
            )}

            <div className="flex justify-between items-center text-[11px] text-stone-500">
              <span>Счетов / записей:</span>
              <span className="font-semibold text-stone-700 dark:text-stone-300">
                {data.notesCount} шт.
              </span>
            </div>

            {data.comment && (
              <p className="pt-1 border-t border-stone-200 dark:border-stone-800 text-[11px] text-stone-600 dark:text-stone-300 italic font-sans line-clamp-2">
                «{data.comment}»
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // If no archived budgets exist
  if (chartData.length === 0) {
    return (
      <div className="bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 rounded-3xl p-5 mb-5 shadow-sm transition-colors text-center py-10">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
          <BarChart3 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-stone-900 dark:text-white mb-1">
          Гистограмма динамики расходов
        </h3>
        <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto mb-3">
          После закрытия первого месяца в архив здесь появится наглядный график динамики ваших расходов, сравнение с предыдущими периодами и аналитика тренда.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 rounded-3xl p-4 sm:p-5 mb-5 shadow-sm transition-colors">
      {/* Top Header of Chart */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-900/10 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Динамика расходов по месяцам</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/30">
                Гистограмма Recharts
              </span>
            </h3>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Наглядное сопоставление трат по архивным периодам и отслеживание тренда экономии
          </p>
        </div>

        {/* View Mode Controls */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('expenses')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              viewMode === 'expenses'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
            }`}
          >
            📉 Траты
          </button>
          <button
            type="button"
            onClick={() => setViewMode('comparison')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              viewMode === 'comparison'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
            }`}
          >
            ⚖️ Расходы и Доходы
          </button>

          <button
            type="button"
            onClick={() => setShowAverageLine(!showAverageLine)}
            className={`p-1.5 rounded-xl border text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
              showAverageLine
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500'
            }`}
            title="Показать / скрыть линию средних расходов"
          >
            <span className="text-[11px] hidden sm:inline">Средняя:</span>
            <span className="font-mono text-[11px] font-bold">
              {formatMoney(averageExpenses, '₽')}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Dynamic Trends */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* Average Monthly Spending */}
        <div className="bg-rose-50/70 dark:bg-stone-950/60 border border-rose-200/60 dark:border-stone-800/80 p-3 rounded-2xl">
          <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-0.5">
            Средние траты в мес.
          </span>
          <span className="text-base sm:text-lg font-bold text-rose-700 dark:text-rose-400 font-mono">
            {formatMoney(averageExpenses, '₽')}
          </span>
        </div>

        {/* Latest Trend Comparison */}
        <div className="bg-stone-50/80 dark:bg-stone-950/60 border border-stone-200/80 dark:border-stone-800/80 p-3 rounded-2xl">
          <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-0.5">
            Динамика к пред. мес.
          </span>
          {latestTrend ? (
            <div
              className={`flex items-center gap-1 text-base sm:text-lg font-bold font-mono ${
                latestTrend.isSavings
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {latestTrend.isSavings ? (
                <ArrowDownRight className="w-4 h-4 shrink-0" />
              ) : (
                <ArrowUpRight className="w-4 h-4 shrink-0" />
              )}
              <span>
                {latestTrend.diff > 0 ? '+' : ''}
                {formatMoney(latestTrend.diff, '₽')} ({latestTrend.percent}%)
              </span>
            </div>
          ) : (
            <span className="text-sm font-semibold text-stone-400 font-mono">1-й период</span>
          )}
        </div>

        {/* Lowest Spending Month */}
        {minExpenseMonth && (
          <div className="bg-emerald-50/70 dark:bg-stone-950/60 border border-emerald-200/60 dark:border-stone-800/80 p-3 rounded-2xl">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-0.5">
              🏆 Минимум трат
            </span>
            <div className="font-mono">
              <span className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 block truncate">
                {formatMoney(minExpenseMonth.expenses, minExpenseMonth.currency)}
              </span>
              <span className="text-[10px] text-stone-500 truncate block">
                {minExpenseMonth.monthName}
              </span>
            </div>
          </div>
        )}

        {/* Peak Spending Month */}
        {maxExpenseMonth && (
          <div className="bg-amber-50/70 dark:bg-stone-950/60 border border-amber-200/60 dark:border-stone-800/80 p-3 rounded-2xl">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-0.5">
              ⚠️ Пик расходов
            </span>
            <div className="font-mono">
              <span className="text-base sm:text-lg font-bold text-amber-700 dark:text-amber-400 block truncate">
                {formatMoney(maxExpenseMonth.expenses, maxExpenseMonth.currency)}
              </span>
              <span className="text-[10px] text-stone-500 truncate block">
                {maxExpenseMonth.monthName}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Recharts BarChart Container */}
      <div className="h-64 sm:h-72 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 12, left: -10, bottom: 5 }}
            onClick={(state: any) => {
              if (state && state.activePayload && state.activePayload.length) {
                const clickedItem: MonthlyChartItem = state.activePayload[0].payload;
                if (onSelectMonth) {
                  onSelectMonth(selectedMonthId === clickedItem.id ? null : clickedItem.id);
                }
              }
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(168, 162, 158, 0.2)"
            />
            <XAxis
              dataKey="shortName"
              tickLine={false}
              axisLine={{ stroke: 'rgba(168, 162, 158, 0.3)' }}
              tick={{ fill: '#78716c', fontSize: 11, fontFamily: 'monospace' }}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: 'rgba(168, 162, 158, 0.3)' }}
              tick={{ fill: '#78716c', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(val: number) =>
                val >= 1000 ? `${Math.round(val / 1000)}k` : `${val}`
              }
            />
            <Tooltip content={renderCustomTooltip} />
            <Legend
              wrapperStyle={{ paddingTop: '8px', fontSize: '11px', fontFamily: 'monospace' }}
            />

            {/* Reference Line for Average Expenses */}
            {showAverageLine && averageExpenses > 0 && (
              <ReferenceLine
                y={averageExpenses}
                stroke="#3b82f6"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Ср.: ${Math.round(averageExpenses / 1000)}k`,
                  fill: '#3b82f6',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            )}

            {/* Primary Bar: Expenses */}
            <Bar
              name="Расходы"
              dataKey="expenses"
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
              className="cursor-pointer transition-opacity"
            >
              {chartData.map((entry) => {
                const isSelected = selectedMonthId === entry.id;
                const isMax = maxExpenseMonth && entry.id === maxExpenseMonth.id;
                const isMin = minExpenseMonth && entry.id === minExpenseMonth.id;

                let fillColor = '#f43f5e'; // rose-500
                if (entry.isCurrent) fillColor = '#fb7185';
                else if (isMin) fillColor = '#10b981'; // green for best savings month
                else if (isMax) fillColor = '#e11d48'; // darker rose for peak

                return (
                  <Cell
                    key={`bar-expense-${entry.id}`}
                    fill={fillColor}
                    opacity={isSelected ? 1 : selectedMonthId ? 0.45 : 0.9}
                    stroke={isSelected ? '#f59e0b' : 'none'}
                    strokeWidth={isSelected ? 2 : 0}
                  />
                );
              })}
            </Bar>

            {/* Secondary Bars when in Comparison mode */}
            {viewMode === 'comparison' && (
              <>
                <Bar
                  name="Доходы (Прибыль)"
                  dataKey="income"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                  opacity={0.85}
                  className="cursor-pointer"
                />
                <Bar
                  name="Чистый остаток"
                  dataKey="netBalance"
                  fill="#f59e0b"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                  opacity={0.85}
                  className="cursor-pointer"
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Month Quick Selector Chips */}
      <div className="pt-3 mt-2 border-t border-amber-900/10 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold">
            Месяцы:
          </span>
          {chartData.map((item) => {
            const isSelected = selectedMonthId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (onSelectMonth) {
                    onSelectMonth(isSelected ? null : item.id);
                  }
                }}
                className={`px-2.5 py-1 rounded-xl font-mono text-[11px] font-bold transition cursor-pointer border ${
                  isSelected
                    ? 'bg-amber-600 text-white border-amber-500 shadow-2xs'
                    : 'bg-stone-50 hover:bg-stone-100 dark:bg-stone-800/80 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                }`}
              >
                <span>{item.shortName}</span>
                <span className="text-[10px] opacity-75 ml-1">
                  ({Math.round(item.expenses / 1000)}k)
                </span>
              </button>
            );
          })}
        </div>

        {/* Toggle include current active month in progress */}
        <label className="flex items-center gap-1.5 text-[11px] text-stone-600 dark:text-stone-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeCurrentMonth}
            onChange={(e) => setIncludeCurrentMonth(e.target.checked)}
            className="rounded text-amber-600 focus:ring-0 cursor-pointer"
          />
          <span>Включать текущий месяц (в процессе)</span>
        </label>
      </div>
    </div>
  );
};
