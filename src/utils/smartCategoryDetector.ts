import { EventCategory, NoteCalculationSummary, NoteCategory } from '../types';

export type SmartSuggestedCategory = 'payment' | 'shopping' | 'event';

export interface SmartCategorySuggestion {
  category: SmartSuggestedCategory;
  label: 'Финансы' | 'Покупки' | 'Событие';
  reason: string;
  confidence: 'high' | 'medium';
  score: number;
  extractedEventDate?: string;
  extractedEventTime?: string;
  extractedEventSubcategory?: EventCategory;
}

export interface SmartCategorySignals {
  calcSummary?: NoteCalculationSummary;
  shoppingItemsCount?: number;
  now?: Date;
}

const FINANCE_KEYWORDS: RegExp[] = [
  /зарплат|аванс|преми[яюи]|оклад|стипенд/i,
  /бюджет|финанс|баланс|остаток|накоплен|сбережен|вклад|депозит/i,
  /расход|доход|прибыл|трат[аыу]|выручк/i,
  /оплат[аиуь]|плат[ёе]ж|сч[ёе]т|квитанц|налог|штраф|пошлин/i,
  /аренд|квартплат|коммуналк|жкх|ипотек|кредит|рассрочк|долг/i,
  /перевод|карт[аеуы]|наличн|кэшбэк|кешбэк|подписк|тариф|страховк/i,
  /бензин|топлив|парковк|проезд|такси|интернет|связь/i,
  /\b(?:salary|budget|expense|expenses|income|rent|invoice|payment|finance|tax|bill)\b/i,
];

const SHOPPING_KEYWORDS: RegExp[] = [
  /список\s+покупок|покупк[аиу]|купить|докупить|закупк|заказать|в\s+корзин/i,
  /магазин|супермаркет|гипермаркет|рынок|аптек|ларь?к|доставк/i,
  /озон|ozon|вайлдберриз|wildberries|\bwb\b|вкусвилл|пят[ёе]рочк|магнит|лента|ашан|перекр[ёе]сток|самокат|яндекс\s+лавк/i,
  /продукт[ыов]?|молоко|кефир|творог|сметан|йогурт|сыр|масло|яйц/i,
  /хлеб|батон|булочк|выпечк|мук[аи]|сахар|соль|круп[аы]|гречк|рис|макарон/i,
  /мясо|куриц|индейк|говядин|свинин|фарш|колбас|сосиск|рыб[ауы]/i,
  /овощ|фрукт|картошк|картофел|помидор|томат|огурц|лук|морков|капуст|яблок|банан|лимон|апельсин/i,
  /кофе|чай|вода|сок|лимонад|шоколад|печенье|конфет|снек/i,
  /шампунь|мыло|гель|порошок|салфетк|бумаг[аи]\s+туалет|пакет[ыов]?|зубн(?:ая|ую)\s+паст|бытов(?:ая|ой)\s+хим/i,
  /\b(?:shopping|groceries|grocery|supermarket|buy|milk|bread|eggs|cheese|fruits|vegetables)\b/i,
];

const EVENT_KEYWORDS: RegExp[] = [
  /встреч[аиуе]|созвон|звонок|митинг|совещан|переговор|интервью|собеседован/i,
  /дедлайн|срок\s+сдач|успеть\s+до|сдать\s+до|крайн(?:ий|его)\s+срок/i,
  /при[ёе]м\s+(?:у|к)|запись\s+(?:к|на)|врач|стоматолог|доктор|поликлиник|анализ|клиник|парикмахер|салон/i,
  /день\s+рождения|(?<![а-яёa-z0-9])др(?![а-яёa-z0-9])|юбилей|праздник|вечеринк|свадьб|корпоратив|банкет/i,
  /поездк[аиу]|рейс|вылет|прил[ёе]т|аэропорт|поезд|вокзал|билет|отель|гостиниц|отпуск|командировк|тур/i,
  /концерт|театр|кино|выставк|экзамен|зач[ёе]т|вебинар|лекци[яию]|тренировк|секци[яи]|мероприят|свидан|визит/i,
  /напомн|будильник|не\s+забыть|расписан|планерк|план[ёе]рк/i,
  /\b(?:meeting|call|deadline|appointment|doctor|flight|birthday|party|concert|exam|webinar|event|trip)\b/i,
];

const RUSSIAN_MONTHS: Record<string, number> = {
  январ: 0,
  феврал: 1,
  март: 2,
  апрел: 3,
  ма: 4, // мая / май
  июн: 5,
  июл: 6,
  август: 7,
  сентябр: 8,
  октябр: 9,
  ноябр: 10,
  декабр: 11,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function extractEventMetadata(
  text: string,
  now: Date
): {
  date?: string;
  time?: string;
  subcategory?: EventCategory;
  hasExplicitDate: boolean;
  hasExplicitTime: boolean;
  hasRelativeDate: boolean;
} {
  let date: string | undefined;
  let time: string | undefined;
  let hasExplicitDate = false;
  let hasExplicitTime = false;
  let hasRelativeDate = false;

  const lower = text.toLowerCase();

  // 1. ISO date YYYY-MM-DD
  const isoMatch = text.match(/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    hasExplicitDate = true;
  }

  // 2. DD.MM.YYYY or DD.MM
  if (!date) {
    const dotMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])\.(0?[1-9]|1[0-2])(?:\.(20\d{2}|\d{2}))?\b/);
    if (dotMatch) {
      const day = Number(dotMatch[1]);
      const month = Number(dotMatch[2]);
      let year = now.getFullYear();
      if (dotMatch[3]) {
        year = dotMatch[3].length === 2 ? 2000 + Number(dotMatch[3]) : Number(dotMatch[3]);
      }
      date = `${year}-${pad2(month)}-${pad2(day)}`;
      hasExplicitDate = true;
    }
  }

  // 3. Russian day + month ("25 ноября", "5 мая")
  if (!date) {
    const ruMonthMatch = lower.match(
      /(?<![\dа-яёa-z])([1-9]|[12]\d|3[01])\s+(январ[яь]|феврал[яь]|март[а]?|апрел[яь]|ма[яй]|июн[яь]|июл[яь]|август[а]?|сентябр[яь]|октябр[яь]|ноябр[яь]|декабр[яь])(?![а-яёa-z])/
    );
    if (ruMonthMatch) {
      const day = Number(ruMonthMatch[1]);
      const monthWord = ruMonthMatch[2];
      const monthKey = Object.keys(RUSSIAN_MONTHS).find((k) => monthWord.startsWith(k));
      if (monthKey !== undefined) {
        const monthIdx = RUSSIAN_MONTHS[monthKey];
        const candidate = new Date(now.getFullYear(), monthIdx, day);
        date = formatDateIso(candidate);
        hasExplicitDate = true;
      }
    }
  }

  // 4. Relative Russian/English date words
  if (!date) {
    if (/(?<![а-яёa-z])послезавтра(?![а-яёa-z])/.test(lower)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 2);
      date = formatDateIso(d);
      hasRelativeDate = true;
    } else if (/(?<![а-яёa-z])завтра(?![а-яёa-z])|\btomorrow\b/.test(lower)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      date = formatDateIso(d);
      hasRelativeDate = true;
    } else if (
      /(?<![а-яёa-z])сегодня\s+(?:в|вечером|утром|дн[ёе]м)(?![а-яёa-z])|\btoday\s+at\b/.test(
        lower
      )
    ) {
      date = formatDateIso(now);
      hasRelativeDate = true;
    }
  }

  if (
    !hasRelativeDate &&
    /(?<![а-яёa-z])(?:в\s+(?:понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)|на\s+следующей\s+неделе|через\s+(?:час|пару\s+часов|день|неделю))(?![а-яёa-z])/.test(
      lower
    )
  ) {
    hasRelativeDate = true;
  }

  // 5. Time HH:MM
  const hhmmMatch = text.match(/(?:^|[\s,(в])([01]?\d|2[0-3]):([0-5]\d)(?:\b|$)/i);
  if (hhmmMatch) {
    time = `${pad2(Number(hhmmMatch[1]))}:${hhmmMatch[2]}`;
    hasExplicitTime = true;
  } else {
    const hourWordMatch = lower.match(
      /(?<![а-яёa-z])в\s+([01]?\d|2[0-3])\s*(?:час(?:а|ов)?|утр[а]?|дн[я]|вечер[а]?)(?![а-яёa-z])/
    );
    if (hourWordMatch) {
      let hr = Number(hourWordMatch[1]);
      if (/вечер/.test(hourWordMatch[0]) && hr >= 1 && hr <= 11) {
        hr += 12;
      }
      time = `${pad2(hr)}:00`;
      hasExplicitTime = true;
    }
  }

  // 6. Infer event subcategory
  let subcategory: EventCategory | undefined;
  if (/день\s+рождения|(?<![а-яёa-z0-9])др(?![а-яёa-z0-9])|юбилей|birthday/i.test(lower)) {
    subcategory = 'birthday';
  } else if (/поездк|рейс|вылет|аэропорт|поезд|вокзал|отель|отпуск|командировк|flight|trip/i.test(lower)) {
    subcategory = 'trip';
  } else if (/дедлайн|срок\s+сдач|крайн(?:ий|его)\s+срок|deadline/i.test(lower)) {
    subcategory = 'deadline';
  } else if (/праздник|вечеринк|свадьб|корпоратив|концерт|party|holiday/i.test(lower)) {
    subcategory = 'holiday';
  } else if (/встреч|созвон|звонок|митинг|совещан|переговор|при[ёе]м|врач|стоматолог|meeting|appointment/i.test(lower)) {
    subcategory = 'meeting';
  }

  return {
    date,
    time,
    subcategory,
    hasExplicitDate,
    hasExplicitTime,
    hasRelativeDate,
  };
}

function normalizeCurrentCategory(category: NoteCategory): SmartSuggestedCategory | 'note' {
  if (category === 'payment' || category === 'budget' || category === 'calculation') {
    return 'payment';
  }
  if (category === 'shopping') return 'shopping';
  if (category === 'event') return 'event';
  return 'note';
}

function countKeywordHits(text: string, patterns: RegExp[]): number {
  let hits = 0;
  for (const re of patterns) {
    if (re.test(text)) hits++;
  }
  return hits;
}

/**
 * Analyzes note title, body text, and structural signals in real time
 * to suggest the most fitting category ('Финансы', 'Покупки', or 'Событие').
 * Returns null when the text has insufficient signal or already belongs to the detected category.
 */
export function detectSmartCategory(
  title: string,
  content: string,
  currentCategory: NoteCategory,
  signals: SmartCategorySignals = {}
): SmartCategorySuggestion | null {
  const combined = `${title}\n${content}`.trim();
  if (combined.length < 4) return null;

  const titleTrimmed = title.trim();
  const now = signals.now ?? new Date();
  const { calcSummary, shoppingItemsCount = 0 } = signals;

  // --- 1. Score "Финансы" (payment) ---
  let financeScore = 0;
  let financeHasMoneySignal = false;
  let financeHasCalcSignal = false;

  const financeHits = countKeywordHits(combined, FINANCE_KEYWORDS);
  const financeTitleHits = countKeywordHits(titleTrimmed, FINANCE_KEYWORDS);
  financeScore += Math.min(financeHits * 2.2, 7.5);
  if (financeTitleHits > 0) financeScore += 2.2;

  const hasCurrencyWithNumber =
    /(?:\d[\d\s.,]*\s*(?:₽|руб\.?|р\.|\$|€|usd|eur|тыс\.?|т\.р\.)|(?:₽|\$|€)\s*\d)/i.test(combined);
  if (hasCurrencyWithNumber) {
    financeScore += 3.5;
    financeHasMoneySignal = true;
  }

  const hasSignedMoneyLines = /(?:^|\n)\s*[-+−]\s*[^:\n]{0,40}?\d[\d\s]*(?:[.,]\d+)?/m.test(content) ||
    /(?:^|\n)[^:\n]{1,40}:\s*[-+−]?\s*\(?\d[\d\s]*[\d)]/m.test(content);
  if (hasSignedMoneyLines) {
    financeScore += 2.5;
    financeHasCalcSignal = true;
  }

  if (calcSummary) {
    if (calcSummary.hasIncomeExpenseSplit) {
      financeScore += 4.5;
      financeHasMoneySignal = true;
      financeHasCalcSignal = true;
    } else if (calcSummary.totalIncome > 0 || calcSummary.totalExpenses > 0) {
      financeScore += 3.2;
      financeHasMoneySignal = true;
    } else if (calcSummary.totalCalculatedLines >= 2 && calcSummary.lines.some((l) => l.lineKind === 'money')) {
      financeScore += 3.5;
      financeHasMoneySignal = true;
    } else if (calcSummary.totalCalculatedLines >= 2) {
      financeScore += 1.8;
      financeHasCalcSignal = true;
    }
  }

  // --- 2. Score "Покупки" (shopping) ---
  let shoppingScore = 0;
  const shoppingHits = countKeywordHits(combined, SHOPPING_KEYWORDS);
  const shoppingTitleHits = countKeywordHits(titleTrimmed, SHOPPING_KEYWORDS);
  shoppingScore += Math.min(shoppingHits * 2.3, 8.5);
  if (shoppingTitleHits > 0) shoppingScore += 2.5;

  const unitMatches = combined.match(
    /(?<![\dа-яёa-z])\d+(?:[.,]\d+)?\s*(?:кг|г|гр|л|мл|шт|уп|пачк[аиу]?|бут|бан(?:ка|ок|ки)|рулон)(?![а-яёa-z])/gi
  );
  const hasUnits = Boolean(unitMatches && unitMatches.length > 0);
  if (unitMatches) {
    shoppingScore += Math.min(unitMatches.length * 1.8, 4.5);
  }

  if (shoppingItemsCount >= 3) {
    shoppingScore += 4.5;
  } else if (shoppingItemsCount === 2) {
    shoppingScore += 3.2;
  } else if (shoppingItemsCount === 1 && (shoppingHits > 0 || hasUnits)) {
    shoppingScore += 1.5;
  }

  // Grocery lists with prices shouldn't be hijacked by finance unless strong budget/income words are present
  if (shoppingScore >= 5.5 && financeHits === 0 && !(calcSummary?.hasIncomeExpenseSplit)) {
    financeScore = Math.max(0, financeScore - 2.5);
  }

  // --- 3. Score "Событие" (event) ---
  let eventScore = 0;
  const eventHits = countKeywordHits(combined, EVENT_KEYWORDS);
  const eventTitleHits = countKeywordHits(titleTrimmed, EVENT_KEYWORDS);
  eventScore += Math.min(eventHits * 2.4, 8.0);
  if (eventTitleHits > 0) eventScore += 2.4;

  const eventMeta = extractEventMetadata(combined, now);
  if (eventMeta.hasExplicitDate) eventScore += 3.5;
  if (eventMeta.hasExplicitTime) eventScore += 3.0;
  if (eventMeta.hasRelativeDate) eventScore += 2.5;

  // Pick the strongest candidate
  const candidates: Array<{
    category: SmartSuggestedCategory;
    label: 'Финансы' | 'Покупки' | 'Событие';
    score: number;
    reason: string;
  }> = [
    {
      category: 'payment',
      label: 'Финансы',
      score: financeScore,
      reason: financeHasMoneySignal && financeHasCalcSignal
        ? 'Найдены суммы, доходы и расчёты'
        : financeHasMoneySignal
        ? 'Найдены денежные суммы и платежи'
        : 'Обнаружены финансовые термины и расчёты',
    },
    {
      category: 'shopping',
      label: 'Покупки',
      score: shoppingScore,
      reason:
        shoppingItemsCount >= 2
          ? `Распознан список покупок (${shoppingItemsCount} поз.)`
          : hasUnits
          ? 'Найдены товары и единицы измерения'
          : 'Обнаружены названия продуктов и магазинов',
    },
    {
      category: 'event',
      label: 'Событие',
      score: eventScore,
      reason:
        eventMeta.hasExplicitDate && eventMeta.hasExplicitTime
          ? 'Найдены дата и время события'
          : eventMeta.hasExplicitDate || eventMeta.hasRelativeDate
          ? 'Обнаружена дата или напоминание о планах'
          : eventMeta.hasExplicitTime
          ? 'Указано время встречи или дела'
          : 'Обнаружены слова о встрече или событии',
    },
  ];

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const second = candidates[1];

  const MIN_THRESHOLD = 3.5;
  if (best.score < MIN_THRESHOLD) return null;

  // Avoid flickering suggestions when two categories are virtually tied at low confidence
  if (best.score < 5.5 && best.score - second.score < 0.8) {
    return null;
  }

  const normalizedCurrent = normalizeCurrentCategory(currentCategory);
  if (normalizedCurrent === best.category) {
    return null;
  }

  return {
    category: best.category,
    label: best.label,
    reason: best.reason,
    confidence: best.score >= 6.0 ? 'high' : 'medium',
    score: Number(best.score.toFixed(1)),
    ...(best.category === 'event'
      ? {
          extractedEventDate: eventMeta.date,
          extractedEventTime: eventMeta.time,
          extractedEventSubcategory: eventMeta.subcategory,
        }
      : {}),
  };
}
