import React, { useState, useMemo } from 'react';
import { Note, ArchivedBudgetMonth } from '../types';
import { analyzeNote, formatMoney } from '../utils/mathEngine';
import { SpendingReportChart } from './SpendingReportChart';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Calculator,
  Plus,
  Receipt,
  Check,
  Sparkles,
  BarChart3,
  TrendingUp,
  Calendar,
  Archive,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface CalculatorViewProps {
  notes: Note[];
  archivedBudgets?: ArchivedBudgetMonth[];
  globalAutoCalculate?: boolean;
  onToggleGlobalAutoCalculate?: (enabled: boolean) => void;
  onOpenNote: (note: Note) => void;
  onCreatePaymentNote: () => void;
  onOpenArchive?: () => void;
}

interface MonthlyDynamicPoint {
  id: string;
  monthName: string;
  shortName: string;
  income: number;
  expenses: number;
  netBalance: number;
  savingsRate: number;
  notesCount: number;
  currency: string;
  comment?: string;
  isCurrent?: boolean;
  expenseDiff: number | null;
  expenseDiffPercent: number | null;
  notesSnapshot?: ArchivedBudgetMonth['notesSnapshot'];
}

export const CalculatorView: React.FC<CalculatorViewProps> = ({
  notes,
  archivedBudgets = [],
  globalAutoCalculate = true,
  onToggleGlobalAutoCalculate,
  onOpenNote,
  onCreatePaymentNote,
  onOpenArchive,
}) => {
  const [scratchpadText, setScratchpadText] = useState<string>(
    `Зарплата за месяц: 120000
Аренда квартиры: -35000
Коммуналка + инет: -(2400 + 850)
Продукты и кафе: -(1500 * 20)
Спортзал: -3200

Остаток бюджета:`
  );
  const [copiedRes, setCopiedRes] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [monthlyChartType, setMonthlyChartType] = useState<'area' | 'bar'>('area');
  const [includeCurrentInMonthly, setIncludeCurrentInMonthly] = useState<boolean>(false);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);

  // Scratchpad live calculations (explicitly in money mode)
  const scratchpadSummary = useMemo(() => analyzeNote(scratchpadText, 'payment', true), [scratchpadText]);

  // Aggregate financial stats across all active notes when globalAutoCalculate is ON
  const financialTotals = useMemo(() => {
    if (!globalAutoCalculate) {
      return { totalIncome: 0, totalExpenses: 0, netSum: 0, count: 0 };
    }
    let totalIncome = 0;
    let totalExpenses = 0;
    let netSum = 0;
    let count = 0;

    notes.forEach((n) => {
      if (n.isArchived) return;
      const inc = n.cachedIncome || 0;
      const exp = n.cachedExpenses || 0;
      const tot = n.cachedTotal || 0;
      const hasMoney =
        inc > 0 ||
        exp > 0 ||
        Boolean(n.currency && ['₽', 'руб', '$', '€'].includes(n.currency)) ||
        n.category === 'payment' ||
        n.category === 'budget';
      if (hasMoney && (inc > 0 || exp > 0 || tot !== 0)) {
        totalIncome += inc;
        totalExpenses += exp > 0 ? exp : inc === 0 && tot > 0 ? tot : 0;
        netSum += inc > 0 || exp > 0 ? inc - exp : tot;
        count++;
      }
    });
    return { totalIncome, totalExpenses, netSum, count };
  }, [notes, globalAutoCalculate]);

  // Build chronological Recharts series of monthly income & expenses from archivedBudgets
  const { monthlySeries, avgIncome, avgExpenses, latestExpenseDelta } = useMemo(() => {
    const formatShortMonth = (fullName: string): string => {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        const monthPart = parts[0].slice(0, 3);
        const yearPart = parts[1].slice(-2);
        return `${monthPart.charAt(0).toUpperCase() + monthPart.slice(1)} '${yearPart}`;
      }
      return fullName.slice(0, 6);
    };

    const sorted = [...archivedBudgets].sort((a, b) => a.closedAt - b.closedAt);
    const points: MonthlyDynamicPoint[] = [];

    sorted.forEach((b, idx) => {
      const prev = idx > 0 ? points[idx - 1] : null;
      let expenseDiff: number | null = null;
      let expenseDiffPercent: number | null = null;
      if (prev) {
        expenseDiff = b.totalExpenses - prev.expenses;
        if (prev.expenses > 0) {
          expenseDiffPercent = Math.round((expenseDiff / prev.expenses) * 100);
        }
      }
      const savingsRate =
        b.totalIncome > 0 ? Math.round((b.netBalance / b.totalIncome) * 100) : 0;

      points.push({
        id: b.id,
        monthName: b.monthName,
        shortName: formatShortMonth(b.monthName),
        income: b.totalIncome,
        expenses: b.totalExpenses,
        netBalance: b.netBalance,
        savingsRate,
        notesCount: b.notesCount,
        currency: b.currency || '₽',
        comment: b.summaryComment,
        isCurrent: false,
        expenseDiff,
        expenseDiffPercent,
        notesSnapshot: b.notesSnapshot,
      });
    });

    if (
      includeCurrentInMonthly &&
      globalAutoCalculate &&
      (financialTotals.totalIncome > 0 || financialTotals.totalExpenses > 0)
    ) {
      const prev = points.length > 0 ? points[points.length - 1] : null;
      let expenseDiff: number | null = null;
      let expenseDiffPercent: number | null = null;
      if (prev) {
        expenseDiff = financialTotals.totalExpenses - prev.expenses;
        if (prev.expenses > 0) {
          expenseDiffPercent = Math.round((expenseDiff / prev.expenses) * 100);
        }
      }
      const savingsRate =
        financialTotals.totalIncome > 0
          ? Math.round((financialTotals.netSum / financialTotals.totalIncome) * 100)
          : 0;

      const currentLabel = new Date().toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
      });

      points.push({
        id: 'current-month-live',
        monthName: `${currentLabel} (текущий)`,
        shortName: 'Сейчас',
        income: financialTotals.totalIncome,
        expenses: financialTotals.totalExpenses,
        netBalance: financialTotals.netSum,
        savingsRate,
        notesCount: financialTotals.count,
        currency: '₽',
        comment: 'Активные незакрытые заметки текущего месяца',
        isCurrent: true,
        expenseDiff,
        expenseDiffPercent,
      });
    }

    const closedPoints = points.filter((p) => !p.isCurrent);
    const avgBase = closedPoints.length > 0 ? closedPoints : points;
    const avgInc =
      avgBase.length > 0
        ? Math.round(avgBase.reduce((s, p) => s + p.income, 0) / avgBase.length)
        : 0;
    const avgExp =
      avgBase.length > 0
        ? Math.round(avgBase.reduce((s, p) => s + p.expenses, 0) / avgBase.length)
        : 0;

    let delta: { diff: number; percent: number | null } | null = null;
    if (points.length >= 2) {
      const last = points[points.length - 1];
      if (last.expenseDiff !== null) {
        delta = { diff: last.expenseDiff, percent: last.expenseDiffPercent };
      }
    }

    return {
      monthlySeries: points,
      avgIncome: avgInc,
      avgExpenses: avgExp,
      latestExpenseDelta: delta,
    };
  }, [archivedBudgets, includeCurrentInMonthly, globalAutoCalculate, financialTotals]);

  const selectedMonthDetails = useMemo(
    () => monthlySeries.find((m) => m.id === selectedArchiveId) || null,
    [monthlySeries, selectedArchiveId]
  );

  const renderMonthlyTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: MonthlyDynamicPoint = payload[0].payload;
      return (
        <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-amber-900/15 dark:border-stone-700 shadow-xl font-mono text-xs z-50 min-w-[220px] space-y-1.5">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-stone-200 dark:border-stone-800">
            <span className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5 font-sans">
              <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{data.monthName}</span>
            </span>
            {data.isCurrent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold">
                Текущий
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-stone-500 dark:text-stone-400">🟢 Доходы:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              +{formatMoney(data.income, data.currency)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-stone-500 dark:text-stone-400">🔴 Расходы:</span>
            <span className="font-bold text-rose-600 dark:text-rose-400">
              −{formatMoney(data.expenses, data.currency)}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-stone-200 dark:border-stone-800">
            <span className="text-stone-500 dark:text-stone-400">💰 Остаток:</span>
            <span
              className={`font-extrabold ${
                data.netBalance >= 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatMoney(data.netBalance, data.currency)}
            </span>
          </div>
          {data.income > 0 && (
            <div className="flex justify-between items-center text-[11px] text-stone-500">
              <span>Норма сбережений:</span>
              <span className="font-bold text-amber-700 dark:text-amber-400">
                {data.savingsRate}%
              </span>
            </div>
          )}
          {data.expenseDiff !== null && (
            <div className="flex justify-between items-center text-[11px] text-stone-500">
              <span>Траты к пред. мес.:</span>
              <span
                className={`font-bold ${
                  data.expenseDiff <= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {data.expenseDiff > 0 ? '+' : ''}
                {formatMoney(data.expenseDiff, data.currency)}
                {data.expenseDiffPercent !== null ? ` (${data.expenseDiffPercent}%)` : ''}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRes(text);
    setTimeout(() => setCopiedRes(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 pb-28">
      {/* Top Overview Cards */}
      <div className="bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 rounded-3xl p-5 mb-5 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Calculator className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-stone-900 dark:text-white tracking-tight">
                Финансы — общий отчёт по всем заметкам
              </h2>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed max-w-xl">
              Здесь автоматически собираются все денежные суммы, доходы (<b className="text-emerald-600">+</b>) и расходы (<b className="text-rose-600">-</b>) из любых ваших заметок, строится диаграмма трат по #тегам и доступен быстрый калькулятор.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onToggleGlobalAutoCalculate && (
              <button
                type="button"
                role="switch"
                aria-checked={globalAutoCalculate}
                onClick={() => onToggleGlobalAutoCalculate(!globalAutoCalculate)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${
                  globalAutoCalculate
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                    : 'bg-stone-100 dark:bg-stone-850 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                <span>Автоматический расчёт</span>
                <div
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition ${
                    globalAutoCalculate ? 'bg-emerald-600' : 'bg-stone-300 dark:bg-stone-700'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow transform transition duration-200 ${
                      globalAutoCalculate ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
            )}

            <button
              onClick={onCreatePaymentNote}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition active:scale-95 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Новая запись о финансах</span>
            </button>
          </div>
        </div>

        {!globalAutoCalculate && (
          <div className="mt-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300/70 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
            Глобальный <b>Автоматический расчёт</b> сейчас выключен — финансовые выражения во всех заметках не парсятся. Включите тумблер выше или в настройках приложения, чтобы вернуть подсчёты.
          </div>
        )}

        {/* Global Summary Metric */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-amber-900/10 dark:border-stone-800">
          <div className="bg-emerald-50/70 dark:bg-stone-950/60 rounded-2xl p-3 border border-emerald-200/60 dark:border-stone-800/80">
            <span className="text-[11px] text-stone-500 dark:text-stone-400 block mb-0.5">🟢 Доходы</span>
            <span className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono">
              +{formatMoney(financialTotals.totalIncome, '₽')}
            </span>
          </div>

          <div className="bg-rose-50/70 dark:bg-stone-950/60 rounded-2xl p-3 border border-rose-200/60 dark:border-stone-800/80">
            <span className="text-[11px] text-stone-500 dark:text-stone-400 block mb-0.5">🔴 Расходы</span>
            <span className="text-base sm:text-lg font-bold text-rose-700 dark:text-rose-400 font-mono">
              −{formatMoney(financialTotals.totalExpenses, '₽')}
            </span>
          </div>

          <div className="bg-amber-50/70 dark:bg-stone-950/60 rounded-2xl p-3 border border-amber-200/60 dark:border-stone-800/80">
            <span className="text-[11px] text-stone-500 dark:text-stone-400 block mb-0.5">💰 Общий остаток</span>
            <span className={`text-base sm:text-lg font-bold font-mono ${financialTotals.netSum >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
              {formatMoney(financialTotals.netSum, '₽')}
            </span>
          </div>

          <div className="bg-stone-50 dark:bg-stone-950/60 rounded-2xl p-3 border border-stone-200 dark:border-stone-800/80">
            <span className="text-[11px] text-stone-500 dark:text-stone-400 block mb-0.5">📄 Заметок с деньгами</span>
            <span className="text-base sm:text-lg font-bold text-stone-800 dark:text-stone-200 font-mono">
              {financialTotals.count} шт.
            </span>
          </div>
        </div>
      </div>

      {/* VISUAL RECHARTS MONTHLY DYNAMICS (Archived Income & Expenses by Month) */}
      <div className="bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 rounded-3xl p-4 sm:p-5 mb-5 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-900/10 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <TrendingUp className="w-5 h-5" />
              </span>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white tracking-tight">
                Динамика доходов и расходов по месяцам
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-400/30">
                Recharts Архив
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Сравнение ежемесячных доходов, трат и чистого остатка на основе закрытых архивных периодов
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setMonthlyChartType('area')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                monthlyChartType === 'area'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Тренд</span>
            </button>
            <button
              type="button"
              onClick={() => setMonthlyChartType('bar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                monthlyChartType === 'bar'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Столбцы</span>
            </button>
          </div>
        </div>

        {monthlySeries.length === 0 ? (
          <div className="text-center py-8 px-4 bg-stone-50/60 dark:bg-stone-950/40 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 space-y-3">
            <Archive className="w-9 h-9 text-amber-500 mx-auto opacity-80" />
            <div>
              <h4 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-1">
                Нет архивных месяцев для графика динамики
              </h4>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
                Закройте месяц в разделе «Архив» или включите отображение текущего месяца, чтобы отслеживать динамику доходов и расходов.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {globalAutoCalculate && (financialTotals.totalIncome > 0 || financialTotals.totalExpenses > 0) && (
                <button
                  type="button"
                  onClick={() => setIncludeCurrentInMonthly(true)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  Показать текущий месяц
                </button>
              )}
              {onOpenArchive && (
                <button
                  type="button"
                  onClick={onOpenArchive}
                  className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-amber-900 dark:text-amber-300 text-xs font-bold transition cursor-pointer"
                >
                  Открыть Архив →
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Monthly Archive KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-stone-950/60 border border-emerald-200/60 dark:border-stone-800">
                <span className="text-[10px] font-bold uppercase text-stone-500 dark:text-stone-400 block mb-0.5">
                  Ср. доход / мес.
                </span>
                <span className="text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                  +{formatMoney(avgIncome, '₽')}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-stone-950/60 border border-rose-200/60 dark:border-stone-800">
                <span className="text-[10px] font-bold uppercase text-stone-500 dark:text-stone-400 block mb-0.5">
                  Ср. расход / мес.
                </span>
                <span className="text-sm sm:text-base font-bold text-rose-700 dark:text-rose-400 font-mono">
                  −{formatMoney(avgExpenses, '₽')}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800">
                <span className="text-[10px] font-bold uppercase text-stone-500 dark:text-stone-400 block mb-0.5">
                  Динамика трат
                </span>
                {latestExpenseDelta ? (
                  <div
                    className={`flex items-center gap-1 text-sm sm:text-base font-bold font-mono ${
                      latestExpenseDelta.diff <= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {latestExpenseDelta.diff <= 0 ? (
                      <ArrowDownRight className="w-4 h-4 shrink-0" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 shrink-0" />
                    )}
                    <span className="truncate">
                      {latestExpenseDelta.diff > 0 ? '+' : ''}
                      {formatMoney(latestExpenseDelta.diff, '₽')}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-stone-400 font-mono">1 период</span>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-stone-950/60 border border-amber-200/60 dark:border-stone-800">
                <span className="text-[10px] font-bold uppercase text-stone-500 dark:text-stone-400 block mb-0.5">
                  Периодов в архиве
                </span>
                <span className="text-sm sm:text-base font-bold text-amber-800 dark:text-amber-300 font-mono">
                  {archivedBudgets.length} мес.
                </span>
              </div>
            </div>

            {/* Recharts Chart Area */}
            <div className="h-64 sm:h-72 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                {monthlyChartType === 'area' ? (
                  <AreaChart
                    data={monthlySeries}
                    margin={{ top: 16, right: 12, left: -10, bottom: 5 }}
                    onClick={(state: any) => {
                      const clicked: MonthlyDynamicPoint | undefined =
                        state?.activePayload?.[0]?.payload;
                      if (clicked) {
                        setSelectedArchiveId((prev) => (prev === clicked.id ? null : clicked.id));
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id="calcIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="calcExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(168, 162, 158, 0.2)" />
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
                        Math.abs(val) >= 1000 ? `${Math.round(val / 1000)}k` : `${val}`
                      }
                    />
                    <Tooltip content={renderMonthlyTooltip} />
                    <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px', fontFamily: 'monospace' }} />
                    {avgExpenses > 0 && (
                      <ReferenceLine
                        y={avgExpenses}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                      />
                    )}
                    <Area
                      type="monotone"
                      name="Доходы"
                      dataKey="income"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#calcIncomeGrad)"
                      activeDot={{ r: 6 }}
                    />
                    <Area
                      type="monotone"
                      name="Расходы"
                      dataKey="expenses"
                      stroke="#f43f5e"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#calcExpenseGrad)"
                      activeDot={{ r: 6 }}
                    />
                    <Area
                      type="monotone"
                      name="Остаток"
                      dataKey="netBalance"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      fillOpacity={0}
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={monthlySeries}
                    margin={{ top: 16, right: 12, left: -10, bottom: 5 }}
                    onClick={(state: any) => {
                      const clicked: MonthlyDynamicPoint | undefined =
                        state?.activePayload?.[0]?.payload;
                      if (clicked) {
                        setSelectedArchiveId((prev) => (prev === clicked.id ? null : clicked.id));
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(168, 162, 158, 0.2)" />
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
                        Math.abs(val) >= 1000 ? `${Math.round(val / 1000)}k` : `${val}`
                      }
                    />
                    <Tooltip content={renderMonthlyTooltip} />
                    <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px', fontFamily: 'monospace' }} />
                    <Bar name="Доходы" dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    <Bar name="Расходы" dataKey="expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    <Bar name="Остаток" dataKey="netBalance" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Footer Controls: Month Chips & Current Month Toggle */}
            <div className="pt-3 border-t border-amber-900/10 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold">
                  Периоды:
                </span>
                {monthlySeries.map((item) => {
                  const isSel = selectedArchiveId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedArchiveId(isSel ? null : item.id)}
                      className={`px-2.5 py-1 rounded-xl font-mono text-[11px] font-bold transition cursor-pointer border ${
                        isSel
                          ? 'bg-amber-600 text-white border-amber-500 shadow-2xs'
                          : 'bg-stone-50 hover:bg-stone-100 dark:bg-stone-800/80 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      {item.shortName}
                    </button>
                  );
                })}
              </div>

              <label className="flex items-center gap-1.5 text-[11px] text-stone-600 dark:text-stone-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeCurrentInMonthly}
                  onChange={(e) => setIncludeCurrentInMonthly(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-0 cursor-pointer"
                />
                <span>Добавить текущий месяц</span>
              </label>
            </div>

            {/* Selected Archived Month Breakdown */}
            {selectedMonthDetails && (
              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-stone-950/70 border border-amber-300/60 dark:border-stone-800 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>{selectedMonthDetails.monthName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedArchiveId(null)}
                    className="text-[11px] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
                  >
                    Закрыть ✕
                  </button>
                </div>
                {selectedMonthDetails.comment && (
                  <p className="text-[11px] italic text-stone-600 dark:text-stone-300">
                    «{selectedMonthDetails.comment}»
                  </p>
                )}
                {selectedMonthDetails.notesSnapshot && selectedMonthDetails.notesSnapshot.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {selectedMonthDetails.notesSnapshot.map((snap) => (
                      <div
                        key={snap.id}
                        className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2"
                      >
                        <span className="font-semibold text-stone-800 dark:text-stone-200 truncate">
                          {snap.title || 'Архивная запись'}
                        </span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                          {formatMoney(snap.balance, selectedMonthDetails.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* VISUAL RECHARTS SPENDING REPORT (Categorized by note tags) */}
      <SpendingReportChart
        notes={notes}
        globalAutoCalculate={globalAutoCalculate}
        onSelectTag={(tag) => setFilterTag(filterTag === tag ? null : tag)}
      />

      {/* SMART FINANCIAL SCRATCHPAD (Live Smart Notebook Calculator) */}
      <div className="bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 rounded-3xl p-5 mb-6 shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-base text-stone-900 dark:text-white">Быстрый финансовый черновик</h3>
          </div>
          <span className="text-xs text-stone-500 dark:text-stone-400">
            Пишите числа, проценты и слова — результат считается на лету
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Input text */}
          <div className="flex-1">
            <textarea
              value={scratchpadText}
              onChange={(e) => setScratchpadText(e.target.value)}
              rows={8}
              className="w-full bg-[#fffdf9] dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-mono text-xs sm:text-sm p-3.5 rounded-2xl border border-amber-900/15 dark:border-stone-800 focus:outline-none focus:border-amber-500 resize-none leading-6 selectable-text shadow-2xs"
            />
          </div>

          {/* Results column */}
          <div className="sm:w-44 bg-stone-50 dark:bg-stone-950 rounded-2xl p-3.5 border border-stone-200 dark:border-stone-800 flex flex-col justify-between font-mono">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block mb-2">
                Построчный расчет:
              </span>
              <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto">
                {scratchpadSummary.lines.map((l, idx) => (
                  <div key={idx} className="flex items-center justify-between h-5">
                    <span className="text-stone-500 text-[10px] truncate max-w-[70px]">
                      {l.label || `стр ${idx + 1}`}
                    </span>
                    {l.result !== null ? (
                      <button
                        onClick={() => handleCopy(`${l.result} ₽`)}
                        className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                        title="Скопировать"
                      >
                        = {formatMoney(l.result, l.currency)}
                      </button>
                    ) : (
                      <span className="text-stone-400 dark:text-stone-600">—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 dark:border-stone-800 mt-2">
              <span className="text-[10px] text-stone-500 dark:text-stone-400 block uppercase font-medium">Итог:</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {formatMoney(scratchpadSummary.grandTotal, scratchpadSummary.currency)}
              </span>
            </div>
          </div>
        </div>

        {copiedRes && (
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            <span>Скопировано: {copiedRes}</span>
          </div>
        )}
      </div>

      {/* Existing Notes with Financial Totals */}
      <div className="bg-white/80 dark:bg-stone-900/60 border border-amber-900/10 dark:border-stone-800 rounded-3xl p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base text-stone-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Все заметки с финансовыми расчётами</span>
          </h3>
          {filterTag && (
            <button
              onClick={() => setFilterTag(null)}
              className="text-xs text-amber-700 dark:text-amber-400 font-bold hover:underline cursor-pointer"
            >
              Сбросить фильтр ({filterTag})
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {!globalAutoCalculate ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-4 text-center">
              Автоматический расчёт отключён во всех заметках. Включите переключатель выше для отображения списка финансовых заметок.
            </p>
          ) : (
            notes
            .filter(
              (n) =>
                !n.isArchived &&
                ((n.cachedTotal || 0) !== 0 || (n.cachedIncome || 0) > 0 || (n.cachedExpenses || 0) > 0 || n.category === 'payment')
            )
            .filter((n) => {
              if (!filterTag) return true;
              return (n.tags || []).some(
                (t) => (t.startsWith('#') ? t : `#${t}`).toLowerCase() === filterTag.toLowerCase()
              );
            })
            .map((n) => (
              <div
                key={n.id}
                onClick={() => onOpenNote(n)}
                className="bg-white dark:bg-stone-950/80 hover:bg-stone-50 dark:hover:bg-stone-950 border border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-stone-700 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition shadow-2xs"
              >
                <div className="min-w-0 pr-3">
                  <h4 className="font-semibold text-sm text-stone-900 dark:text-white truncate">{n.title || 'Заметка с расчётом'}</h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-1 mt-0.5">{n.content}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono block">
                    {formatMoney(n.cachedTotal || 0, n.currency || '₽')}
                  </span>
                  <span className="text-[10px] text-stone-400">Открыть →</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
