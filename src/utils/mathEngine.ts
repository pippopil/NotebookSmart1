import { LineCalculation, NoteCalculationSummary, NoteCategory } from '../types';

/**
 * Normalizes numbers with thousands separators and comma decimals:
 * - "3 000" -> "3000"
 * - "3.000" -> "3000" (dot as thousands separator)
 * - "3,000" -> "3000" (comma as thousands separator)
 * - "35.000" -> "35000", "1.000.000" -> "1000000"
 * - "3.000,50" -> "3000.50", "3,000.50" -> "3000.50"
 * - "561,69" -> "561.69", "3,5" -> "3.5"
 */
export function normalizeNumbers(text: string): string {
  // 1. Grouped thousands with dots/commas followed by decimals:
  // "3.000,50" -> "3000.50", "3,000.50" -> "3000.50"
  let s = text.replace(
    /(\d{1,3}(?:[.]\d{3})+),(\d+)/g,
    (_, intPart, dec) => intPart.replace(/[.]/g, '') + '.' + dec
  );
  s = s.replace(
    /(\d{1,3}(?:[,]\d{3})+)[.](\d+)/g,
    (_, intPart, dec) => intPart.replace(/[,]/g, '') + '.' + dec
  );

  // 2. Pure thousands with dots: e.g. "3.000", "35.000", "1.000.000"
  // Where dot is followed by groups of 3 digits without further digits/decimals
  s = s.replace(/\b(\d{1,3}(?:[.]\d{3})+)(?!\d|[.]\d)/g, (_, m) =>
    m.replace(/[.]/g, '')
  );

  // 3. Pure thousands with commas: e.g. "3,000", "35,000", "1,000,000"
  s = s.replace(/\b(\d{1,3}(?:[,]\d{3})+)(?!\d|[,]\d)/g, (_, m) =>
    m.replace(/[,]/g, '')
  );

  // 4. Any remaining comma between digits where it is a decimal: e.g. "561,69" -> "561.69"
  s = s.replace(/(\d+),(\d+)/g, '$1.$2');

  // 5. Thousands separator spaces between digits: "3 000" -> "3000", "35 000" -> "35000"
  s = s.replace(/(?<=\d)[\s\u00A0\u202F\u2009\u200A\u2002\u2003]+(?=\d)/g, '');

  return s;
}

/**
 * Normalizes text line by replacing Russian money multipliers:
 * "3-х тысяч" -> "3000", "3 тыс" -> "3000", "3 тысячи" -> "3000", "3к" -> "3000"
 * "1.5 тыс" -> "1500", "2 млн" -> "2000000"
 */
export function normalizeMultipliers(text: string): string {
  return text
    // 1. Thousands: 3-х тысяч, 3х тысяч, 3-ех тысяч, 3 тысячи, 3 тысяч, 3 тыс., 3 тыс
    .replace(
      /(\d+(?:[.,]\d+)?)\s*(?:[-–—]?(?:х|ех|мя|ем|и)?\s*)?(?:тыс(?:яч[а-я]*)?\.?)(?!\p{L})/giu,
      (_, n) => {
        const val = parseFloat(n.replace(',', '.'));
        return isNaN(val) ? _ : `${val * 1000}`;
      }
    )
    // 2. Short "к" or "k": 3к, 3 к, 3k, 3 k
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:к|k)(?!\p{L})/giu, (_, n) => {
      const val = parseFloat(n.replace(',', '.'));
      return isNaN(val) ? _ : `${val * 1000}`;
    })
    // 3. Millions: 3 млн, 3-х миллионов, 3 млн., 3 миллиона
    .replace(
      /(\d+(?:[.,]\d+)?)\s*(?:[-–—]?(?:х|ех|мя|ем|и)?\s*)?(?:млн\.?|миллион[а-я]*)(?!\p{L})/giu,
      (_, n) => {
        const val = parseFloat(n.replace(',', '.'));
        return isNaN(val) ? _ : `${val * 1000000}`;
      }
    )
    // 4. Billions: 3 млрд, 3 миллиарда
    .replace(
      /(\d+(?:[.,]\d+)?)\s*(?:[-–—]?(?:х|ех|мя|ем|и)?\s*)?(?:млрд\.?|миллиард[а-я]*)(?!\p{L})/giu,
      (_, n) => {
        const val = parseFloat(n.replace(',', '.'));
        return isNaN(val) ? _ : `${val * 1000000000}`;
      }
    );
}

/**
 * Strips currency words and abbreviations from math candidate
 */
export function stripCurrency(text: string): string {
  return text
    .replace(
      /(?:руб(?:лей|ля|\.?)|rub|usd|eur|тенге|бел\.?руб|гривен|грн|\$|€|₽|₸|Br|₴|(?<=\d|\s|^)р\.?(?!\p{L}))/giu,
      ''
    )
    .trim();
}

/**
 * Extracts currency symbol from line
 */
export function detectCurrency(text: string): string {
  if (/(\$|usd|доллар)/i.test(text)) return '$';
  if (/(€|eur|евро)/i.test(text)) return '€';
  if (/(₸|kzt|тенге)/i.test(text)) return '₸';
  if (/(Br|byn|бел\.?руб)/i.test(text)) return 'Br';
  if (/(₴|uah|гривн)/i.test(text)) return '₴';
  return '₽'; // Default Russian Ruble
}

/**
 * Safely evaluates a simple arithmetic expression without using `eval`.
 * Supports +, -, *, /, %, parentheses, percentage modifications, and grouped numbers.
 */
export function safeEvalMath(expressionStr: string): number | null {
  try {
    let expr = expressionStr.trim();
    if (!expr) return null;

    // Normalize multipliers and numbers
    expr = normalizeMultipliers(expr);
    expr = normalizeNumbers(expr);

    // Replace unicode multiplication and division symbols
    expr = expr.replace(/[×xX]/g, '*').replace(/[÷:]/g, '/');

    // Handle percentage discounts or additions like: "5000 - 20%" -> "5000 * (1 - 0.20)"
    expr = expr.replace(
      /(\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)\s*%/g,
      (_, base, op, pct) => {
        const b = parseFloat(base);
        const p = parseFloat(pct);
        const delta = (b * p) / 100;
        return op === '+' ? `${b + delta}` : `${b - delta}`;
      }
    );

    // Standalone percentage: "20%" -> "0.2"
    expr = expr.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1 / 100)');

    // Tokenize
    const tokens: string[] = [];
    let i = 0;
    while (i < expr.length) {
      const char = expr[i];
      if (/\s/.test(char)) {
        i++;
        continue;
      }
      if (/[+\-*/()]/.test(char)) {
        tokens.push(char);
        i++;
        continue;
      }
      if (/\d|\./.test(char)) {
        let numStr = '';
        while (i < expr.length && /\d|\./.test(expr[i])) {
          numStr += expr[i];
          i++;
        }
        tokens.push(numStr);
        continue;
      }
      // Unknown character inside math expression
      return null;
    }

    if (tokens.length === 0) return null;

    // Parser for basic arithmetic using Recursive Descent
    let tokenIndex = 0;

    function peek(): string | undefined {
      return tokens[tokenIndex];
    }

    function consume(): string {
      return tokens[tokenIndex++];
    }

    function parseExpression(): number {
      let result = parseTerm();
      while (peek() === '+' || peek() === '-') {
        const op = consume();
        const term = parseTerm();
        if (op === '+') result += term;
        else result -= term;
      }
      return result;
    }

    function parseTerm(): number {
      let result = parseFactor();
      while (peek() === '*' || peek() === '/') {
        const op = consume();
        const factor = parseFactor();
        if (op === '*') result *= factor;
        else {
          if (factor === 0) return 0; // Avoid divide by zero crash
          result /= factor;
        }
      }
      return result;
    }

    function parseFactor(): number {
      const token = consume();
      if (!token) return 0;

      // Unary minus or plus
      if (token === '-') {
        return -parseFactor();
      }
      if (token === '+') {
        return parseFactor();
      }

      if (token === '(') {
        const val = parseExpression();
        if (peek() === ')') consume();
        return val;
      }

      const num = parseFloat(token);
      return isNaN(num) ? 0 : num;
    }

    const val = parseExpression();
    if (isNaN(val) || !isFinite(val)) return null;

    // If there are unconsumed tokens, expression is invalid
    if (tokenIndex < tokens.length) {
      return null;
    }

    // Round to 2 decimals to prevent floating point glitches
    return Math.round(val * 100) / 100;
  } catch {
    return null;
  }
}

const MONEY_KEYWORDS_REGEX =
  /(?:₽|\$|€|₸|₴|(?<!\p{L})(?:руб(?:лей|ля|\.?)|rub|usd|eur|kzt|uah|byn|зарплат[а-яё]*|доход[а-яё]*|прибыл[а-яё]*|аванс[а-яё]*|преми[а-яё]*|выручк[а-яё]*|кешбэк[а-яё]*|кэшбэк[а-яё]*|расход[а-яё]*|трат[а-яё]*|оплат[а-яё]*|аренд[а-яё]*|коммуналк[а-яё]*|жкх|кредит[а-яё]*|ипотек[а-яё]*|бензин|гсм|такси|отель|билет[а-яё]*|спортзал|подписк[а-яё]*|электричеств[а-яё]*|интернет|связь|парковк[а-яё]*|мойк[а-яё]*|анализ[а-яё]*|стоматолог|бюджет[а-яё]*|к\s+оплате|чек|стоимость|цена|кэш)(?!\p{L})|(?<=\d|\s)р\.?(?!\p{L}))/iu;

const PIECE_UNIT_REGEX =
  /(?:(?<!\p{L})\d+(?:[.,]\d+)?\s*(?:шт\.?|штук[а-яё]*|ед\.?|pcs|items?)(?!\p{L}))/iu;

const SHOPPING_CHECKBOX_REGEX = /^[-*•]?\s*\[[ xX✓✔]\]\s+/;

/**
 * Strips leading event timestamps like "14:00 — " or "09:30 - " so event cost lines still calculate cleanly
 */
function stripLeadingTimestamp(text: string): string {
  return text.replace(/^\s*(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:[—–\-:]|\s)\s*/u, '').trim();
}

/**
 * Checks if a line contains numbers that are purely non-calculable text context:
 * e.g. dates/years (2024 г.), times (14:00), addresses (дом 12, кв 45),
 * phone numbers, model versions (uni-s 2024), shopping checkboxes without prices,
 * or isolated numbers without operators/currency.
 */
export function isNonFinancialNumberLine(rawText: string): boolean {
  const original = rawText.trim();
  if (!original) return true;

  // Shopping checklist lines without explicit ":" price/math or currency: keep as checklist items
  if (SHOPPING_CHECKBOX_REGEX.test(original)) {
    const hasExplicitMath =
      /[:=]\s*[\d\s+\-*/%().]+/.test(original) ||
      /\d+\s*[+*\/]\s*\d+/.test(original) ||
      /(?:₽|\$|€|\bруб|\brub)/i.test(original);
    if (!hasExplicitMath) {
      return true;
    }
  }

  const t = stripLeadingTimestamp(original);
  if (!t) return true;

  const hasMoneyKeyword = MONEY_KEYWORDS_REGEX.test(t);
  const hasPieceUnit = PIECE_UNIT_REGEX.test(t);

  // Explicit arithmetic operation with operators (+, -, *, /, %) between numbers
  // e.g. "450 * 2", "2400 + 1350", "5000 - 15%"
  const hasArithmeticOperation = /\d+\s*[+*\/÷×]\s*\d+|\d+\s*-\s*\d+(?:\s*%|\s*руб|\s*₽|\s*$)/.test(t);

  // Leading income/expense sign directly on amount or labeled line: "+ Зарплата: 50000" or "- Кофе 350"
  const hasSignedAmount = /^[+-]\s*(?:\p{L}.*?:\s*)?\d+/u.test(t) || /:\s*[+-]?\d+(?:[\s.,]\d+)?(?:\s*(?:к|k|тыс|млн|руб|₽|\$|€))?\s*$/iu.test(t);

  // Reject phone numbers unless explicit money words exist
  if (/(?:(?:\+7|8)[\s\-(]?\d{3}[\s\-)]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})/.test(t) && !hasMoneyKeyword) {
    return true;
  }

  // Reject 7-11 digit continuous numbers (phones, IDs, card tails) unless arithmetic or currency
  if (/\b\d{7,11}\b/.test(t) && !hasMoneyKeyword && !hasArithmeticOperation) {
    return true;
  }

  // Known non-calculable patterns when there is NO money keyword and NO arithmetic operator:
  if (!hasMoneyKeyword && !hasArithmeticOperation) {
    // Years: "2024 г.", "2024г", "2024 год"
    if (/\b(?:19|20)\d{2}\s*(?:г(?:\.|\b)|год[а-я]*)/i.test(t)) return true;

    // Standalone times: "14:00", "09:30"
    if (/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/.test(t) && !hasPieceUnit) return true;

    // Addresses: дом, д., кв., квартира, этаж, офис, корпус, стр., подъезд
    if (/\b(?:дом|д\.|кв\.|кв|квартир[а-я]*|этаж|офис|корп(?:ус|\.)?|стр(?:\.|оение)?|подъезд|палата|код)\s*№?\s*\d+/iu.test(t)) {
      return true;
    }

    // Dates: "12.05.2024", "09/11/2026", "15.04"
    if (/\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b/.test(t)) return true;

    // Versions and device/car model numbers: "uni-s 2024", "v1.9.7", "iPhone 15", "Android 14", "10000 mAh"
    if (/\b(?:v|ver|версия|версии|changan|iphone|samsung|android|windows|mah|gb|гб|мб|mb|hz|гц)\b/i.test(t)) {
      return true;
    }

    // Numbered list prefix: "1. Купить хлеб"
    if (/^\d+[.)]\s+\p{L}/u.test(t) && !hasPieceUnit) return true;
  }

  if (hasMoneyKeyword || hasPieceUnit || hasArithmeticOperation || hasSignedAmount) {
    // Bullet text lines like "- Позвонить в 15 часов" or "- Привет 2024" without money/math/pieces
    if (/^[-*•]\s+\p{L}/u.test(t) && !hasMoneyKeyword && !hasPieceUnit && !hasArithmeticOperation && !/:\s*-?\d/.test(t)) {
      return true;
    }
    return false;
  }

  // Plain bullet lists or bare isolated numbers in prose without context/operator are ignored
  return true;
}

/**
 * Analyzes a single line of note text.
 * Supports:
 * - 'auto': automatically classifies each line as money (₽/$/€), pieces (шт.), pure math, or ignored text
 * - 'payment': forces money focus (while still detecting pieces)
 * - 'calculation': forces non-monetary arithmetic & pieces focus (no ₽)
 */
export function analyzeLine(
  rawText: string,
  lineNumber: number,
  mode: 'auto' | 'payment' | 'calculation' = 'auto'
): LineCalculation {
  const trimmed = rawText.trim();

  if (!trimmed) {
    return {
      lineNumber,
      rawText,
      expression: null,
      result: null,
      currency: '',
      label: '',
      isTotalLine: false,
      type: 'neutral',
      isPieceCalculation: false,
      lineKind: 'text',
    };
  }

  const isTotalLine = /^[-*•]?\s*(?:итого|всего|общая сумма|остаток(?:\s+[^:\n]*)?|баланс|total|sum|balance)(?:\s*[:—\-=]|\s+|$)/i.test(
    trimmed
  );

  // Filter out non-calculable lines (phones, dates, years, addresses, checkboxes, numbered prose)
  if (!isTotalLine) {
    if (mode === 'calculation') {
      const cleanedForSignal = stripLeadingTimestamp(trimmed);
      const hasMathSignal =
        /[+*\/%÷×]|(?:\d+\s*-\s*\d+)|(?:[:=]\s*\d+)|\b(?:шт(?:\.|\b)|штук[а-я]*|ед(?:\.|\b)|pcs|items?)\b/i.test(
          cleanedForSignal
        );
      if (!hasMathSignal || isNonFinancialNumberLine(trimmed)) {
        return {
          lineNumber,
          rawText,
          expression: null,
          result: null,
          currency: '',
          label: trimmed,
          isTotalLine: false,
          type: 'neutral',
          isPieceCalculation: false,
          lineKind: 'text',
        };
      }
    } else if (isNonFinancialNumberLine(trimmed)) {
      return {
        lineNumber,
        rawText,
        expression: null,
        result: null,
        currency: '',
        label: trimmed,
        isTotalLine: false,
        type: 'neutral',
        isPieceCalculation: false,
        lineKind: 'text',
      };
    }
  }

  // Strip optional leading event time like "14:00 — " before parsing math
  const effectiveLine = stripLeadingTimestamp(trimmed);

  // 1. Normalize Russian multipliers (3-х тысяч, 3 тыс, 3 тысячи, 3к)
  const withMultipliers = normalizeMultipliers(effectiveLine);

  // 2. Normalize grouped numbers (3.000, 3,000, 3 000 -> 3000, decimals 561,69 -> 561.69)
  const normalized = normalizeNumbers(withMultipliers);

  const isMoneyLine =
    mode === 'payment' ||
    MONEY_KEYWORDS_REGEX.test(effectiveLine) ||
    /^[+-]\s*(?:\p{L}.*?:\s*)?\d/u.test(effectiveLine);
  const isPiecesLine = PIECE_UNIT_REGEX.test(effectiveLine) && !MONEY_KEYWORDS_REGEX.test(effectiveLine);

  // Split label from math expression
  let label = '';
  let potentialExpr = '';

  const colonIdx = normalized.indexOf(':');
  const eqIdx = normalized.indexOf('=');

  if (colonIdx !== -1) {
    label = normalized.substring(0, colonIdx).trim();
    potentialExpr = normalized.substring(colonIdx + 1).trim();
  } else if (eqIdx !== -1 && eqIdx > 0 && !/[+\-*/]/.test(normalized.charAt(eqIdx - 1))) {
    label = normalized.substring(0, eqIdx).trim();
    potentialExpr = normalized.substring(eqIdx + 1).trim();
  } else {
    // Allow inline currency / piece unit tokens inside arithmetic expressions:
    // e.g. "Аренда 35 000 руб + 2400" or "5 шт * 380" or "Плитка 40 * 3 шт"
    const unitTokenPattern =
      '(?:руб(?:лей|ля|\\.?)|rub|\\$|€|₽|₸|Br|₴|тенге|шт\\.?|штук[а-яё]*|ед\\.?|pcs|items?|(?<=\\d|\\s)р\\.?(?!\\p{L}))';
    const exprSegmentRegex = new RegExp(
      `^(.*?)([+\\-]?\\s*\\d[\\d\\s+\\-*/%().xX×÷]*(?:\\s*${unitTokenPattern}(?!\\p{L})[\\d\\s+\\-*/%().xX×÷]*)*)$`,
      'iu'
    );
    const match = normalized.match(exprSegmentRegex);
    if (match && match[2] && /\d/.test(match[2])) {
      label = (match[1] || '').trim();
      potentialExpr = match[2].trim();
    } else {
      potentialExpr = normalized;
    }
  }

  // Strip currency words and symbols, or piece units
  let cleanExpr = stripCurrency(potentialExpr);
  if (isPiecesLine || PIECE_UNIT_REGEX.test(potentialExpr)) {
    cleanExpr = cleanExpr
      .replace(/(?<!\p{L})(?:шт\.?|штук[а-яё]*|ед\.?|pcs|items?)(?!\p{L})/giu, '')
      .trim();
  }

  // Test if expression evaluates cleanly
  if (/\d/.test(cleanExpr)) {
    const result = safeEvalMath(cleanExpr);
    if (result !== null && !isNaN(result)) {
      let lineType: 'income' | 'expense' | 'total' | 'neutral' = 'neutral';
      const absResult = Math.abs(result);

      if (isTotalLine) {
        lineType = 'total';
      } else if (isMoneyLine && mode !== 'calculation') {
        if (
          effectiveLine.startsWith('+') ||
          /(?<!\p{L})(?:прибыль|доход(?:ы)?|зарплат(?:а|ы)?|преми(?:я|и)|аванс|кешбэк|кэшбэк|выручк(?:а|и)|получен(?:о|ы)|плюс|компенсац[а-яё]*)(?!\p{L})/iu.test(
            effectiveLine
          )
        ) {
          lineType = 'income';
        } else if (
          effectiveLine.startsWith('-') ||
          result < 0 ||
          /(?<!\p{L})(?:расход(?:ы)?|трат(?:ы|а)|минус|покупк(?:а|и)|оплат(?:а|ы)|аренд(?:а|ы)|коммуналк(?:а|и)|жкх|кредит|ипотек|бензин|парковк|продукты)(?!\p{L})/iu.test(
            effectiveLine
          )
        ) {
          lineType = 'expense';
        }
      }

      const detectedMoneyCurrency = detectCurrency(effectiveLine);
      let assignedCurrency = '';
      let lineKind: 'money' | 'pieces' | 'math' | 'text' = 'math';

      if (isPiecesLine) {
        assignedCurrency = 'шт.';
        lineKind = 'pieces';
      } else if (mode === 'calculation') {
        assignedCurrency = '';
        lineKind = 'math';
      } else if (isMoneyLine) {
        assignedCurrency = detectedMoneyCurrency;
        lineKind = 'money';
      } else {
        // Pure math expression without currency or financial context -> no ₽ sign!
        assignedCurrency = '';
        lineKind = 'math';
      }

      return {
        lineNumber,
        rawText,
        expression: cleanExpr,
        result: lineType === 'expense' ? absResult : result,
        currency: assignedCurrency,
        label,
        isTotalLine,
        type: lineType,
        isPieceCalculation: isPiecesLine,
        lineKind,
      };
    }
  }

  return {
    lineNumber,
    rawText,
    expression: null,
    result: null,
    currency: '',
    label,
    isTotalLine,
    type: isTotalLine ? 'total' : 'neutral',
    isPieceCalculation: false,
    lineKind: 'text',
  };
}

/**
 * Analyzes whole note text line-by-line automatically.
 * If autoCalculate is explicitly false, disables calculation completely.
 * Otherwise automatically distinguishes money (₽/$/€), pieces (шт.), and pure math per line.
 */
export function analyzeNote(
  content: string,
  category: NoteCategory = 'note',
  autoCalculate?: boolean
): NoteCalculationSummary {
  const rawLines = content.split('\n');

  // Calculation is active whenever autoCalculate is not explicitly disabled (false)
  const calcEnabled = autoCalculate !== undefined ? autoCalculate : true;

  if (!calcEnabled) {
    const emptyLines: LineCalculation[] = rawLines.map((rawText, idx) => ({
      lineNumber: idx + 1,
      rawText,
      expression: null,
      result: null,
      currency: '',
      label: '',
      isTotalLine: false,
      type: 'neutral',
      isPieceCalculation: false,
      lineKind: 'text',
    }));

    return {
      lines: emptyLines,
      grandTotal: 0,
      totalIncome: 0,
      totalExpenses: 0,
      netBalance: 0,
      hasIncomeExpenseSplit: false,
      savingsRatePercent: 0,
      currency: '',
      totalCalculatedLines: 0,
      breakdownByCurrency: {},
      totalPieces: 0,
      hasPiecesCalculation: false,
    };
  }

  const calcMode: 'auto' | 'payment' | 'calculation' =
    category === 'payment' || category === 'budget'
      ? 'payment'
      : category === 'calculation'
      ? 'calculation'
      : 'auto';

  const lines: LineCalculation[] = [];
  const breakdownByCurrency: Record<string, number> = {};
  let totalCalculatedLines = 0;
  let primaryCurrency = '';
  let runningMoneyOrMathSum = 0;
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalPieces = 0;
  let hasPieces = false;
  let hasMoneyLines = false;

  for (let idx = 0; idx < rawLines.length; idx++) {
    const rawLine = rawLines[idx];
    const parsed = analyzeLine(rawLine, idx + 1, calcMode);

    if (parsed.isTotalLine) {
      let totalSoFar: number;
      if (totalIncome > 0 && totalExpenses > 0) {
        totalSoFar = Math.round((totalIncome - totalExpenses) * 100) / 100;
      } else if (runningMoneyOrMathSum !== 0) {
        totalSoFar = Math.round(runningMoneyOrMathSum * 100) / 100;
      } else if (totalPieces > 0) {
        totalSoFar = Math.round(totalPieces * 100) / 100;
      } else if (parsed.result !== null && parsed.result !== 0) {
        totalSoFar = parsed.result;
        runningMoneyOrMathSum = parsed.result;
      } else {
        totalSoFar = 0;
      }

      parsed.result = totalSoFar;
      parsed.currency = primaryCurrency || (hasPieces ? 'шт.' : '');
      lines.push(parsed);
    } else {
      if (parsed.result !== null) {
        totalCalculatedLines++;
        if (parsed.isPieceCalculation) {
          totalPieces += parsed.result;
          hasPieces = true;
        } else {
          const curr = parsed.currency;
          if (parsed.lineKind === 'money' || curr) {
            hasMoneyLines = true;
            if (!primaryCurrency) primaryCurrency = curr || '₽';
          }
          breakdownByCurrency[curr] = (breakdownByCurrency[curr] || 0) + parsed.result;
          runningMoneyOrMathSum += parsed.result;

          if (parsed.type === 'income') {
            totalIncome += parsed.result;
          } else if (parsed.type === 'expense') {
            totalExpenses += parsed.result;
          }
        }
      }
      lines.push(parsed);
    }
  }

  const hasIncomeExpenseSplit = totalIncome > 0 && totalExpenses > 0;
  const netBalance = totalIncome - totalExpenses;

  let finalGrandTotal = 0;
  if (hasIncomeExpenseSplit) {
    finalGrandTotal = netBalance;
  } else if (runningMoneyOrMathSum !== 0) {
    finalGrandTotal = runningMoneyOrMathSum;
  } else if (totalPieces > 0) {
    finalGrandTotal = totalPieces;
  }

  let finalCurrency = '';
  if (hasMoneyLines) {
    finalCurrency = primaryCurrency || '₽';
  } else if (totalPieces > 0 && runningMoneyOrMathSum === 0) {
    finalCurrency = 'шт.';
  } else {
    finalCurrency = '';
  }

  const savingsRatePercent =
    totalIncome > 0
      ? Math.max(0, Math.round(((totalIncome - totalExpenses) / totalIncome) * 100))
      : 0;

  return {
    lines,
    grandTotal: Math.round(finalGrandTotal * 100) / 100,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netBalance: Math.round(netBalance * 100) / 100,
    hasIncomeExpenseSplit,
    savingsRatePercent,
    currency: finalCurrency,
    totalCalculatedLines,
    breakdownByCurrency,
    totalPieces: Math.round(totalPieces * 100) / 100,
    hasPiecesCalculation: hasPieces,
  };
}

/**
 * Format currency with thousands spaces
 * e.g. 35000 -> "35 000 ₽", 3000 -> "3 000 ₽", 15 -> "15 шт.", pure number -> "15"
 */
export function formatMoney(amount: number, currency = '₽'): string {
  const rounded = Math.round(amount * 100) / 100;
  const parts = rounded.toFixed(rounded % 1 === 0 ? 0 : 2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const formattedNum = parts.join('.');

  if (!currency || currency === 'calc' || currency === 'none') {
    return formattedNum;
  }
  if (currency === '$') return `$${formattedNum}`;
  if (currency === '€') return `€${formattedNum}`;
  if (currency === 'шт.' || currency === 'шт') return `${formattedNum} шт.`;
  return `${formattedNum} ${currency}`;
}
