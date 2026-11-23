import React, { useMemo, useState } from 'react';
import { Note } from '../types';
import { formatMoney } from '../utils/mathEngine';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import {
  PieChart as PieChartIcon,
  Tag,
  TrendingDown,
  Sparkles,
  Wallet,
  Receipt,
  Layers,
} from 'lucide-react';

import { extractSmartTagsLocally } from '../services/aiTagging';

interface SpendingReportChartProps {
  notes: Note[];
  globalAutoCalculate?: boolean;
  onSelectTag?: (tag: string) => void;
}

interface TagExpenseSlice {
  name: string;
  value: number;
  color: string;
  percent: number;
  noteCount: number;
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

export const SpendingReportChart: React.FC<SpendingReportChartProps> = ({
  notes,
  globalAutoCalculate = true,
  onSelectTag,
}) => {
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);

  // Aggregate expenses categorized by note tags
  const { chartData, totalExpenseAmount, topCategory, totalPaymentNotesCount } = useMemo(() => {
    if (!globalAutoCalculate) {
      return {
        chartData: [] as TagExpenseSlice[],
        totalExpenseAmount: 0,
        topCategory: null as TagExpenseSlice | null,
        totalPaymentNotesCount: 0,
      };
    }
    const tagMap: Record<string, { total: number; count: number }> = {};
    let grandTotal = 0;
    let paymentNotesCount = 0;

    notes.forEach((note) => {
      if (note.isArchived) return;
      // Pick either explicit expenses or payment note total
      const expense =
        (note.cachedExpenses && note.cachedExpenses > 0)
          ? note.cachedExpenses
          : (note.cachedTotal && note.cachedTotal > 0 ? note.cachedTotal : 0);

      if (expense <= 0) return;

      grandTotal += expense;
      paymentNotesCount++;

      let validTags = (note.tags || [])
        .map((t) => (t.startsWith('#') ? t : `#${t}`).toLowerCase())
        .filter((t) => t.length > 1);

      // If note has no tags yet, detect smart tags locally from text and category
      if (validTags.length === 0) {
        validTags = extractSmartTagsLocally(note.title, note.content, note.category);
      }

      if (validTags.length === 0) {
        const fallback = note.category === 'shopping' ? '#покупки' : '#разное';
        tagMap[fallback] = tagMap[fallback] || { total: 0, count: 0 };
        tagMap[fallback].total += expense;
        tagMap[fallback].count += 1;
      } else {
        // Distribute expense equally among the note's tags
        const share = expense / validTags.length;
        validTags.forEach((t) => {
          tagMap[t] = tagMap[t] || { total: 0, count: 0 };
          tagMap[t].total += share;
          tagMap[t].count += 1;
        });
      }
    });

    const slices: TagExpenseSlice[] = Object.entries(tagMap)
      .map(([name, data], idx) => ({
        name,
        value: Math.round(data.total),
        color: TAG_PALETTE[idx % TAG_PALETTE.length],
        percent: grandTotal > 0 ? Math.round((data.total / grandTotal) * 100) : 0,
        noteCount: data.count,
      }))
      .sort((a, b) => b.value - a.value);

    const top = slices.length > 0 ? slices[0] : null;

    return {
      chartData: slices,
      totalExpenseAmount: grandTotal,
      topCategory: top,
      totalPaymentNotesCount: paymentNotesCount,
    };
  }, [notes, globalAutoCalculate]);

  // Custom Recharts Tooltip
  const renderCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: TagExpenseSlice = payload[0].payload;
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
              <span className="text-stone-500 dark:text-stone-400">Доля в бюджете:</span>
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
    <div className="bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 rounded-3xl p-5 mb-5 shadow-sm transition-colors">
      {/* Title & Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-900/10 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <PieChartIcon className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Отчет о расходах по тегам (Spending Report)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/30">
                Recharts Visual
              </span>
            </h3>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Наглядная круговая диаграмма распределения трат по категориям и тегам заметок
          </p>
        </div>

        {topCategory && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-50 dark:bg-stone-950 border border-amber-200 dark:border-stone-800 self-start sm:self-auto">
            <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <div className="text-xs font-mono">
              <span className="text-stone-500 dark:text-stone-400 text-[10px] block">Топ статья:</span>
              <span className="font-bold text-stone-900 dark:text-white">
                {topCategory.name} ({topCategory.percent}%)
              </span>
            </div>
          </div>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="text-center py-10 px-4 bg-stone-50/50 dark:bg-stone-950/40 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800">
          <Receipt className="w-10 h-10 text-stone-400 mx-auto mb-2 opacity-60" />
          <h4 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">
            {globalAutoCalculate
              ? 'Пока нет расходов для построения диаграммы'
              : 'Автоматический расчёт отключён'}
          </h4>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {globalAutoCalculate
              ? 'Добавьте финансовые заметки с суммами и тегами (например, #work, #shopping, #finances), чтобы увидеть интерактивный отчет расходов.'
              : 'Включите глобальный переключатель «Автоматический расчёт» выше или в настройках, чтобы видеть графики и суммы по всем заметкам.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-stone-950/60 border border-rose-200/60 dark:border-stone-800/80">
              <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5">Всего расходов:</span>
              <span className="text-base sm:text-lg font-bold text-rose-700 dark:text-rose-400 font-mono">
                {formatMoney(totalExpenseAmount, '₽')}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-stone-950/60 border border-blue-200/60 dark:border-stone-800/80">
              <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5">Категорий тегов:</span>
              <span className="text-base sm:text-lg font-bold text-blue-700 dark:text-blue-400 font-mono">
                {chartData.length}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-stone-950/60 border border-emerald-200/60 dark:border-stone-800/80 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5">Счетов в анализе:</span>
              <span className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                {totalPaymentNotesCount} шт.
              </span>
            </div>
          </div>

          {/* Interactive Recharts PieChart */}
          <div className="h-64 sm:h-72 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
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
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke="rgba(0,0,0,0.1)"
                      strokeWidth={1}
                      className="cursor-pointer transition-transform hover:opacity-85"
                      onClick={() => {
                        const targetTag = activeFilterTag === entry.name ? null : entry.name;
                        setActiveFilterTag(targetTag);
                        if (onSelectTag && targetTag) onSelectTag(targetTag);
                      }}
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
            </ResponsiveContainer>
          </div>

          {/* Category Chips & Breakdown Table */}
          <div className="pt-3 border-t border-amber-900/10 dark:border-stone-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                <span>Детализация расходов по тегам:</span>
              </span>
              {activeFilterTag && (
                <button
                  onClick={() => setActiveFilterTag(null)}
                  className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-bold cursor-pointer"
                >
                  Сбросить фильтр ({activeFilterTag})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {chartData
                .filter((item) => (activeFilterTag ? item.name === activeFilterTag : true))
                .map((slice) => (
                  <div
                    key={slice.name}
                    onClick={() => {
                      const nextTag = activeFilterTag === slice.name ? null : slice.name;
                      setActiveFilterTag(nextTag);
                      if (onSelectTag && nextTag) onSelectTag(nextTag);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                      activeFilterTag === slice.name
                        ? 'bg-amber-100/70 dark:bg-stone-800 border-amber-400 dark:border-stone-600 shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-950/70 hover:bg-stone-100 dark:hover:bg-stone-800/60 border-stone-200 dark:border-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="font-mono text-xs font-bold text-stone-900 dark:text-white">
                        {slice.name}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        ({slice.noteCount} сч.)
                      </span>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-400 block">
                        {formatMoney(slice.value, '₽')}
                      </span>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block">
                        {slice.percent}% бюджета
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
