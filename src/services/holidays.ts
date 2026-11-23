import Holidays from 'date-holidays';

export interface Holiday {
  date: string; // MM-DD format, e.g. "01-01" or "05-09"
  fullDate?: string; // YYYY-MM-DD
  name: string;
  isOfficialNonWorking: boolean;
  countryCode: string;
  emoji?: string;
  type?: string;
}

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
  timezones: string[];
}

export const SUPPORTED_COUNTRIES: CountryOption[] = [
  { code: 'RU', name: 'Россия', flag: '🇷🇺', timezones: ['Europe/Moscow', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Novosibirsk', 'Asia/Krasnoyarsk', 'Asia/Irkutsk', 'Asia/Yakutsk', 'Asia/Vladivostok'] },
  { code: 'BY', name: 'Беларусь', flag: '🇧🇾', timezones: ['Europe/Minsk'] },
  { code: 'KZ', name: 'Казахстан', flag: '🇰🇿', timezones: ['Asia/Almaty', 'Asia/Aqtau', 'Asia/Aqtobe', 'Asia/Atyrau', 'Asia/Oral', 'Asia/Qostanay', 'Asia/Qyzylorda'] },
  { code: 'AM', name: 'Армения', flag: '🇦🇲', timezones: ['Asia/Yerevan'] },
  { code: 'GE', name: 'Грузия', flag: '🇬🇪', timezones: ['Asia/Tbilisi'] },
  { code: 'TR', name: 'Турция', flag: '🇹🇷', timezones: ['Europe/Istanbul'] },
  { code: 'AE', name: 'ОАЭ', flag: '🇦🇪', timezones: ['Asia/Dubai'] },
  { code: 'DE', name: 'Германия', flag: '🇩🇪', timezones: ['Europe/Berlin'] },
  { code: 'US', name: 'США', flag: '🇺🇸', timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'] },
  { code: 'UZ', name: 'Узбекистан', flag: '🇺🇿', timezones: ['Asia/Tashkent', 'Asia/Samarkand'] },
  { code: 'RS', name: 'Сербия', flag: '🇷🇸', timezones: ['Europe/Belgrade'] },
  { code: 'TH', name: 'Таиланд', flag: '🇹🇭', timezones: ['Asia/Bangkok'] },
  { code: 'FR', name: 'Франция', flag: '🇫🇷', timezones: ['Europe/Paris'] },
  { code: 'IT', name: 'Италия', flag: '🇮🇹', timezones: ['Europe/Rome'] },
  { code: 'ES', name: 'Испания', flag: '🇪🇸', timezones: ['Europe/Madrid'] },
  { code: 'GB', name: 'Великобритания', flag: '🇬🇧', timezones: ['Europe/London'] },
  { code: 'CN', name: 'Китай', flag: '🇨🇳', timezones: ['Asia/Shanghai'] },
];

/**
 * Fallback static public holidays for offline/safety resilience
 */
export const COUNTRY_HOLIDAYS_FALLBACK: Record<string, Holiday[]> = {
  RU: [
    { date: '01-01', name: 'Новый год', isOfficialNonWorking: true, countryCode: 'RU', emoji: '🎄' },
    { date: '01-02', name: 'Новогодние каникулы', isOfficialNonWorking: true, countryCode: 'RU', emoji: '❄️' },
    { date: '01-03', name: 'Новогодние каникулы', isOfficialNonWorking: true, countryCode: 'RU', emoji: '❄️' },
    { date: '01-04', name: 'Новогодние каникулы', isOfficialNonWorking: true, countryCode: 'RU', emoji: '❄️' },
    { date: '01-05', name: 'Новогодние каникулы', isOfficialNonWorking: true, countryCode: 'RU', emoji: '❄️' },
    { date: '01-06', name: 'Новогодние каникулы', isOfficialNonWorking: true, countryCode: 'RU', emoji: '❄️' },
    { date: '01-07', name: 'Рождество Христово', isOfficialNonWorking: true, countryCode: 'RU', emoji: '⭐' },
    { date: '01-08', name: 'Новогодние каникулы', isOfficialNonWorking: true, countryCode: 'RU', emoji: '❄️' },
    { date: '02-23', name: 'День защитника Отечества', isOfficialNonWorking: true, countryCode: 'RU', emoji: '🛡️' },
    { date: '03-08', name: 'Международный женский день', isOfficialNonWorking: true, countryCode: 'RU', emoji: '💐' },
    { date: '05-01', name: 'Праздник Весны и Труда', isOfficialNonWorking: true, countryCode: 'RU', emoji: '🌸' },
    { date: '05-09', name: 'День Победы', isOfficialNonWorking: true, countryCode: 'RU', emoji: '🎖️' },
    { date: '06-12', name: 'День России', isOfficialNonWorking: true, countryCode: 'RU', emoji: '🇷🇺' },
    { date: '11-04', name: 'День народного единства', isOfficialNonWorking: true, countryCode: 'RU', emoji: '🤝' },
  ],
};

function getHolidayEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('новогод') || n.includes('новый год') || n.includes('new year') || n.includes('neujahr') || n.includes('silvester')) return '🎄';
  if (n.includes('рождеств') || n.includes('christmas') || n.includes('weihnacht') || n.includes('божић')) return '⭐';
  if (n.includes('побед') || n.includes('victory') || n.includes('отечеств') || n.includes('veterans') || n.includes('zafer') || n.includes('георг')) return '🎖️';
  if (n.includes('жен') || n.includes('women') || n.includes('матер') || n.includes('mother')) return '💐';
  if (n.includes('труд') || n.includes('весны') || n.includes('labour') || n.includes('labor') || n.includes('arbeit')) return '🌸';
  if (n.includes('независимост') || n.includes('independence') || n.includes('республик') || n.includes('republic') || n.includes('конституц') || n.includes('constitution')) return '🏛️';
  if (n.includes('арми') || n.includes('army') || n.includes('защитник') || n.includes('памят') || n.includes('commemoration')) return '🛡️';
  if (n.includes('единств') || n.includes('unity') || n.includes('солидарност')) return '🤝';
  if (n.includes('наурыз') || n.includes('навруз') || n.includes('spring') || n.includes('пасх') || n.includes('easter')) return '🌱';
  if (n.includes('songkran') || n.includes('вод')) return '💦';
  if (n.includes('корол') || n.includes('king') || n.includes('queen')) return '👑';
  if (n.includes('детей') || n.includes('children') || n.includes('youth') || n.includes('молодеж')) return '🎈';
  if (n.includes('валентин') || n.includes('valentine') || n.includes('любв') || n.includes('love')) return '💖';
  if (n.includes('знаний') || n.includes('учител') || n.includes('teacher')) return '📚';
  return '🎉';
}

// In-memory cache for loaded holidays per country and year
const holidaysCache = new Map<string, Holiday[]>();

/**
 * Loads official public holidays using date-holidays library
 */
export function loadHolidaysForCountry(countryCode: string, targetYear?: number): Holiday[] {
  const code = (countryCode || 'RU').toUpperCase();
  const year = targetYear || new Date().getFullYear();
  const cacheKey = `${code}_${year}`;

  if (holidaysCache.has(cacheKey)) {
    return holidaysCache.get(cacheKey)!;
  }

  try {
    const hd = new Holidays(code, { languages: ['ru', 'en'] });
    const rawList = hd.getHolidays(year);

    if (Array.isArray(rawList) && rawList.length > 0) {
      // Map to normalized Holiday objects
      const mapped: Holiday[] = rawList
        .filter((h) => h.type === 'public' || h.type === 'bank' || h.type === 'observance')
        .map((h) => {
          const dateStr = typeof h.date === 'string' ? h.date.slice(0, 10) : new Date(h.date).toISOString().slice(0, 10);
          const mmdd = dateStr.slice(5, 10);
          return {
            date: mmdd,
            fullDate: dateStr,
            name: h.name,
            isOfficialNonWorking: h.type === 'public' || h.type === 'bank',
            countryCode: code,
            emoji: getHolidayEmoji(h.name),
            type: h.type,
          };
        });

      // Deduplicate by fullDate and name
      const uniqueMap = new Map<string, Holiday>();
      mapped.forEach((h) => {
        const key = `${h.fullDate}_${h.name}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, h);
        }
      });

      const result = Array.from(uniqueMap.values()).sort((a, b) => (a.date > b.date ? 1 : -1));
      holidaysCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.warn(`[date-holidays] Error loading holidays for ${code}:`, err);
  }

  // Fallback to static data
  const fallback = COUNTRY_HOLIDAYS_FALLBACK[code] || COUNTRY_HOLIDAYS_FALLBACK.RU;
  holidaysCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Detects country based on system timezone name
 */
export function detectCountryFromTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    for (const c of SUPPORTED_COUNTRIES) {
      if (c.timezones.some((t) => tz.includes(t) || t.includes(tz))) {
        return c.code;
      }
    }
    if (tz.includes('Moscow') || tz.includes('Volgograd') || tz.includes('Kirov') || tz.includes('Astrakhan')) return 'RU';
    if (tz.includes('Minsk')) return 'BY';
    if (tz.includes('Almaty')) return 'KZ';
    if (tz.includes('Yerevan')) return 'AM';
    if (tz.includes('Tbilisi')) return 'GE';
    if (tz.includes('Istanbul')) return 'TR';
    if (tz.includes('Dubai')) return 'AE';
    if (tz.includes('Berlin')) return 'DE';
    if (tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago')) return 'US';
    if (tz.includes('Tashkent')) return 'UZ';
    if (tz.includes('Belgrade')) return 'RS';
    if (tz.includes('Bangkok')) return 'TH';
    if (tz.includes('Paris')) return 'FR';
    if (tz.includes('Rome')) return 'IT';
    if (tz.includes('Madrid')) return 'ES';
    if (tz.includes('London')) return 'GB';
  } catch {}
  return 'RU';
}

/**
 * Retrieves list of holidays for a specific country
 */
export function getCountryHolidays(countryCode: string, year?: number): Holiday[] {
  return loadHolidaysForCountry(countryCode, year);
}

/**
 * Checks if a specific date string (YYYY-MM-DD or MM-DD) is a holiday
 */
export function findHolidayForDate(fullDateStr: string, countryCode: string): Holiday | undefined {
  if (!fullDateStr) return undefined;
  let year = new Date().getFullYear();
  let mmdd = fullDateStr;

  if (fullDateStr.length >= 10) {
    const parsedYear = parseInt(fullDateStr.slice(0, 4), 10);
    if (!isNaN(parsedYear)) year = parsedYear;
    mmdd = fullDateStr.slice(5, 10);
  }

  const holidays = getCountryHolidays(countryCode, year);
  return holidays.find((h) => {
    if (h.fullDate && h.fullDate === fullDateStr) return true;
    return h.date === mmdd;
  });
}
