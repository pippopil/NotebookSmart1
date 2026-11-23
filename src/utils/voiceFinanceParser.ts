/**
 * Voice-to-Action Financial Parser (QW 2.2 + DS R-AI-02)
 * Analyzes dictated Russian/English phrases for financial transactions without altering
 * the original dictated text, returning structured metadata for optional/automatic tagging.
 */

export interface VoiceFinanceMatch {
  matched: boolean;
  direction: 'expense' | 'income';
  amount: number;
  currency: string;
  formattedLine: string;
  rawPhrase: string;
  suggestedTag: '#auto_voice';
}

const EXPENSE_VERBS =
  '(?:потратил[аи]?|заплатил[аи]?|оплатил[аи]?|купил[аи]?|вышло|обошл(?:ось|ась|ись)|цена|стоит|расход|трата|отдал[аи]?|списали)';

const INCOME_VERBS =
  '(?:получил[аи]?|заработал[аи]?|пришл[оаи]|доход|зарплат[ау]|аванс|преми[яю]|вернули|кэшбэк|кешбэк)';

const CURRENCY_PATTERNS =
  '(?:рубл(?:ей|я|ь)|руб\\.?|₽|доллар(?:ов|а)?|\\$|usd|евро|€|eur|тенге|₸|р\\.?)(?!\\p{L})';

/**
 * Resolves standard currency symbol from recognized currency word or symbol.
 *
 * @param rawCurrency - Currency token from recognized speech
 * @returns Normalized symbol ('₽', '$', '€', '₸')
 */
function normalizeVoiceCurrency(rawCurrency: string): string {
  const lower = rawCurrency.toLowerCase();
  if (lower.includes('$') || lower.includes('доллар') || lower.includes('usd')) return '$';
  if (lower.includes('€') || lower.includes('евро') || lower.includes('eur')) return '€';
  if (lower.includes('₸') || lower.includes('тенге')) return '₸';
  return '₽';
}

/**
 * Parses numeric amount string with optional spaces, comma decimals, or Russian "тысяч/тыс".
 *
 * @param amountStr - Raw numeric substring
 * @param multiplierWord - Optional multiplier word like "тысяч" or "тыс"
 * @returns Parsed finite positive number or null
 */
function parseVoiceAmount(amountStr: string, multiplierWord?: string): number | null {
  const cleaned = amountStr.replace(/[\s\u00A0]+/g, '').replace(',', '.');
  const base = Number.parseFloat(cleaned);
  if (!Number.isFinite(base) || base <= 0) return null;

  if (multiplierWord) {
    const m = multiplierWord.toLowerCase();
    if (m.startsWith('тыс') || m === 'к' || m === 'k') {
      return Math.round(base * 1000 * 100) / 100;
    }
    if (m.startsWith('млн') || m.startsWith('миллион')) {
      return Math.round(base * 1000000 * 100) / 100;
    }
  }
  return Math.round(base * 100) / 100;
}

/**
 * Detects financial operations in a recognized voice transcript chunk.
 * Supports patterns such as:
 * - "потратил 450 рублей на кофе"
 * - "заплатил 1 200 ₽ за такси"
 * - "цена 50 долларов"
 * - "получил зарплату 85 тысяч рублей"
 *
 * @param transcript - Finalized speech recognition chunk
 * @returns VoiceFinanceMatch when a financial operation is detected, otherwise null
 */
export function parseVoiceFinanceAction(transcript: string): VoiceFinanceMatch | null {
  const text = transcript.trim();
  if (!text) return null;

  const amountGroup = '(\\d+(?:[\\s\\u00A0]\\d{3})*(?:[.,]\\d{1,2})?)';
  const multGroup = '(?:\\s*(тыс(?:яч[а-я]*)?\\.?|млн\\.?|миллион[а-я]*))?';

  const expenseRegex = new RegExp(
    `(?:^|\\s)(${EXPENSE_VERBS})(?:\\s+[а-яёa-z-]{1,20}){0,2}\\s+${amountGroup}${multGroup}\\s*(${CURRENCY_PATTERNS})`,
    'iu'
  );

  const incomeRegex = new RegExp(
    `(?:^|\\s)(${INCOME_VERBS})(?:\\s+[а-яёa-z-]{1,20}){0,2}\\s+${amountGroup}${multGroup}\\s*(${CURRENCY_PATTERNS})`,
    'iu'
  );

  const expenseMatch = text.match(expenseRegex);
  if (expenseMatch) {
    const amount = parseVoiceAmount(expenseMatch[2], expenseMatch[3]);
    if (amount !== null) {
      const currency = normalizeVoiceCurrency(expenseMatch[4]);
      const sign = '-';
      return {
        matched: true,
        direction: 'expense',
        amount,
        currency,
        formattedLine: `${sign} ${text}`,
        rawPhrase: text,
        suggestedTag: '#auto_voice',
      };
    }
  }

  const incomeMatch = text.match(incomeRegex);
  if (incomeMatch) {
    const amount = parseVoiceAmount(incomeMatch[2], incomeMatch[3]);
    if (amount !== null) {
      const currency = normalizeVoiceCurrency(incomeMatch[4]);
      const sign = '+';
      return {
        matched: true,
        direction: 'income',
        amount,
        currency,
        formattedLine: `${sign} ${text}`,
        rawPhrase: text,
        suggestedTag: '#auto_voice',
      };
    }
  }

  return null;
}
