import React, { useState } from 'react';
import { NoteCategory, PaperStyleType } from '../types';
import {
  X,
  Sparkles,
  Wallet,
  ShoppingCart,
  Car,
  HeartPulse,
  Luggage,
  CheckSquare,
  ArrowRight,
  GraduationCap,
  Briefcase,
  Users,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react';

export interface NoteTemplate {
  id: string;
  title: string;
  category: NoteCategory;
  paperStyle: PaperStyleType;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  content: string;
}

export const CUSTOM_TEMPLATES_STORAGE_KEY = 'notebook_smart_custom_templates_v1';

interface StoredCustomTemplate {
  id: string;
  title: string;
  description: string;
  category: NoteCategory;
  paperStyle: PaperStyleType;
  content: string;
}

function loadCustomTemplates(): StoredCustomTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredCustomTemplate[]) : [];
  } catch {
    return [];
  }
}

export const EVERYDAY_TEMPLATES: NoteTemplate[] = [
  {
    id: 'tpl-blank-sheet',
    title: '📄 Пустой лист',
    category: 'note',
    paperStyle: 'grid',
    description: 'Чистая страница тетради в клетку для свободных записей и расчётов',
    icon: FileText,
    iconColor: 'text-stone-700 dark:text-stone-300',
    iconBg: 'bg-stone-100 dark:bg-stone-800',
    content: '',
  },
  {
    id: 'tpl-budget-monthly',
    title: '💰 Семейный бюджет и коммуналка',
    category: 'payment',
    paperStyle: 'grid',
    description: 'Учет зарплаты, аванса, аренды, ЖКХ, интернета и расчет остатка',
    icon: Wallet,
    iconColor: 'text-emerald-700 dark:text-emerald-400',
    iconBg: 'bg-emerald-100 dark:bg-emerald-500/20',
    content: `Учет финансов за текущий месяц:

=== Доходы (Прибыль) ===
+ Зарплата основная: 110 000 руб
+ Аванс: 30 000
+ Премия / Подработка: 15 000
+ Кэшбэк и проценты: 2 400

=== Расходы (Обязательные платежи) ===
- Аренда / Ипотека: 38 000 руб
- Коммунальные услуги (ЖКХ): 4 500 + 800
- Интернет и мобильная связь: 650 + 900
- Продукты на месяц: 1 200 * 22
- Проездной / Бензин: 5 000
- Подписки и сервисы: 299 + 399 + 199

Остаток в итоге (чистая прибыль):`,
  },
  {
    id: 'tpl-groceries-standard',
    title: '🛒 Базовый закуп продуктов (Холодильник)',
    category: 'shopping',
    paperStyle: 'lines',
    description: 'Готовый список молочных продуктов, мяса, овощей и бакалеи на неделю',
    icon: ShoppingCart,
    iconColor: 'text-amber-700 dark:text-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-500/20',
    content: `Список продуктов в тетради:
- [ ] Молоко 3.2% 2 л
- [ ] Сливочное масло 82.5% 1 уп
- [ ] Яйца куриные С0 1 дес
- [ ] Творог 5% 400 г
- [ ] Сыр твердый 350 г
- [ ] Хлеб цельнозерновой 1 шт
- [ ] Филе индейки или курицы 1.5 кг
- [ ] Помидоры и огурцы 1.2 кг
- [ ] Бананы и яблоки 2 кг
- [ ] Кофе зерновой 500 г
- [ ] Чай листовой 1 пачка
- [ ] Макароны твердых сортов 2 уп
- [ ] Оливковое масло 500 мл

Сладости и десерт:
Шоколад: 130 * 2
Круассаны: 75 * 4`,
  },
  {
    id: 'tpl-car-expenses',
    title: '🚗 Расходы на автомобиль и транспорт',
    category: 'payment',
    paperStyle: 'grid',
    description: 'Бензин, платные дороги, мойка, страховка, парковка и ТО',
    icon: Car,
    iconColor: 'text-blue-700 dark:text-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-500/20',
    content: `Расчет авто-расходов:

=== Доходы на транспорт ===
+ Компенсация ГСМ от работы: 12 000 руб

=== Расходы на авто ===
- Бензин АИ-95 (полный бак): 58 * 50
- Мойка и комплексная чистка: 1 200
- Оплата парковки за месяц: 4 500
- Омывающая жидкость: 350 * 2
- Замена масла и фильтров: 6 800

Остаток бюджета на авто:`,
  },
  {
    id: 'tpl-health-pharmacy',
    title: '💊 Аптечка, здоровье и витамины',
    category: 'shopping',
    paperStyle: 'dots',
    description: 'Витаминный комплекс, базовые медикаменты и запись к врачу',
    icon: HeartPulse,
    iconColor: 'text-rose-700 dark:text-rose-400',
    iconBg: 'bg-rose-100 dark:bg-rose-500/20',
    content: `Здоровье и профилактика:
- [ ] Витамин D3 2000 ME
- [ ] Омега-3 1000 мг 1 банка
- [ ] Магний B6 1 уп
- [ ] Пластырь бактерицидный
- [ ] Спрей для носа с морской водой
- [ ] Антисептик для рук

Запись на прием и анализы:
15:00 — Стоматолог (профгигиена): 4500 руб
Анализы крови: 2300 + 850

Итого на здоровье:`,
  },
  {
    id: 'tpl-travel-packing',
    title: '✈️ Чеклист сборов в поездку и отпуск',
    category: 'event',
    paperStyle: 'kraft',
    description: 'Документы, техника, одежда, аптечка и план расходов в дороге',
    icon: Luggage,
    iconColor: 'text-purple-700 dark:text-purple-400',
    iconBg: 'bg-purple-100 dark:bg-purple-500/20',
    content: `План путешествия:

Документы и билеты:
- [ ] Паспорт РФ и загранпаспорт
- [ ] Посадочные талоны и бронь отеля
- [ ] Банковские карты и наличные

Техника и гаджеты:
- [ ] Смартфон и кабель зарядки
- [ ] Powerbank заряженный 10000 mAh
- [ ] Наушники

Расходы в поездке:
Отель: 4500 * 3
Билеты на поезд / самолет: 14200
Такси в аэропорт: 1450
Питание в дороге: 1200 * 3

Итого бюджет поездки:`,
  },
  {
    id: 'tpl-daily-habits',
    title: '🎯 Ежедневный трекер целей и привычек',
    category: 'note',
    paperStyle: 'dots',
    description: 'Утренний ритуал, спорт, чтение, вода и планирование дня',
    icon: CheckSquare,
    iconColor: 'text-emerald-700 dark:text-emerald-400',
    iconBg: 'bg-emerald-100 dark:bg-emerald-500/20',
    content: `Трекер привычек на сегодня:
- [ ] Выпить стакан теплой воды после пробуждения
- [ ] Утренняя зарядка и растяжка 15 мин
- [ ] Чтение книги 25 страниц
- [ ] Прогулка на свежем воздухе 6 000 шагов
- [ ] Записать расходы за день в NotebookSmart
- [ ] Лечь спать до 23:30

Главная задача дня:
Подготовить и согласовать отчет по проекту`,
  },
  {
    id: 'tpl-student-study',
    title: '🎓 Студент: лекции, зачёты и стипендия',
    category: 'note',
    paperStyle: 'lines',
    description: 'Сценарий «Студент»: конспект, дедлайны по предметам и студенческий бюджет',
    icon: GraduationCap,
    iconColor: 'text-indigo-700 dark:text-indigo-400',
    iconBg: 'bg-indigo-100 dark:bg-indigo-500/20',
    content: `Учебная неделя и дедлайны:
- [ ] Сдать лабораторную работу по алгоритмам
- [ ] Подготовить конспект к семинару
- [ ] Повторить билеты к зачёту (главы 1–4)

Ключевые тезисы лекции:
• Основная идея:
• Вопросы преподавателю:

Студенческий бюджет:
+ Стипендия: 8 500 руб
- Проездной: 1 200
- Учебники и печать: 650
- Обеды в столовой: 350 * 5

Остаток на неделю:`,
  },
  {
    id: 'tpl-freelancer-project',
    title: '💼 Фрилансер: заказы, смета и задачи',
    category: 'payment',
    paperStyle: 'grid',
    description: 'Сценарий «Фрилансер»: учёт клиентских проектов, часов работы и налогов',
    icon: Briefcase,
    iconColor: 'text-teal-700 dark:text-teal-400',
    iconBg: 'bg-teal-100 dark:bg-teal-500/20',
    content: `Проект / Клиент:

Этапы и задачи:
- [ ] Согласовать ТЗ и сроки с заказчиком
- [ ] Сдать первый прототип / черновик
- [ ] Внести правки и выставить финальный счёт

Финансы по проекту:
+ Предоплата (50%): 25 000 руб
+ Финальный платёж: 25 000 руб
- Налог самозанятого (6%): 50000 * 6%
- Подписки и инструменты: 1 900

Чистый доход:`,
  },
  {
    id: 'tpl-meeting-minutes',
    title: '🤝 Совещание: участники, решения, action items',
    category: 'event',
    paperStyle: 'lines',
    description: 'Структурированный протокол встречи с ответственными и задачами',
    icon: Users,
    iconColor: 'text-sky-700 dark:text-sky-400',
    iconBg: 'bg-sky-100 dark:bg-sky-500/20',
    content: `Протокол совещания:

Участники:
• 

Повестка и обсуждение:
1. 
2. 

Принятые решения:
• 

Action items (задачи):
- [ ] Задача 1 — ответственный / срок
- [ ] Задача 2 — ответственный / срок`,
  },
];

interface QuickTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (tpl: NoteTemplate) => void;
}

export const QuickTemplatesModal: React.FC<QuickTemplatesModalProps> = ({
  isOpen,
  onClose,
  onApplyTemplate,
}) => {
  const [customTemplates, setCustomTemplates] = useState<StoredCustomTemplate[]>(() =>
    loadCustomTemplates()
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<NoteCategory>('note');

  if (!isOpen) return null;

  const handleSaveCustomTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;

    const created: StoredCustomTemplate = {
      id: `custom-tpl-${Date.now()}`,
      title: trimmedTitle,
      description: 'Мой пользовательский шаблон',
      category: newCategory,
      paperStyle: 'grid',
      content: newContent,
    };

    const next = [created, ...customTemplates];
    setCustomTemplates(next);
    try {
      localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
    setNewTitle('');
    setNewContent('');
    setShowCreateForm(false);
  };

  const handleDeleteCustomTemplate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = customTemplates.filter((t) => t.id !== id);
    setCustomTemplates(next);
    try {
      localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 dark:bg-black/80 backdrop-blur-md p-4 safe-top safe-bottom transition-colors"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-stone-900 border border-amber-900/15 dark:border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-stone-900 dark:text-stone-100 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#fcfaf7] dark:bg-stone-950 border-b border-amber-900/10 dark:border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-stone-900 dark:text-white">
                Шаблоны страниц
              </h3>
              <p className="text-[11px] text-stone-600 dark:text-stone-400">
                Готовые сценарии и ваши собственные шаблоны
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Свой</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть окно шаблонов"
              className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Custom template creator form (DS R-SOC-02) */}
        {showCreateForm && (
          <form
            onSubmit={handleSaveCustomTemplate}
            className="p-4 bg-amber-50/60 dark:bg-stone-950 border-b border-amber-900/10 dark:border-stone-800 space-y-2.5"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Название шаблона (например, Стендап)"
                className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold outline-none focus:border-amber-500"
                required
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as NoteCategory)}
                aria-label="Категория шаблона"
                className="px-2.5 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold"
              >
                <option value="note">Заметка</option>
                <option value="payment">Финансы</option>
                <option value="shopping">Покупки</option>
                <option value="event">Событие</option>
              </select>
            </div>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              placeholder="Текст шаблона (поддерживаются чекбоксы - [ ] и формулы)..."
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs outline-none focus:border-amber-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
              >
                Сохранить шаблон
              </button>
            </div>
          </form>
        )}

        {/* Templates list */}
        <div className="p-4 overflow-y-auto space-y-3">
          {customTemplates.length > 0 && (
            <div className="space-y-2 pb-2 border-b border-stone-200 dark:border-stone-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 px-1">
                Мои шаблоны ({customTemplates.length})
              </span>
              {customTemplates.map((ct) => {
                const asTemplate: NoteTemplate = {
                  ...ct,
                  icon: FileText,
                  iconColor: 'text-amber-700 dark:text-amber-400',
                  iconBg: 'bg-amber-100 dark:bg-amber-500/20',
                };
                return (
                  <div
                    key={ct.id}
                    onClick={() => {
                      onApplyTemplate(asTemplate);
                      onClose();
                    }}
                    className="group p-3 rounded-2xl border border-amber-300/60 dark:border-amber-700/40 bg-amber-50/40 dark:bg-stone-950/70 hover:border-amber-500 transition cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-stone-900 dark:text-white truncate">
                          {ct.title}
                        </h4>
                        <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-1">
                          {ct.content.split('\n')[0] || 'Пользовательский шаблон'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCustomTemplate(e, ct.id)}
                      aria-label={`Удалить шаблон ${ct.title}`}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {EVERYDAY_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;

            return (
              <div
                key={tpl.id}
                onClick={() => {
                  onApplyTemplate(tpl);
                  onClose();
                }}
                className="group p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#fffdfa] dark:bg-stone-950/70 hover:border-amber-500/60 dark:hover:border-amber-500/40 hover:shadow-md transition cursor-pointer flex items-center justify-between gap-3 active:scale-99"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-2xl ${tpl.iconBg} ${tpl.iconColor} flex items-center justify-center shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-stone-900 dark:text-white group-hover:text-amber-800 dark:group-hover:text-amber-300 transition truncate">
                      {tpl.title}
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-1 mt-0.5">
                      {tpl.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 shrink-0">
                  <span className="hidden sm:inline">Применить</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
