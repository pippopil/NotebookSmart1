import React, { useState, useMemo } from 'react';
import { Note, EVENT_CATEGORY_CONFIG } from '../types';
import { findHolidayForDate } from '../services/holidays';
import { extractShoppingItems } from '../utils/shoppingParser';
import { TimezoneMode, convertEventToActiveTimezone, getActiveTodayDateStr } from '../services/timezone';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Bell,
  CheckSquare,
  CalendarCheck,
} from 'lucide-react';

interface CalendarMonthWidgetProps {
  notes: Note[];
  timezoneMode: TimezoneMode;
  countryCode: string;
  onOpenNote?: (note: Note) => void;
  onSelectDate?: (dateStr: string) => void;
  selectedDate?: string;
  compact?: boolean;
}

export type WorkloadLevel = 'none' | 'light' | 'medium' | 'heavy' | 'peak';

interface DayWorkloadInfo {
  notes: Note[];
  eventsCount: number;
  tasksCount: number;
  completedCount: number;
  totalLoad: number; // active events + active tasks
}

function countChecklistBoxes(content: string): { unchecked: number; checked: number } {
  let unchecked = 0;
  let checked = 0;
  const regex = /^\s*[-*•]?\s*\[([ xX])\]/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match[1].toLowerCase() === 'x') {
      checked += 1;
    } else {
      unchecked += 1;
    }
  }
  return { unchecked, checked };
}

function formatYMD(year: number, monthZeroIndexed: number, day: number): string {
  const d = new Date(year, monthZeroIndexed, day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export const CalendarMonthWidget: React.FC<CalendarMonthWidgetProps> = ({
  notes,
  timezoneMode,
  countryCode,
  onOpenNote,
  onSelectDate,
  selectedDate,
  compact = false,
}) => {
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth(); // 0-indexed

  const monthName = currentMonthDate.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

  // Calculate per-day workload combining scheduled events AND tasks in the active timezone
  const workloadByDate = useMemo(() => {
    const map = new Map<string, DayWorkloadInfo>();

    const ensureEntry = (dateKey: string): DayWorkloadInfo => {
      let existing = map.get(dateKey);
      if (!existing) {
        existing = {
          notes: [],
          eventsCount: 0,
          tasksCount: 0,
          completedCount: 0,
          totalLoad: 0,
        };
        map.set(dateKey, existing);
      }
      return existing;
    };

    for (const n of notes) {
      if (n.isArchived) continue;

      const primaryDateKey = n.eventDate
        ? convertEventToActiveTimezone(n.eventDate, n.eventTime, timezoneMode).date
        : n.reminderEnabled && !n.reminderTriggered && n.reminderDateTime
        ? n.reminderDateTime.slice(0, 10)
        : null;

      if (primaryDateKey) {
        const entry = ensureEntry(primaryDateKey);
        entry.notes.push(n);

        if (n.category === 'shopping') {
          const shoppingItems = extractShoppingItems(n.content);
          const unchecked = shoppingItems.filter((item) => !item.isCompleted).length;
          if (n.isEventDone) {
            entry.completedCount += 1;
          } else {
            entry.tasksCount += unchecked > 0 ? unchecked : 1;
          }
        } else {
          const { unchecked } = countChecklistBoxes(n.content || '');
          if (n.isEventDone) {
            entry.completedCount += 1;
          } else if (n.eventCategory === 'task') {
            entry.tasksCount += Math.max(1, unchecked);
          } else {
            entry.eventsCount += 1;
            if (unchecked > 0) {
              entry.tasksCount += unchecked;
            }
          }
        }
        entry.totalLoad = entry.eventsCount + entry.tasksCount;
      }

      // If note also has an active reminder scheduled on a DIFFERENT date, count it on that day too
      if (n.eventDate && n.reminderEnabled && !n.reminderTriggered && n.reminderDateTime) {
        const remDateKey = n.reminderDateTime.slice(0, 10);
        if (remDateKey && remDateKey !== primaryDateKey) {
          const remEntry = ensureEntry(remDateKey);
          remEntry.notes.push(n);
          remEntry.eventsCount += 1;
          remEntry.totalLoad = remEntry.eventsCount + remEntry.tasksCount;
        }
      }
    }

    return map;
  }, [notes, timezoneMode]);

  // 1. Nearest upcoming event
  const nearestUpcomingEvent = useMemo(() => {
    const now = Date.now();
    let bestNote: Note | null = null;
    let bestDiff = Infinity;

    for (const n of notes) {
      if (n.isArchived || n.isEventDone || n.category !== 'event') continue;

      let eventTime = 0;
      if (n.eventDate) {
        const converted = convertEventToActiveTimezone(n.eventDate, n.eventTime, timezoneMode);
        const timeStr = converted.time || '09:00';
        eventTime = new Date(`${converted.date}T${timeStr}`).getTime();
      } else if (n.reminderDateTime) {
        eventTime = new Date(n.reminderDateTime).getTime();
      }

      if (eventTime && eventTime >= now - 1000 * 60 * 60 * 6) {
        const diff = eventTime - now;
        if (diff < bestDiff) {
          bestDiff = diff;
          bestNote = n;
        }
      }
    }
    return bestNote;
  }, [notes, timezoneMode]);

  // 2. Nearest active reminder
  const nearestReminder = useMemo(() => {
    const now = Date.now();
    let bestNote: Note | null = null;
    let bestDiff = Infinity;

    for (const n of notes) {
      if (n.isArchived || !n.reminderEnabled || n.reminderTriggered || !n.reminderDateTime) continue;
      const remTime = new Date(n.reminderDateTime).getTime();
      if (!isNaN(remTime) && remTime >= now - 1000 * 60 * 30) {
        const diff = remTime - now;
        if (diff < bestDiff) {
          bestDiff = diff;
          bestNote = n;
        }
      }
    }
    return bestNote;
  }, [notes]);

  // 3. Nearest active task (unchecked checklist / shopping task / active event plan)
  const nearestTask = useMemo(() => {
    for (const n of notes) {
      if (n.isArchived) continue;
      const items = extractShoppingItems(n.content);
      const unchecked = items.filter((i) => !i.isCompleted);
      if (unchecked.length > 0) {
        return {
          note: n,
          title: unchecked[0].name,
          subtitle: unchecked.length > 1 ? `Ещё задач: ${unchecked.length - 1}` : n.title || 'Список задач',
        };
      }
    }
    return null;
  }, [notes]);

  const getNearestEventStatus = (note: Note) => {
    const converted = convertEventToActiveTimezone(note.eventDate, note.eventTime, timezoneMode);
    const dateStr = converted.date || (note.reminderDateTime ? note.reminderDateTime.slice(0, 10) : '');
    const timeStr = converted.time || (note.reminderDateTime ? note.reminderDateTime.slice(11, 16) : '');
    const tzBadge = timezoneMode === 'default_msk' ? 'МСК' : 'местн.';
    if (!dateStr) return { label: 'Запланировано', isToday: false };

    const todayStr = getActiveTodayDateStr(timezoneMode);
    const today = new Date(`${todayStr}T00:00:00`);
    const target = new Date(`${dateStr}T00:00:00`);
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { label: `Сегодня в ${timeStr || '12:00'} (${tzBadge})`, isToday: true };
    if (diffDays === 1) return { label: `Завтра в ${timeStr || '12:00'} (${tzBadge})`, isTomorrow: true };
    if (diffDays > 1 && diffDays <= 7) return { label: `Через ${diffDays} дн. в ${timeStr || '12:00'} (${tzBadge})` };
    return {
      label: `${new Date(`${dateStr}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} в ${timeStr || '12:00'} (${tzBadge})`,
    };
  };

  // Build calendar matrix using local dates & calculate peak load in the active month
  const { calendarCells, maxMonthLoad, peakDays, monthEventsTotal, monthTasksTotal } = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday is 0, Sunday is 6
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDayOfMonth.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const todayStr = getActiveTodayDateStr(timezoneMode);

    let peakLoadValue = 0;
    let totalMonthEvents = 0;
    let totalMonthTasks = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatYMD(year, month, day);
      const dayInfo = workloadByDate.get(dateStr);
      if (dayInfo) {
        totalMonthEvents += dayInfo.eventsCount;
        totalMonthTasks += dayInfo.tasksCount;
        if (dayInfo.totalLoad > peakLoadValue) {
          peakLoadValue = dayInfo.totalLoad;
        }
      }
    }

    const resolveWorkloadLevel = (load: number): WorkloadLevel => {
      if (load <= 0) return 'none';
      if (peakLoadValue >= 2 && load === peakLoadValue) return 'peak';
      if (load >= 4 || (peakLoadValue >= 4 && load >= Math.ceil(peakLoadValue * 0.75))) return 'heavy';
      if (load >= 2) return 'medium';
      return 'light';
    };

    const buildCell = (dateStr: string, dayNum: number, isCurrentMonth: boolean) => {
      const info = workloadByDate.get(dateStr);
      const eventsCount = info?.eventsCount || 0;
      const tasksCount = info?.tasksCount || 0;
      const completedCount = info?.completedCount || 0;
      const totalLoad = info?.totalLoad || 0;
      const notesCount = info?.notes.length || 0;
      const holiday = findHolidayForDate(dateStr, countryCode);
      const workloadLevel = resolveWorkloadLevel(totalLoad);

      return {
        dateStr,
        dayNum,
        isCurrentMonth,
        isToday: dateStr === todayStr,
        eventsCount,
        tasksCount,
        completedCount,
        totalLoad,
        notesCount,
        events: info?.notes || [],
        holiday,
        workloadLevel,
      };
    };

    const cells: ReturnType<typeof buildCell>[] = [];

    // Previous month filler days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      cells.push(buildCell(formatYMD(year, month - 1, dayNum), dayNum, false));
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(buildCell(formatYMD(year, month, day), day, true));
    }

    // Next month filler days
    const totalCellsNeeded = cells.length > 35 ? 42 : 35;
    const remaining = totalCellsNeeded - cells.length;
    for (let nextDay = 1; nextDay <= remaining; nextDay++) {
      cells.push(buildCell(formatYMD(year, month + 1, nextDay), nextDay, false));
    }

    const busiestDays = cells.filter(
      (c) => c.isCurrentMonth && c.totalLoad > 0 && c.totalLoad === peakLoadValue
    );

    return {
      calendarCells: cells,
      maxMonthLoad: peakLoadValue,
      peakDays: busiestDays,
      monthEventsTotal: totalMonthEvents,
      monthTasksTotal: totalMonthTasks,
    };
  }, [year, month, workloadByDate, countryCode, timezoneMode]);

  const handlePrevMonth = () => setCurrentMonthDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentMonthDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentMonthDate(new Date());

  return (
    <div className="bg-[#fffdfa] dark:bg-stone-900 border border-amber-900/15 dark:border-stone-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header with Month Navigation, Today Button & Monthly Load Summary */}
      <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-amber-900/10 dark:border-stone-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-purple-500/15 text-purple-800 dark:text-purple-300 shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-lg sm:text-xl font-extrabold leading-snug text-stone-950 dark:text-white capitalize flex items-center gap-2 flex-wrap">
              <span>{monthName}</span>
              <button
                type="button"
                onClick={handleToday}
                className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/80 dark:hover:bg-purple-900 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700 transition cursor-pointer"
                title="Перейти к сегодняшнему числу"
              >
                Сегодня
              </button>
              {(monthEventsTotal > 0 || monthTasksTotal > 0) && (
                <span className="normal-case text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-300/80 dark:border-stone-700">
                  Событий: {monthEventsTotal} · Задач: {monthTasksTotal}
                </span>
              )}
            </h3>
            <span className="text-xs sm:text-sm leading-relaxed text-stone-700 dark:text-stone-300 block">
              Индикаторы нагрузки по событиям и задачам + ближайшие дела
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Предыдущий месяц"
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-100 border border-stone-300/80 dark:border-stone-700 transition cursor-pointer"
            title="Предыдущий месяц"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Следующий месяц"
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-100 border border-stone-300/80 dark:border-stone-700 transition cursor-pointer"
            title="Следующий месяц"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SIDE-BY-SIDE WIDGET BODY: LEFT = MONTH CALENDAR, RIGHT = EVENT / REMINDER / TASK */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN (8 cols): LARGE, HIGH-CONTRAST MONTH CALENDAR GRID */}
        <div className="md:col-span-8 space-y-2">
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center font-extrabold text-sm sm:text-base leading-normal text-stone-800 dark:text-stone-200 pb-1">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, i) => (
              <div key={d} className={`py-0.5 ${i >= 5 ? 'text-rose-700 dark:text-rose-400 font-extrabold' : ''}`}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 font-mono">
            {calendarCells.map((cell) => {
              const isSelected = selectedDate === cell.dateStr;

              let cellColorClass = cell.isCurrentMonth
                ? 'bg-stone-50 hover:bg-stone-100 dark:bg-stone-800/80 dark:hover:bg-stone-800 border-stone-300/80 dark:border-stone-700 text-stone-950 dark:text-white'
                : 'bg-stone-100/50 dark:bg-stone-900/40 text-stone-500 dark:text-stone-500 border-transparent hover:border-stone-300';
              let workloadDotColor = '';
              let workloadBarColor = '';

              if (cell.workloadLevel === 'light') {
                cellColorClass =
                  'bg-emerald-100 hover:bg-emerald-200/85 dark:bg-emerald-950/70 border-emerald-500 dark:border-emerald-600 text-emerald-950 dark:text-emerald-100';
                workloadDotColor = 'bg-emerald-700 dark:bg-emerald-400';
                workloadBarColor = 'bg-emerald-600 dark:bg-emerald-400';
              } else if (cell.workloadLevel === 'medium') {
                cellColorClass =
                  'bg-amber-100 hover:bg-amber-200/90 dark:bg-amber-950/75 border-amber-500 dark:border-amber-600 text-amber-950 dark:text-amber-100';
                workloadDotColor = 'bg-amber-700 dark:bg-amber-400';
                workloadBarColor = 'bg-amber-600 dark:bg-amber-400';
              } else if (cell.workloadLevel === 'heavy') {
                cellColorClass =
                  'bg-orange-100 hover:bg-orange-200/90 dark:bg-orange-950/75 border-orange-500 dark:border-orange-500 text-orange-950 dark:text-orange-100';
                workloadDotColor = 'bg-orange-700 dark:bg-orange-400';
                workloadBarColor = 'bg-orange-600 dark:bg-orange-400';
              } else if (cell.workloadLevel === 'peak') {
                cellColorClass =
                  'bg-rose-100 hover:bg-rose-200/95 dark:bg-rose-950/85 border-rose-600 dark:border-rose-500 text-rose-950 dark:text-rose-50 shadow-2xs';
                workloadDotColor = 'bg-rose-700 dark:bg-rose-400';
                workloadBarColor = 'bg-rose-600 dark:bg-rose-400';
              } else if (cell.completedCount > 0) {
                cellColorClass =
                  'bg-stone-100 hover:bg-stone-200/80 dark:bg-stone-800/80 border-stone-400/70 dark:border-stone-600 text-stone-800 dark:text-stone-200';
                workloadDotColor = 'bg-stone-600 dark:bg-stone-400';
                workloadBarColor = 'bg-stone-600 dark:bg-stone-400';
              }

              const loadRatioPercent =
                cell.totalLoad > 0
                  ? Math.min(100, Math.max(24, Math.round((cell.totalLoad / Math.max(maxMonthLoad, 4)) * 100)))
                  : 0;

              const tooltipParts: string[] = [];
              if (cell.eventsCount > 0) tooltipParts.push(`событий: ${cell.eventsCount}`);
              if (cell.tasksCount > 0) tooltipParts.push(`задач: ${cell.tasksCount}`);
              if (cell.completedCount > 0) tooltipParts.push(`выполнено: ${cell.completedCount}`);
              if (cell.holiday) tooltipParts.push(`праздник: ${cell.holiday.name}`);
              const cellTooltip =
                tooltipParts.length > 0
                  ? `${cell.dateStr} — ${tooltipParts.join(', ')}${cell.workloadLevel === 'peak' ? ' (пик нагрузки)' : ''}`
                  : cell.dateStr;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => onSelectDate && onSelectDate(cell.dateStr)}
                  title={cellTooltip}
                  className={`relative ${compact ? 'min-h-[56px]' : 'min-h-[66px] sm:min-h-[74px]'} p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    cellColorClass
                  } ${
                    isSelected
                      ? 'ring-2 ring-purple-700 border-purple-700 shadow-sm z-10'
                      : cell.isToday
                      ? 'ring-2 ring-purple-600 dark:ring-amber-400 font-extrabold'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-0.5">
                    <span
                      className={`font-extrabold text-base sm:text-lg leading-snug ${
                        cell.isToday
                          ? 'text-purple-900 dark:text-amber-300 underline decoration-2 underline-offset-2'
                          : cell.isCurrentMonth
                          ? 'text-stone-950 dark:text-white'
                          : 'text-stone-500 dark:text-stone-500'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    <div className="flex items-center gap-0.5 leading-snug">
                      {cell.workloadLevel === 'peak' && (
                        <span className="text-xs select-none" title="Максимум дел в этом месяце">
                          🔥
                        </span>
                      )}
                      {cell.holiday && (
                        <span className="text-xs select-none" title={`Праздник: ${cell.holiday.name}`}>
                          {cell.holiday.emoji || '🎉'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 mt-1">
                    {cell.totalLoad > 0 ? (
                      <>
                        <div className="flex items-center justify-between w-full gap-0.5">
                          <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold leading-snug">
                            <span className={`w-2 h-2 rounded-full ${workloadDotColor} shrink-0`} />
                            <span>{cell.totalLoad}</span>
                          </span>
                          <div className="flex items-center gap-0.5 shrink-0 overflow-hidden">
                            {cell.events.slice(0, 2).map((evt, idx) => {
                              const catConf = EVENT_CATEGORY_CONFIG[evt.eventCategory || 'meeting'];
                              return (
                                <span
                                  key={idx}
                                  className={`w-2 h-2 rounded-full ${catConf?.dotColor || 'bg-purple-600'} shrink-0`}
                                />
                              );
                            })}
                          </div>
                        </div>
                        {/* Proportional Day Workload Indicator Bar */}
                        <div className="w-full h-1.5 rounded-full bg-black/15 dark:bg-white/15 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${workloadBarColor}`}
                            style={{ width: `${loadRatioPercent}%` }}
                          />
                        </div>
                      </>
                    ) : cell.completedCount > 0 ? (
                      <span className="text-[11px] sm:text-xs font-bold leading-snug text-stone-700 dark:text-stone-300 block truncate">
                        ✓ {cell.completedCount}
                      </span>
                    ) : cell.holiday ? (
                      <span className="text-[11px] sm:text-xs leading-snug text-amber-900 dark:text-amber-300 font-bold truncate block">
                        праздник
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN (4 cols): БЛИЖАЙШЕЕ СОБЫТИЕ, НАПОМИНАНИЕ, ЗАДАНИЕ */}
        <div className="md:col-span-4 space-y-3">
          {/* 1. Nearest Event */}
          <div
            onClick={() => nearestUpcomingEvent && onOpenNote && onOpenNote(nearestUpcomingEvent)}
            className={`p-3.5 sm:p-4 rounded-2xl border transition ${
              nearestUpcomingEvent
                ? 'bg-gradient-to-br from-purple-500/15 via-amber-500/5 to-purple-500/10 dark:from-purple-950/60 dark:to-stone-900 border-purple-400/70 hover:border-purple-600 cursor-pointer group'
                : 'bg-stone-50 dark:bg-stone-800/70 border-stone-300/80 dark:border-stone-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wide leading-normal text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Ближайшее событие</span>
              </span>
              {nearestUpcomingEvent && <ArrowRight className="w-4 h-4 text-purple-700 dark:text-purple-300 group-hover:translate-x-0.5 transition shrink-0" />}
            </div>

            {nearestUpcomingEvent ? (
              <div className="space-y-1.5">
                <h4 className="font-extrabold text-sm sm:text-base leading-snug text-stone-950 dark:text-white line-clamp-2">
                  {nearestUpcomingEvent.title || 'Событие без названия'}
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs font-bold leading-snug px-2 py-0.5 rounded-md border ${
                      EVENT_CATEGORY_CONFIG[nearestUpcomingEvent.eventCategory || 'meeting'].badgeClass
                    }`}
                  >
                    {EVENT_CATEGORY_CONFIG[nearestUpcomingEvent.eventCategory || 'meeting'].icon}{' '}
                    {EVENT_CATEGORY_CONFIG[nearestUpcomingEvent.eventCategory || 'meeting'].label}
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-bold leading-relaxed text-purple-950 dark:text-purple-200">
                    {getNearestEventStatus(nearestUpcomingEvent).label}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>Нет ближайших событий</span>
              </p>
            )}
          </div>

          {/* 2. Nearest Reminder */}
          <div
            onClick={() => nearestReminder && onOpenNote && onOpenNote(nearestReminder)}
            className={`p-3.5 sm:p-4 rounded-2xl border transition ${
              nearestReminder
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400/80 dark:border-amber-700/80 hover:border-amber-600 cursor-pointer group'
                : 'bg-stone-50 dark:bg-stone-800/70 border-stone-300/80 dark:border-stone-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wide leading-normal text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 shrink-0" />
                <span>Напоминание</span>
              </span>
              {nearestReminder && <ArrowRight className="w-4 h-4 text-amber-800 dark:text-amber-300 group-hover:translate-x-0.5 transition shrink-0" />}
            </div>

            {nearestReminder ? (
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm sm:text-base leading-snug text-stone-950 dark:text-white line-clamp-2">
                  {nearestReminder.title || 'Напоминание в тетради'}
                </h4>
                <p className="text-xs sm:text-sm font-mono font-bold leading-relaxed text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {new Date(nearestReminder.reminderDateTime!).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">Активных напоминаний нет</p>
            )}
          </div>

          {/* 3. Nearest Task */}
          <div
            onClick={() => nearestTask && onOpenNote && onOpenNote(nearestTask.note)}
            className={`p-3.5 sm:p-4 rounded-2xl border transition ${
              nearestTask
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400/80 dark:border-emerald-700/80 hover:border-emerald-600 cursor-pointer group'
                : 'bg-stone-50 dark:bg-stone-800/70 border-stone-300/80 dark:border-stone-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wide leading-normal text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                <span>Задание</span>
              </span>
              {nearestTask && <ArrowRight className="w-4 h-4 text-emerald-800 dark:text-emerald-300 group-hover:translate-x-0.5 transition shrink-0" />}
            </div>

            {nearestTask ? (
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm sm:text-base leading-snug text-stone-950 dark:text-white line-clamp-2">
                  {nearestTask.title}
                </h4>
                <p className="text-xs sm:text-sm font-semibold leading-relaxed text-emerald-900 dark:text-emerald-300 truncate">
                  {nearestTask.subtitle}
                </p>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">Все задания выполнены</p>
            )}
          </div>
        </div>
      </div>

      {/* WORKLOAD DENSITY LEGEND & PEAK DAYS SUMMARY */}
      <div className="pt-3 border-t border-amber-900/10 dark:border-stone-800 space-y-2.5 text-xs sm:text-sm leading-relaxed text-stone-700 dark:text-stone-300">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-stone-900 dark:text-stone-100">Индикатор нагрузки:</span>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
              <span className="w-3 h-3 rounded bg-emerald-600" />
              <span>1 дело</span>
            </span>
            <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold">
              <span className="w-3 h-3 rounded bg-amber-500" />
              <span>2–3</span>
            </span>
            <span className="flex items-center gap-1.5 text-orange-800 dark:text-orange-300 font-bold">
              <span className="w-3 h-3 rounded bg-orange-500" />
              <span>Высокая</span>
            </span>
            <span className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 font-bold">
              <span className="w-3 h-3 rounded bg-rose-600" />
              <span>🔥 Пик месяца</span>
            </span>
            <span className="flex items-center gap-1 text-amber-800 dark:text-amber-300 font-bold">
              <span>🎉</span>
              <span>Праздник</span>
            </span>
          </div>
        </div>

        {peakDays.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-extrabold uppercase text-rose-800 dark:text-rose-300">
              Самые загруженные дни:
            </span>
            {peakDays.slice(0, 4).map((d) => (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => onSelectDate && onSelectDate(d.dateStr)}
                className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/80 dark:hover:bg-rose-900/90 text-rose-950 dark:text-rose-100 border border-rose-400 dark:border-rose-700 font-mono text-xs font-extrabold transition cursor-pointer"
              >
                🔥{' '}
                {new Date(`${d.dateStr}T00:00:00`).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                })}{' '}
                ({d.totalLoad})
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


