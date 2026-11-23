import React, { useState, useEffect, useMemo } from 'react';
import { Note, EventCategory, EVENT_CATEGORY_CONFIG, EVENT_CATEGORIES_LIST } from '../types';
import { CalendarMonthWidget } from './CalendarMonthWidget';
import {
  SUPPORTED_COUNTRIES,
  CountryOption,
  detectCountryFromTimezone,
  getCountryHolidays,
  findHolidayForDate,
  Holiday,
} from '../services/holidays';
import {
  TimezoneMode,
  getSavedTimezoneMode,
  saveTimezoneMode,
  getTimezoneLabel,
  convertEventToActiveTimezone,
  getActiveTodayDateStr,
} from '../services/timezone';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Plus,
  ArrowRight,
  Globe,
  Check,
  ChevronDown,
  CalendarDays,
  Bell,
  Sparkles,
  Filter,
  Settings,
  Download,
  Upload,
} from 'lucide-react';
import {
  exportEventsToICS,
  parseICSContent,
  triggerTextFileDownload,
} from '../utils/exportFormats';

interface EventsViewProps {
  notes: Note[];
  onOpenNote: (note: Note) => void;
  onCreateEvent: (title?: string, date?: string, time?: string, eventCategory?: EventCategory) => void;
  onToggleEventDone: (note: Note) => void;
  onImportEvents?: (importedEvents: Note[]) => void;
  timezoneMode?: TimezoneMode;
  onTimezoneModeChange?: (mode: TimezoneMode) => void;
  onOpenSettings?: () => void;
}

export type HolidayMode = 'my_country' | 'current_location' | 'manual_select';

export const EventsView: React.FC<EventsViewProps> = ({
  notes,
  onOpenNote,
  onCreateEvent,
  onToggleEventDone,
  onImportEvents,
  timezoneMode: propTimezoneMode,
  onTimezoneModeChange: propOnTimezoneModeChange,
  onOpenSettings,
}) => {
  const [icsNotice, setIcsNotice] = useState<string | null>(null);
  // Timezone Setting State (synchronized with App settings and localStorage)
  const [internalTimezoneMode, setInternalTimezoneMode] = useState<TimezoneMode>(() => getSavedTimezoneMode());
  const effectiveTimezoneMode = propTimezoneMode || internalTimezoneMode;

  // Holiday Selection State
  const [holidayMode, setHolidayMode] = useState<HolidayMode>(() => {
    try {
      const saved = localStorage.getItem('notebook_holiday_mode');
      if (saved === 'my_country' || saved === 'current_location' || saved === 'manual_select') {
        return saved;
      }
    } catch {}
    return 'my_country';
  });

  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('notebook_holiday_country');
      if (saved) return saved;
    } catch {}
    return 'RU';
  });

  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  // Active View Tab: 'calendar' | 'list' | 'holidays'
  const [activeTab, setActiveTab] = useState<'calendar' | 'list' | 'holidays'>('calendar');

  // Event category filter in list view
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'all' | EventCategory>('all');

  // Selected date for day inspector (initialized in active timezone)
  const [selectedDate, setSelectedDate] = useState<string>(() => getActiveTodayDateStr(effectiveTimezoneMode));

  // Quick event creator form state
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(() => getActiveTodayDateStr(effectiveTimezoneMode));
  const [newTime, setNewTime] = useState('12:00');
  const [newCategory, setNewCategory] = useState<EventCategory>('meeting');

  // Real-time clock tick for timezone preview
  const [currentTimeTick, setCurrentTimeTick] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeTick(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Update timezone setting
  const handleTimezoneChange = (mode: TimezoneMode) => {
    setInternalTimezoneMode(mode);
    saveTimezoneMode(mode);
    if (propOnTimezoneModeChange) {
      propOnTimezoneModeChange(mode);
    }
  };

  // Resolve active country code based on mode
  const activeCountryCode = useMemo(() => {
    if (holidayMode === 'my_country') {
      return 'RU';
    }
    if (holidayMode === 'current_location') {
      return detectCountryFromTimezone();
    }
    return selectedCountryCode;
  }, [holidayMode, selectedCountryCode]);

  const activeCountryObj = useMemo(() => {
    return SUPPORTED_COUNTRIES.find((c) => c.code === activeCountryCode) || SUPPORTED_COUNTRIES[0];
  }, [activeCountryCode]);

  // Auto-loads holidays using date-holidays library
  const activeHolidays = useMemo(() => {
    return getCountryHolidays(activeCountryCode);
  }, [activeCountryCode]);

  // Save holiday settings
  const handleHolidayModeChange = (mode: HolidayMode) => {
    setHolidayMode(mode);
    try {
      localStorage.setItem('notebook_holiday_mode', mode);
    } catch {}
  };

  const handleSelectCountry = (code: string) => {
    setSelectedCountryCode(code);
    setHolidayMode('manual_select');
    setShowCountryDropdown(false);
    try {
      localStorage.setItem('notebook_holiday_country', code);
      localStorage.setItem('notebook_holiday_mode', 'manual_select');
    } catch {}
  };

  // Timezone label info
  const tzInfo = useMemo(() => {
    return getTimezoneLabel(effectiveTimezoneMode);
  }, [effectiveTimezoneMode, currentTimeTick]);

  // Filter only event notes
  const eventNotes = useMemo(() => {
    return notes.filter((n) => n.category === 'event' && !n.isArchived);
  }, [notes]);

  // Filtered event notes for the list tab
  const filteredEventNotes = useMemo(() => {
    if (selectedCategoryFilter === 'all') return eventNotes;
    return eventNotes.filter((n) => (n.eventCategory || 'meeting') === selectedCategoryFilter);
  }, [eventNotes, selectedCategoryFilter]);

  // Events & dated tasks on the currently selected date, automatically converted to the active timezone
  const selectedDateEvents = useMemo(() => {
    return notes.filter((n) => {
      if (n.isArchived) return false;
      if (n.eventDate) {
        const converted = convertEventToActiveTimezone(n.eventDate, n.eventTime, effectiveTimezoneMode);
        if (converted.date === selectedDate) return true;
      }
      if (n.reminderEnabled && !n.reminderTriggered && n.reminderDateTime && n.reminderDateTime.startsWith(selectedDate)) {
        return true;
      }
      return false;
    });
  }, [notes, selectedDate, effectiveTimezoneMode]);

  const selectedDateHoliday = useMemo(() => {
    return findHolidayForDate(selectedDate, activeCountryCode);
  }, [selectedDate, activeCountryCode]);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreateEvent(newTitle.trim(), newDate, newTime, newCategory);
    setNewTitle('');
    setNewCategory('meeting');
    setShowQuickForm(false);
  };

  const handleOpenAddForSelectedDate = () => {
    setNewDate(selectedDate);
    setShowQuickForm(true);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain w-full">
      <div className="max-w-4xl mx-auto px-4 py-4 pb-28 space-y-4">
      {/* 1. TOP HEADER: TITLE & TIMEZONE & HOLIDAY SETTINGS BAR */}
      <div className="bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-900/10 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-2xl bg-purple-500/15 text-purple-700 dark:text-purple-400">
                <CalendarIcon className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-stone-900 dark:text-white tracking-tight">
                Интуитивный календарь & События
              </h2>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Автоматическое применение часового пояса (МСК / локальный), категории с цветами и государственные праздники
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={() => {
                const ics = exportEventsToICS(notes);
                triggerTextFileDownload(
                  ics,
                  `notebooksmart_events_${new Date().toISOString().slice(0, 10)}.ics`,
                  'text/calendar;charset=utf-8'
                );
                setIcsNotice('События экспортированы в .ics');
                setTimeout(() => setIcsNotice(null), 2500);
              }}
              aria-label="Экспорт событий в календарь iCal (.ics)"
              title="Экспорт событий в .ics (iCal)"
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>.ics</span>
            </button>

            {onImportEvents && (
              <label
                title="Импорт событий из файла .ics (только чтение)"
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Импорт .ics</span>
                <input
                  type="file"
                  accept=".ics,text/calendar"
                  aria-label="Импорт событий из файла iCal (.ics)"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = '';
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const parsed = parseICSContent(String(ev.target?.result || ''));
                      if (parsed.length > 0) {
                        onImportEvents(parsed);
                        setIcsNotice(`Импортировано событий: ${parsed.length}`);
                      } else {
                        setIcsNotice('События в .ics не найдены');
                      }
                      setTimeout(() => setIcsNotice(null), 3000);
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            )}

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="Открыть настройки приложения"
                className="p-2 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 transition active:scale-95 cursor-pointer"
                title="Открыть настройки приложения"
              >
                <Settings className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setNewDate(selectedDate);
                setShowQuickForm(!showQuickForm);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/25 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{showQuickForm ? 'Скрыть форму' : '➕ Новое событие'}</span>
            </button>
          </div>
        </div>

        {icsNotice && (
          <div
            role="status"
            className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold"
          >
            ✓ {icsNotice}
          </div>
        )}

        {/* 2. TIMEZONE SWITCHER BAR (МСК default vs Local Timezone) WITH AUTOMATIC APPLICATION STATUS */}
        <div className="bg-stone-50 dark:bg-stone-800/80 rounded-2xl p-3 border border-stone-200/80 dark:border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-purple-600 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-900 dark:text-white">
                  Часовой пояс календаря:
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] font-bold border border-purple-400/30">
                  {effectiveTimezoneMode === 'default_msk' ? '🇷🇺 МСК' : '🌐 Местное'}
                </span>
              </div>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                Текущее время: <b className="font-mono text-purple-700 dark:text-purple-400">{tzInfo.nowStr}</b> ({tzInfo.offsetStr}) • Все события пересчитываются автоматически
              </span>
            </div>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-stone-200/80 dark:bg-stone-800 border border-stone-300/80 dark:border-stone-700 font-semibold self-start md:self-center">
            <button
              onClick={() => handleTimezoneChange('default_msk')}
              className={`px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer whitespace-nowrap ${
                effectiveTimezoneMode === 'default_msk'
                  ? 'bg-purple-600 text-white shadow-2xs font-bold'
                  : 'text-stone-700 dark:text-stone-300 hover:text-stone-900'
              }`}
              title="Фиксированное время по Москве (МСК, UTC+3)"
            >
              🇷🇺 МСК (по умолчанию)
            </button>
            <button
              onClick={() => handleTimezoneChange('device_local')}
              className={`px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer whitespace-nowrap ${
                effectiveTimezoneMode === 'device_local'
                  ? 'bg-purple-600 text-white shadow-2xs font-bold'
                  : 'text-stone-700 dark:text-stone-300 hover:text-stone-900'
              }`}
              title="Автоматически учитывать смену часового пояса устройства"
            >
              🌐 Местное время устройства
            </button>
          </div>
        </div>

        {/* 3. HOLIDAYS AUTO-LOADER & COUNTRY SELECTION SWITCHER (powered by date-holidays) */}
        <div className="bg-amber-500/10 dark:bg-stone-800/80 rounded-2xl p-3 border border-amber-500/30 dark:border-stone-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-xl select-none">🎉</span>
            <div>
              <span className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                <span>Государственные праздники:</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-300 font-extrabold text-[11px] border border-amber-400/40">
                  {activeCountryObj.flag} {activeCountryObj.name} ({activeHolidays.length})
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] border border-emerald-400/30">
                  ⚡ date-holidays
                </span>
              </span>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                Официальные нерабочие дни выделяются на календаре и в виджете
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => handleHolidayModeChange('my_country')}
              className={`px-2.5 py-1.5 rounded-xl font-bold transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                holidayMode === 'my_country'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
              }`}
              title="Оставлять праздники своей страны (Россия)"
            >
              <span>🇷🇺</span>
              <span>Моя страна (РФ)</span>
            </button>

            <button
              onClick={() => handleHolidayModeChange('current_location')}
              className={`px-2.5 py-1.5 rounded-xl font-bold transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                holidayMode === 'current_location'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
              }`}
              title="Подгружать праздники страны, где сейчас находитесь"
            >
              <span>📍</span>
              <span>Текущая страна</span>
            </button>

            {/* Custom Country Dropdown Picker */}
            <div className="relative">
              <button
                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                className={`px-2.5 py-1.5 rounded-xl font-bold transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                  holidayMode === 'manual_select'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                }`}
              >
                <span>🏳️</span>
                <span>Выбрать страну</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showCountryDropdown && (
                <div className="absolute right-0 top-full mt-1.5 w-60 max-h-72 overflow-y-auto bg-white dark:bg-stone-900 border border-amber-900/15 dark:border-stone-700 rounded-2xl shadow-xl z-50 p-1.5 space-y-0.5 animate-in fade-in">
                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-stone-400">
                    Авто-загрузка праздников для страны:
                  </div>
                  {SUPPORTED_COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => handleSelectCountry(c.code)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                        activeCountryCode === c.code
                          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold'
                          : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{c.flag}</span>
                        <span>{c.name}</span>
                      </span>
                      {activeCountryCode === c.code && <Check className="w-3.5 h-3.5 text-purple-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QUICK EVENT FORM WITH CATEGORY & TIMEZONE NOTICE */}
      {showQuickForm && (
        <form
          onSubmit={handleQuickSubmit}
          className="bg-white dark:bg-stone-900 border border-purple-400/50 dark:border-purple-500/40 rounded-3xl p-5 shadow-lg space-y-3 animate-in fade-in slide-in-from-top-3 transition-colors"
        >
          <div className="flex items-center justify-between pb-2 border-b border-amber-900/10 dark:border-stone-800">
            <span className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-purple-600" />
              <span>Создать событие в тетради</span>
            </span>
            <button
              type="button"
              onClick={() => setShowQuickForm(false)}
              className="text-xs text-stone-400 hover:text-stone-700 dark:hover:text-white"
            >
              ✕
            </button>
          </div>

          <div>
            <label className="text-[11px] text-stone-500 dark:text-stone-400 block mb-1 font-semibold">
              Название события или встречи:
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Встреча команды, вылет, визит к врачу, день рождения..."
              className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:border-purple-500 font-medium"
              autoFocus
            />
          </div>

          {/* Category Selector with Color Highlights */}
          <div>
            <label className="text-[11px] text-stone-500 dark:text-stone-400 block mb-1 font-semibold">
              Категория события (выделение цветом):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EVENT_CATEGORIES_LIST.map((cat) => {
                const isSelected = newCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setNewCategory(cat.id)}
                    className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? `${cat.badgeClass} ring-2 ring-purple-500/60 shadow-sm scale-102`
                        : 'bg-stone-50 dark:bg-stone-850 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-stone-300'
                    }`}
                  >
                    <span className="text-base select-none">{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-stone-500 dark:text-stone-400 block mb-1 font-semibold">
                Дата события:
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-stone-500 dark:text-stone-400 block mb-1 font-semibold">
                Время ({effectiveTimezoneMode === 'default_msk' ? 'МСК' : 'местное'}):
              </label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-900/10 dark:border-stone-800">
            <span className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">
              Пояс: {tzInfo.label}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowQuickForm(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition active:scale-95 cursor-pointer"
              >
                Сохранить событие в тетрадь
              </button>
            </div>
          </div>
        </form>
      )}

      {/* VIEW TABS: МЕСЯЦ / СПИСОК / ПРАЗДНИКИ */}
      <div className="flex items-center gap-1.5 border-b border-amber-900/10 dark:border-stone-800 pb-2">
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
            activeTab === 'calendar'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>📅 Календарь на месяц</span>
        </button>

        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
            activeTab === 'list'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>📋 Список событий ({eventNotes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('holidays')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
            activeTab === 'holidays'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
          }`}
        >
          <span>🎉</span>
          <span>Праздники {activeCountryObj.flag}</span>
        </button>
      </div>

      {/* TAB 1: MONTH CALENDAR WIDGET & SELECTED DAY INSPECTOR */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          {/* Main Month Widget with Density Workload, Categories & Nearest Event (active timezone applied!) */}
          <CalendarMonthWidget
            notes={notes}
            timezoneMode={effectiveTimezoneMode}
            countryCode={activeCountryCode}
            onOpenNote={onOpenNote}
            selectedDate={selectedDate}
            onSelectDate={(date) => setSelectedDate(date)}
          />

          {/* SELECTED DAY INSPECTOR CARD */}
          <div className="bg-white dark:bg-stone-900 border border-amber-900/15 dark:border-stone-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-amber-900/10 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-purple-500/15 text-purple-700 dark:text-purple-400 font-mono font-bold text-xs">
                  {selectedDate.slice(8, 10)}.{selectedDate.slice(5, 7)}
                </span>
                <div>
                  <h4 className="font-bold text-sm text-stone-900 dark:text-white">
                    {new Date(selectedDate).toLocaleDateString('ru-RU', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </h4>
                  {selectedDateHoliday && (
                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <span>{selectedDateHoliday.emoji || '🎉'}</span>
                      <span>Праздник: {selectedDateHoliday.name}</span>
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={handleOpenAddForSelectedDate}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition active:scale-95 cursor-pointer shadow-2xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить</span>
              </button>
            </div>

            {/* List of events on this day with automatic timezone conversion & category highlights */}
            {selectedDateEvents.length > 0 ? (
              <div className="space-y-2">
                {selectedDateEvents.map((evt) => {
                  const catConfig = EVENT_CATEGORY_CONFIG[evt.eventCategory || 'meeting'];
                  const converted = convertEventToActiveTimezone(evt.eventDate, evt.eventTime, effectiveTimezoneMode);
                  return (
                    <div
                      key={evt.id}
                      onClick={() => onOpenNote(evt)}
                      className={`p-3 rounded-2xl bg-stone-50 hover:bg-stone-100 dark:bg-stone-800/80 dark:hover:bg-stone-800 border ${catConfig.borderClass} border-l-4 flex items-center justify-between gap-3 transition cursor-pointer group`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleEventDone(evt);
                          }}
                          className="text-stone-300 hover:text-purple-600 dark:text-stone-600 dark:hover:text-purple-400 shrink-0 cursor-pointer p-0.5"
                        >
                          {evt.isEventDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-500/20" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-stone-300 dark:border-stone-600" />
                          )}
                        </button>

                        <div className="truncate">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-md text-[10px] font-bold border shadow-2xs ${catConfig.badgeClass}`}>
                              <span>{catConfig.icon}</span>
                              <span>{catConfig.label}</span>
                            </span>
                            {converted.isConverted ? (
                              <span
                                className="px-1.5 py-0.2 rounded-md bg-purple-500/15 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-mono text-[10px] font-bold border border-purple-400/20"
                                title={`Время в оригинале: ${converted.originalMskTime} по МСК`}
                              >
                                {converted.time} (местное) • {converted.originalMskTime} МСК
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded-md bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono text-[10px] font-bold">
                                {converted.time} МСК
                              </span>
                            )}
                          </div>
                          <span
                            className={`font-bold text-xs block truncate ${
                              evt.isEventDone
                                ? 'line-through text-stone-400 dark:text-stone-500'
                                : 'text-stone-900 dark:text-white'
                            }`}
                          >
                            {evt.title || 'Событие без названия'}
                          </span>
                          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-purple-600" />
                            <span>{converted.time} ({effectiveTimezoneMode === 'default_msk' ? 'МСК' : 'местное'})</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-purple-700 dark:text-purple-400 font-bold text-xs shrink-0 group-hover:translate-x-1 transition">
                        <span className="hidden sm:inline">В тетрадь</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center rounded-2xl bg-stone-50/60 dark:bg-stone-850/40 border border-dashed border-stone-300 dark:border-stone-700 text-xs text-stone-500 dark:text-stone-400 space-y-1">
                <p>На этот день нет запланированных встреч и дел.</p>
                <button
                  onClick={handleOpenAddForSelectedDate}
                  className="text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer"
                >
                  + Запланировать встречу или событие
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FULL EVENTS LIST WITH AUTOMATIC TIMEZONE CONVERSION & CATEGORY FILTERS */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 shrink-0 ${
                selectedCategoryFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Все ({eventNotes.length})</span>
            </button>

            {EVENT_CATEGORIES_LIST.map((cat) => {
              const count = eventNotes.filter((n) => (n.eventCategory || 'meeting') === cat.id).length;
              const isSelected = selectedCategoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryFilter(cat.id)}
                  className={`px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 shrink-0 border ${
                    isSelected
                      ? `${cat.badgeClass} ring-2 ring-purple-500/50 shadow-2xs`
                      : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-stone-300'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          {filteredEventNotes.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white dark:bg-stone-900 rounded-3xl border border-amber-900/10 dark:border-stone-800">
              <CalendarIcon className="w-10 h-10 text-stone-400 mx-auto mb-2" />
              <h3 className="font-bold text-base text-stone-900 dark:text-white">
                {selectedCategoryFilter === 'all' ? 'Пока нет событий' : 'Нет событий в этой категории'}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mx-auto mb-4">
                Добавьте важное событие, встречу, дедлайн или праздник с датой и временем.
              </p>
              <button
                onClick={() => {
                  if (selectedCategoryFilter !== 'all') {
                    setNewCategory(selectedCategoryFilter);
                  }
                  setShowQuickForm(true);
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                + Добавить событие
              </button>
            </div>
          ) : (
            filteredEventNotes.map((evt) => {
              const catConfig = EVENT_CATEGORY_CONFIG[evt.eventCategory || 'meeting'];
              const converted = convertEventToActiveTimezone(evt.eventDate, evt.eventTime, effectiveTimezoneMode);
              return (
                <div
                  key={evt.id}
                  onClick={() => onOpenNote(evt)}
                  className={`p-4 rounded-3xl bg-white dark:bg-stone-900 border ${catConfig.borderClass} border-l-4 shadow-sm flex items-center justify-between gap-3 hover:shadow-md transition cursor-pointer group`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleEventDone(evt);
                      }}
                      className="text-stone-400 hover:text-purple-600 shrink-0 cursor-pointer p-0.5"
                    >
                      {evt.isEventDone ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-500/20" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-stone-300 dark:border-stone-600" />
                      )}
                    </button>

                    <div className="truncate">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-2xs ${catConfig.badgeClass}`}>
                          <span>{catConfig.icon}</span>
                          <span>{catConfig.label}</span>
                        </span>
                        {converted.isConverted && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-purple-500/10 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-mono text-[10px] font-bold border border-purple-400/20">
                            {converted.time} (местн.) • {converted.originalMskTime} МСК
                          </span>
                        )}
                      </div>
                      <h4
                        className={`font-bold text-sm truncate ${
                          evt.isEventDone
                            ? 'line-through text-stone-400 dark:text-stone-500'
                            : 'text-stone-900 dark:text-white'
                        }`}
                      >
                        {evt.title || 'Событие'}
                      </h4>
                      <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2 mt-0.5 font-mono flex-wrap">
                        <span>📅 {converted.date}</span>
                        <span>•</span>
                        <span>⏰ {converted.time} ({effectiveTimezoneMode === 'default_msk' ? 'МСК' : 'местное'})</span>
                        {converted.dateShifted && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-sans font-bold">
                            (дата пересчитана из-за пояса)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {evt.reminderEnabled && (
                      <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
                        <Bell className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <ArrowRight className="w-4 h-4 text-purple-600 group-hover:translate-x-1 transition" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: HOLIDAYS LIST FOR SELECTED COUNTRY */}
      {activeTab === 'holidays' && (
        <div className="bg-white dark:bg-stone-900 border border-amber-900/15 dark:border-stone-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
            <div>
              <h3 className="font-bold text-base text-stone-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>{activeCountryObj.flag}</span>
                <span>Официальные праздники: {activeCountryObj.name}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] border border-emerald-400/40">
                  ⚡ Библиотека date-holidays
                </span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Всего {activeHolidays.length} государственных праздников и памятных дат для выбранной страны
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {activeHolidays.map((h, i) => (
              <div
                key={i}
                className="p-3 rounded-2xl bg-stone-50/80 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-750 flex items-center gap-3"
              >
                <span className="text-2xl select-none">{h.emoji || '🎉'}</span>
                <div className="min-w-0">
                  <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-400 block">
                    {h.date.slice(3, 5)}.{h.date.slice(0, 2)}
                  </span>
                  <span className="font-bold text-xs text-stone-900 dark:text-white block truncate">
                    {h.name}
                  </span>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400">
                    {h.isOfficialNonWorking ? 'Официальный выходной день' : 'Памятная дата'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
