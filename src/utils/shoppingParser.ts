import { ShoppingCategory, ShoppingItem, StoreOption } from '../types';

// Grocery dictionaries for categorization & price estimation
const CATEGORY_PATTERNS: Record<ShoppingCategory, RegExp> = {
  dairy: /(молок|кефир|творог|сыр|сметан|йогурт|масло сливочн|ряженк|сливк|брынз|маскарпоне|пармезан|моцарелл)/i,
  bakery: /(хлеб|батон|булочк|лаваш|багет|круассан|тост|лепешк|сухар|булка)/i,
  meat: /(мяс|говядин|свинин|куриц|индейк|фарш|колбас|сосиск|ветчин|рыб|лосос|семг|форел|креветк|бекон|стейк|грудк|филе)/i,
  produce: /(яблок|банан|апельсин|мандарин|помидор|томат|огурц|картоф|морков|лук|чеснок|зелен|салат|авокадо|лимон|ягод|клубник|виноград|капуст|перец|кабачок|баклажан)/i,
  grocery: /(макарон|спагетти|рис|гречк|овсянк|круп|мук|сахар|соль|масло растительн|масло подсолнечн|масло оливков|соус|кетчуп|майонез|консерв|тушенк|горошек|кукуруз)/i,
  drinks: /(вод[аы]|сок|морс|чай|кофе|квас|лимонад|компот|энергетик|кола|газировк|молотый кофе|зерновой кофе)/i,
  sweets: /(шоколад|конфет|печень|торт|пирожн|вафл|мармелад|зефир|халв|морожен|чипс|снек|орех|сухофрукт)/i,
  household: /(мыл|шампун|гель для душ|порошок|паст[аы] зубн|бумага туалетн|салфетк|губк|пакет|средство для мытья|белизн|кондиционер для белья)/i,
  other: /.*/,
};

// Estimated benchmark average prices (in RUB)
const CATEGORY_AVG_PRICES: Record<ShoppingCategory, number> = {
  dairy: 130,
  bakery: 65,
  meat: 380,
  produce: 140,
  grocery: 110,
  drinks: 95,
  sweets: 150,
  household: 210,
  other: 150,
};

export const CATEGORY_META: Record<ShoppingCategory, { label: string; icon: string }> = {
  dairy: { label: 'Молочное и сыр', icon: '🥛' },
  bakery: { label: 'Хлеб и выпечка', icon: '🍞' },
  meat: { label: 'Мясо и рыба', icon: '🥩' },
  produce: { label: 'Овощи и фрукты', icon: '🍎' },
  grocery: { label: 'Бакалея и крупы', icon: '🌾' },
  drinks: { label: 'Напитки, чай, кофе', icon: '🧃' },
  sweets: { label: 'Сладости и снеки', icon: '🍫' },
  household: { label: 'Бытовая химия и дом', icon: '🧼' },
  other: { label: 'Другие товары', icon: '🛒' },
};

/**
 * Returns direct product search URL for any supported store
 */
export function getItemStoreUrl(storeId: string, itemName: string): string {
  const q = encodeURIComponent(itemName);
  switch (storeId) {
    case 'wb':
      return `https://www.wildberries.ru/catalog/0/search.aspx?search=${q}`;
    case 'ozon':
      return `https://www.ozon.ru/search/?text=${q}`;
    case 'yandex_market':
      return `https://market.yandex.ru/search?text=${q}`;
    case 'megamarket':
      return `https://megamarket.ru/catalog/?q=${q}`;
    case 'kuper':
      return `https://kuper.ru/search?q=${q}`;
    case 'samokat':
      return `https://samokat.ru/search?text=${q}`;
    case 'yandex_lavka':
      return `https://lavka.yandex.ru/search?text=${q}`;
    case 'vkusvill':
      return `https://vkusvill.ru/search/?q=${q}`;
    case 'pyaterochka':
      return `https://5ka.ru/search?q=${q}`;
    case 'vprok':
      return `https://www.vprok.ru/search?text=${q}`;
    case 'magnit':
      return `https://magnit.ru/search/?q=${q}`;
    default:
      return `https://market.yandex.ru/search?text=${q}`;
  }
}

export const STORE_OPTIONS: StoreOption[] = [
  // Маркетплейсы
  {
    id: 'wb',
    name: 'Wildberries',
    type: 'marketplace',
    logoColor: '#cb11ab',
    deliveryTime: '1–2 дня в ПВЗ',
    tag: 'Маркетплейс #1',
    description: 'Миллионы товаров, бесплатная доставка в пункт выдачи',
    getSearchUrl: (q: string) => `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(q)}`,
    getMultiItemCartUrl: (items: string[]) =>
      `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(items.slice(0, 4).join(' '))}`,
  },
  {
    id: 'ozon',
    name: 'Ozon Fresh / Ozon',
    type: 'marketplace',
    logoColor: '#005bff',
    deliveryTime: 'От 1 часа (Fresh) / 1 день',
    tag: 'Маркетплейс & Fresh',
    description: 'Ozon Express и Ozon Fresh — заказ продуктов с быстрой курьерской доставкой',
    getSearchUrl: (q: string) => `https://www.ozon.ru/search/?text=${encodeURIComponent(q)}`,
    getMultiItemCartUrl: (items: string[]) =>
      `https://www.ozon.ru/search/?text=${encodeURIComponent(items.slice(0, 4).join(' '))}`,
  },
  {
    id: 'yandex_market',
    name: 'Яндекс Маркет',
    type: 'marketplace',
    logoColor: '#fc3f1d',
    deliveryTime: 'От 1–2 часов или завтра',
    tag: 'Сплит & Баллы Плюс',
    description: 'Оплата баллами Плюса, сплит и быстрая доставка продуктов',
    getSearchUrl: (q: string) => `https://market.yandex.ru/search?text=${encodeURIComponent(q)}`,
    getMultiItemCartUrl: (items: string[]) =>
      `https://market.yandex.ru/search?text=${encodeURIComponent(items.slice(0, 4).join(' '))}`,
  },
  {
    id: 'megamarket',
    name: 'Мегамаркет',
    type: 'marketplace',
    logoColor: '#7000ff',
    deliveryTime: 'От 1 часа (Самокат/Сбер) до 2 дней',
    tag: 'Бонусы Спасибо',
    description: 'Скидки до 99% бонусами СберСпасибо',
    getSearchUrl: (q: string) => `https://megamarket.ru/catalog/?q=${encodeURIComponent(q)}`,
  },

  // Экспресс-доставка за 15-30 минут
  {
    id: 'kuper',
    name: 'Купер (СберМаркет)',
    type: 'delivery',
    logoColor: '#00b341',
    deliveryTime: '20–45 минут',
    tag: 'Metro, Лента, Ашан, Магнит',
    description: 'Доставка из любимых гипермаркетов и ресторанов по лучшим ценам',
    getSearchUrl: (q: string) => `https://kuper.ru/search?q=${encodeURIComponent(q)}`,
    getMultiItemCartUrl: (items: string[]) =>
      `https://kuper.ru/search?q=${encodeURIComponent(items.slice(0, 3).join(' '))}`,
  },
  {
    id: 'samokat',
    name: 'Самокат',
    type: 'delivery',
    logoColor: '#ff2d55',
    deliveryTime: '15–30 минут',
    tag: 'Быстро от 15 мин',
    description: 'Даркстор рядом с домом, свежие продукты и собственная марка',
    getSearchUrl: (q: string) => `https://samokat.ru/search?text=${encodeURIComponent(q)}`,
  },
  {
    id: 'yandex_lavka',
    name: 'Яндекс Лавка',
    type: 'delivery',
    logoColor: '#2b90d9',
    deliveryTime: '15–30 минут',
    tag: 'Готовая еда и продукты',
    description: 'Ультра-быстрая доставка прямо до двери',
    getSearchUrl: (q: string) => `https://lavka.yandex.ru/search?text=${encodeURIComponent(q)}`,
  },
  {
    id: 'vkusvill',
    name: 'ВкусВилл Доставка',
    type: 'delivery',
    logoColor: '#009a44',
    deliveryTime: 'Бесплатно от 1 часа',
    tag: 'Натуральные продукты',
    description: 'Бесплатная доставка без минимальной суммы заказа',
    getSearchUrl: (q: string) => `https://vkusvill.ru/search/?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'pyaterochka',
    name: 'Пятёрочка Доставка',
    type: 'delivery',
    logoColor: '#e31b23',
    deliveryTime: '30–45 минут',
    tag: 'Выгодные цены',
    description: 'Цены как в магазине у дома, постоянные скидки и акции',
    getSearchUrl: (q: string) => `https://5ka.ru/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'vprok',
    name: 'Перекрёсток Впрок',
    type: 'delivery',
    logoColor: '#005b41',
    deliveryTime: 'В удобный интервал',
    tag: 'Широкий ассортимент',
    description: 'Большой выбор товаров от надежного супермаркета',
    getSearchUrl: (q: string) => `https://www.vprok.ru/search?text=${encodeURIComponent(q)}`,
  },
];

/**
 * Normalizes currency string into standard symbol and RUB conversion rate
 */
export function normalizeCurrency(rawCur: string): { symbol: string; rateToRub: number } {
  if (!rawCur) return { symbol: '₽', rateToRub: 1 };
  const lower = rawCur.toLowerCase().trim();
  if (lower === '$' || lower.includes('usd') || lower.includes('доллар')) {
    return { symbol: '$', rateToRub: 95 };
  }
  if (lower === '€' || lower.includes('eur') || lower.includes('евро')) {
    return { symbol: '€', rateToRub: 102 };
  }
  if (lower === '₸' || lower.includes('тенге') || lower.includes('kzt')) {
    return { symbol: '₸', rateToRub: 0.2 };
  }
  if (lower.includes('byn') || lower.includes('бел')) {
    return { symbol: 'BYN', rateToRub: 29 };
  }
  if (lower === '₴' || lower.includes('грн') || lower.includes('грив')) {
    return { symbol: '₴', rateToRub: 2.3 };
  }
  return { symbol: '₽', rateToRub: 1 };
}

/**
 * Extracts shopping items from raw note text with lineIndex and prices
 */
export function extractShoppingItems(content: string): ShoppingItem[] {
  const lines = content.split('\n');
  const items: ShoppingItem[] = [];
  let currentId = 1;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check if line is a checklist item e.g. "- [ ] молоко" or "- [x] сыр"
    const checkboxMatch = trimmed.match(/^[-*•]?\s*\[([ xX])\]\s*(.*)$/);
    if (checkboxMatch) {
      const isCompleted = checkboxMatch[1].toLowerCase() === 'x';
      const itemText = checkboxMatch[2].trim();
      if (itemText) {
        items.push(parseShoppingItemString(itemText, isCompleted, `item-${currentId++}`, lineIdx));
      }
      continue;
    }

    // Check if line is a bullet item e.g. "* молоко 2л" or "- хлеб 45 руб"
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      const itemText = bulletMatch[1].trim();
      if (itemText && isLikelyShoppingText(itemText)) {
        items.push(parseShoppingItemString(itemText, false, `item-${currentId++}`, lineIdx));
        continue;
      }
    }

    // Check comma-separated items if line starts with keywords like "купить:", "список покупок:", "продукты:"
    const headerPrefix = trimmed.match(/^(купить|покупки|список покупок|продукты|в магазине|shopping|grocery)\s*[:—\-]\s*(.*)$/i);
    if (headerPrefix && headerPrefix[2]) {
      const rawList = headerPrefix[2].split(/[,;]/);
      for (const raw of rawList) {
        const cleaned = raw.trim();
        if (cleaned) {
          items.push(parseShoppingItemString(cleaned, false, `item-${currentId++}`, lineIdx));
        }
      }
      continue;
    }

    // If whole line matches known grocery patterns without bullets
    if (isLikelyShoppingText(trimmed)) {
      items.push(parseShoppingItemString(trimmed, false, `item-${currentId++}`, lineIdx));
    }
  }

  return items;
}

/**
 * Helper to classify item string into parsed data, extracting quantity, unit, price and currency
 */
export function parseShoppingItemString(
  rawText: string,
  isCompleted: boolean,
  id: string,
  lineIndex?: number
): ShoppingItem {
  let name = rawText;
  let quantity: number | undefined;
  let unit: string | undefined;
  let recognizedPrice: number | undefined;
  let recognizedUnitPrice: number | undefined;
  let currency: string = '₽';
  let hasCustomPrice = false;

  // 1. Check for per-unit price: e.g. "по 150 руб", "по 200 ₽", "по 5.50 $"
  const perUnitMatch = name.match(/\bпо\s+(\d+(?:[.,]\d+)?)\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\.?\b|\$|€|тенге|евро|usd|eur)?/i);
  if (perUnitMatch) {
    const rawNum = perUnitMatch[1].replace(',', '.');
    recognizedUnitPrice = parseFloat(rawNum);
    hasCustomPrice = true;
    // Check if currency was in this per-unit fragment
    const curMatch = perUnitMatch[0].match(/(?:₽|руб(?:лей|ля|ль)?\.?|р\.?\b|\$|€|тенге|евро|usd|eur)/i);
    if (curMatch) {
      currency = normalizeCurrency(curMatch[0]).symbol;
    }
    name = name.replace(perUnitMatch[0], '').trim();
  }

  // 2. Check for explicit price and currency:
  // e.g. "90 руб", "450 ₽", "25 $", "15 евро", "120р", "35000 руб", "цена 500", "за 200 р", "= 300 руб"
  const priceRegex = /(?:(?::|—|-|=|цена|стоимость|стоит|стоят|за)\s*)?(\d+(?:[.,]\d+)?)\s*(₽|руб(?:лей|ля|ль)?\.?|р\.?\b|\$|€|тенге|евро|usd|eur)\b/i;
  const priceMatch = name.match(priceRegex);

  if (priceMatch && !priceMatch[0].includes('%')) {
    const rawVal = priceMatch[1].replace(',', '.');
    const parsedVal = parseFloat(rawVal);
    // Don't treat percentages like 3.2% or 9% as prices
    if (!isNaN(parsedVal) && parsedVal > 0) {
      recognizedPrice = parsedVal;
      hasCustomPrice = true;
      currency = normalizeCurrency(priceMatch[2]).symbol;
      name = name.replace(priceMatch[0], '').trim();
    }
  }

  // 3. Extract quantity and unit: e.g. "Молоко 3.2% 2 л", "Яйца 10 шт", "Сыр 500 г", "Кофе 1 пачка"
  const qtyMatch = name.match(/(\d+(?:[.,]\d+)?)\s*(кг|г|гр|литр(?:а|ов)?|л|мл|шт|штук|упаковк[аи]|пачк[аи]|бут|бан(?:ка|ки)?)\b/i);
  if (qtyMatch) {
    quantity = parseFloat(qtyMatch[1].replace(',', '.'));
    unit = qtyMatch[2];
    name = name.replace(qtyMatch[0], '').trim();
  }

  // If per-unit price was given and quantity exists, calculate total price
  if (recognizedUnitPrice && quantity && quantity > 0) {
    recognizedPrice = Math.round(recognizedUnitPrice * quantity * 100) / 100;
  } else if (recognizedUnitPrice && !recognizedPrice) {
    recognizedPrice = recognizedUnitPrice;
  }

  // Clean up trailing and leading punctuation (e.g. "Молоко - " -> "Молоко", "Сыр: " -> "Сыр")
  name = name
    .replace(/^[-*•:\s]+/, '')
    .replace(/[-—:=,\s]+$/, '')
    .trim();

  // Detect category
  let category: ShoppingCategory = 'other';
  for (const [cat, pattern] of Object.entries(CATEGORY_PATTERNS) as [ShoppingCategory, RegExp][]) {
    if (cat === 'other') continue;
    if (pattern.test(rawText)) {
      category = cat;
      break;
    }
  }

  const basePrice = CATEGORY_AVG_PRICES[category] || 150;
  let estimatedPriceRub: number;

  if (hasCustomPrice && recognizedPrice) {
    const { rateToRub } = normalizeCurrency(currency);
    estimatedPriceRub = Math.round(recognizedPrice * rateToRub);
  } else {
    estimatedPriceRub = quantity && quantity > 0 && quantity < 20 ? Math.round(basePrice * quantity) : basePrice;
  }

  return {
    id,
    name: name || rawText,
    originalText: rawText,
    quantity,
    unit,
    category,
    isCompleted,
    estimatedPriceRub,
    price: recognizedPrice,
    unitPrice: recognizedUnitPrice,
    currency,
    hasCustomPrice,
    lineIndex,
  };
}

/**
 * Detects if a text string contains recognizable groceries or shopping items
 */
export function isLikelyShoppingText(text: string): boolean {
  if (text.length > 120) return false; // Long paragraphs are probably not shopping items
  // Check against any grocery category pattern
  for (const [cat, regex] of Object.entries(CATEGORY_PATTERNS) as [ShoppingCategory, RegExp][]) {
    if (cat !== 'other' && regex.test(text)) return true;
  }
  // Check common unit patterns
  if (/\b\d+\s*(?:кг|г|гр|л|мл|шт|пачк)/i.test(text)) return true;
  // Check common price & currency patterns e.g. "Хлеб 45 руб", "Сыр 350 ₽", "120р"
  if (/\b\d+(?:[.,]\d+)?\s*(?:₽|руб|р\b|\$|€|тенге|евро)/i.test(text)) return true;
  return false;
}

/**
 * Generate quick deep link URLs for maps (offline in-store shopping)
 */
export function getMapSearchUrls(chainOrQuery: string) {
  const encoded = encodeURIComponent(chainOrQuery);
  return {
    yandex: `https://yandex.ru/maps/?text=${encoded}`,
    gis: `https://2gis.ru/search/${encoded}`,
    google: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  };
}

/**
 * Create shareable text summary of shopping list for Telegram / WhatsApp / SMS
 */
export function formatShoppingListForSharing(items: ShoppingItem[], noteTitle: string): string {
  if (items.length === 0) return '';
  const remaining = items.filter((i) => !i.isCompleted);
  const done = items.filter((i) => i.isCompleted);

  let text = `🛒 Список покупок: ${noteTitle || 'Без названия'}\n\n`;

  if (remaining.length > 0) {
    text += `Нужно купить (${remaining.length}):\n`;
    remaining.forEach((item, idx) => {
      text += `${idx + 1}. [ ] ${item.name}${item.quantity ? ` — ${item.quantity} ${item.unit || 'шт'}` : ''}\n`;
    });
  }

  if (done.length > 0) {
    text += `\nУже куплено (${done.length}):\n`;
    done.forEach((item) => {
      text += `✓ ${item.name}\n`;
    });
  }

  const estSum = items.reduce((sum, item) => sum + (item.estimatedPriceRub || 0), 0);
  text += `\nОриентировочная сумма: ~${estSum} ₽\n`;
  text += `Открыто в NotebookSmart: https://github.com/pippopil/NotebookSmart`;

  return text;
}
