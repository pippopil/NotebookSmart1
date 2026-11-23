/**
 * Brand Preferences & Lowest Basket Price Service
 * Tracks user-selected brands/manufacturers per grocery item, remembers preferences,
 * and calculates the lowest basket price across all shopping items.
 */

import { ShoppingCategory, ShoppingItem } from '../types';

export interface BrandOption {
  name: string;
  minPriceRub: number;
  regularPriceRub: number;
  packageSize: string;
  isDiscounted?: boolean;
}

// Popular manufacturers/brands in Russian grocery retail by product keyword/category
export const BRAND_CATALOG: Record<string, BrandOption[]> = {
  молоко: [
    { name: 'Простоквашино', minPriceRub: 89, regularPriceRub: 119, packageSize: '930 мл', isDiscounted: true },
    { name: 'Домик в деревне', minPriceRub: 94, regularPriceRub: 125, packageSize: '950 мл' },
    { name: 'Село Зелёное', minPriceRub: 87, regularPriceRub: 115, packageSize: '1 л', isDiscounted: true },
    { name: 'ВкусВилл', minPriceRub: 105, regularPriceRub: 115, packageSize: '1 л' },
    { name: 'Красная Цена', minPriceRub: 69, regularPriceRub: 79, packageSize: '900 мл', isDiscounted: true },
  ],
  сыр: [
    { name: 'Брест-Литовск', minPriceRub: 189, regularPriceRub: 249, packageSize: '200 г', isDiscounted: true },
    { name: 'Ламбер', minPriceRub: 239, regularPriceRub: 310, packageSize: '230 г' },
    { name: 'ВкусВилл', minPriceRub: 220, regularPriceRub: 250, packageSize: '200 г' },
    { name: 'Сваля', minPriceRub: 219, regularPriceRub: 280, packageSize: '200 г' },
    { name: 'Рогачевъ', minPriceRub: 175, regularPriceRub: 220, packageSize: '200 г', isDiscounted: true },
  ],
  масло: [
    { name: 'Экомилк 82.5%', minPriceRub: 189, regularPriceRub: 259, packageSize: '180 г', isDiscounted: true },
    { name: 'Брест-Литовск', minPriceRub: 199, regularPriceRub: 265, packageSize: '180 г' },
    { name: 'Вкуснотеево', minPriceRub: 215, regularPriceRub: 279, packageSize: '200 г' },
    { name: 'Золотая Семечка (раст.)', minPriceRub: 119, regularPriceRub: 155, packageSize: '1 л', isDiscounted: true },
  ],
  хлеб: [
    { name: 'Коломенское', minPriceRub: 49, regularPriceRub: 65, packageSize: '1 шт (нарезка)', isDiscounted: true },
    { name: 'Хлебный Дом', minPriceRub: 52, regularPriceRub: 68, packageSize: '350 г' },
    { name: 'Черемушки', minPriceRub: 45, regularPriceRub: 59, packageSize: '400 г', isDiscounted: true },
    { name: 'ВкусВилл', minPriceRub: 65, regularPriceRub: 75, packageSize: '300 г' },
  ],
  курица: [
    { name: 'Петелинка', minPriceRub: 289, regularPriceRub: 369, packageSize: 'филе 800 г', isDiscounted: true },
    { name: 'Троекурово', minPriceRub: 275, regularPriceRub: 345, packageSize: 'филе 750 г', isDiscounted: true },
    { name: 'Мираторг', minPriceRub: 310, regularPriceRub: 399, packageSize: 'филе 850 г' },
    { name: 'Первая Свежесть', minPriceRub: 269, regularPriceRub: 330, packageSize: 'филе 800 г', isDiscounted: true },
  ],
  мясо: [
    { name: 'Мираторг', minPriceRub: 399, regularPriceRub: 499, packageSize: 'гуляш/окорок 400 г', isDiscounted: true },
    { name: 'Черкизово', minPriceRub: 379, regularPriceRub: 469, packageSize: 'свинина 400 г', isDiscounted: true },
    { name: 'Останкино', minPriceRub: 349, regularPriceRub: 430, packageSize: 'фарш 400 г', isDiscounted: true },
    { name: 'Ближние Горки', minPriceRub: 420, regularPriceRub: 510, packageSize: 'вырезка 400 г' },
  ],
  макароны: [
    { name: 'Шебекинские', minPriceRub: 59, regularPriceRub: 89, packageSize: '450 г', isDiscounted: true },
    { name: 'Barilla', minPriceRub: 89, regularPriceRub: 139, packageSize: '450 г', isDiscounted: true },
    { name: 'Макфа', minPriceRub: 65, regularPriceRub: 92, packageSize: '450 г' },
    { name: 'Baisad', minPriceRub: 49, regularPriceRub: 75, packageSize: '400 г', isDiscounted: true },
  ],
  кофе: [
    { name: 'Jacobs Monarch', minPriceRub: 349, regularPriceRub: 499, packageSize: 'зерно/мол 250 г', isDiscounted: true },
    { name: 'Lavazza', minPriceRub: 449, regularPriceRub: 650, packageSize: 'зерно 250 г' },
    { name: 'Paulig / Poetti', minPriceRub: 389, regularPriceRub: 540, packageSize: 'зерно 250 г', isDiscounted: true },
    { name: 'Jardin', minPriceRub: 299, regularPriceRub: 420, packageSize: 'мол 250 г', isDiscounted: true },
  ],
  чай: [
    { name: 'Greenfield', minPriceRub: 149, regularPriceRub: 219, packageSize: '25 пак', isDiscounted: true },
    { name: 'Tess', minPriceRub: 119, regularPriceRub: 175, packageSize: '25 пак', isDiscounted: true },
    { name: 'Richard', minPriceRub: 139, regularPriceRub: 199, packageSize: '25 пак' },
    { name: 'Curtis', minPriceRub: 129, regularPriceRub: 185, packageSize: '20 пирам', isDiscounted: true },
  ],
  яйца: [
    { name: 'Волжанин С0', minPriceRub: 119, regularPriceRub: 145, packageSize: '10 шт', isDiscounted: true },
    { name: 'Окское С0', minPriceRub: 135, regularPriceRub: 165, packageSize: '10 шт' },
    { name: 'Синявинское С1', minPriceRub: 109, regularPriceRub: 139, packageSize: '10 шт', isDiscounted: true },
    { name: 'Красная Цена С1', minPriceRub: 99, regularPriceRub: 125, packageSize: '10 шт', isDiscounted: true },
  ],
  сладости: [
    { name: 'Рот Фронт / Бабаевский', minPriceRub: 99, regularPriceRub: 155, packageSize: 'шоколад 100 г', isDiscounted: true },
    { name: 'Alpen Gold', minPriceRub: 69, regularPriceRub: 99, packageSize: '85 г', isDiscounted: true },
    { name: 'Milka', minPriceRub: 95, regularPriceRub: 145, packageSize: '85 г', isDiscounted: true },
    { name: 'Яшкино', minPriceRub: 55, regularPriceRub: 85, packageSize: 'вафли 200 г', isDiscounted: true },
  ],
  дом: [
    { name: 'Synergetic', minPriceRub: 149, regularPriceRub: 220, packageSize: '1 л', isDiscounted: true },
    { name: 'Fairy', minPriceRub: 159, regularPriceRub: 235, packageSize: '900 мл', isDiscounted: true },
    { name: 'Grass', minPriceRub: 139, regularPriceRub: 199, packageSize: '600 мл', isDiscounted: true },
    { name: 'Zewa', minPriceRub: 189, regularPriceRub: 260, packageSize: '4 рул', isDiscounted: true },
  ],
};

const STORAGE_KEY = 'notebook_brand_preferences_v1';

/**
 * Loads brand preference counts from localStorage
 * Format: { "молоко": { "Простоквашино": 5, "ВкусВилл": 1 } }
 */
export function loadBrandPreferences(): Record<string, Record<string, number>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Records that the user selected or preferred a specific manufacturer/brand
 */
export function recordBrandChoice(productKey: string, brandName: string): void {
  if (typeof window === 'undefined') return;
  try {
    const prefs = loadBrandPreferences();
    const key = productKey.toLowerCase().trim();
    if (!prefs[key]) prefs[key] = {};
    prefs[key][brandName] = (prefs[key][brandName] || 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Silent fallback
  }
}

/**
 * Returns user's most frequently chosen brand for a given product keyword
 */
export function getTopPreferredBrand(productKey: string): string | null {
  const prefs = loadBrandPreferences();
  const key = productKey.toLowerCase().trim();
  const counts = prefs[key];
  if (!counts) return null;

  let maxCount = 0;
  let topBrand: string | null = null;
  for (const [brand, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      topBrand = brand;
    }
  }
  return topBrand;
}

/**
 * Identifies the best brand options for a given shopping item name
 */
export function getBrandsForItem(itemName: string, category?: ShoppingCategory): {
  key: string;
  options: BrandOption[];
  preferredBrand: string | null;
  minPrice: number;
  regularPrice: number;
} {
  const lower = itemName.toLowerCase();
  let matchedKey = 'молоко';
  let matchedOptions: BrandOption[] = BRAND_CATALOG['молоко'];

  for (const [key, options] of Object.entries(BRAND_CATALOG)) {
    if (lower.includes(key)) {
      matchedKey = key;
      matchedOptions = options;
      break;
    }
  }

  // If no direct keyword match, map by category
  if (!matchedOptions) {
    if (category === 'dairy') {
      matchedKey = 'молоко';
      matchedOptions = BRAND_CATALOG['молоко'];
    } else if (category === 'bakery') {
      matchedKey = 'хлеб';
      matchedOptions = BRAND_CATALOG['хлеб'];
    } else if (category === 'meat') {
      matchedKey = 'мясо';
      matchedOptions = BRAND_CATALOG['мясо'];
    } else if (category === 'drinks') {
      matchedKey = 'чай';
      matchedOptions = BRAND_CATALOG['чай'];
    } else if (category === 'sweets') {
      matchedKey = 'сладости';
      matchedOptions = BRAND_CATALOG['сладости'];
    } else if (category === 'household') {
      matchedKey = 'дом';
      matchedOptions = BRAND_CATALOG['дом'];
    } else {
      matchedKey = 'макароны';
      matchedOptions = BRAND_CATALOG['макароны'];
    }
  }

  const preferredBrand = getTopPreferredBrand(matchedKey);

  // Sort options: preferred brand first, then lowest price
  const sortedOptions = [...matchedOptions].sort((a, b) => {
    if (preferredBrand && a.name === preferredBrand) return -1;
    if (preferredBrand && b.name === preferredBrand) return 1;
    return a.minPriceRub - b.minPriceRub;
  });

  const minPrice = Math.min(...matchedOptions.map((o) => o.minPriceRub));
  const regularPrice = Math.max(...matchedOptions.map((o) => o.regularPriceRub));

  return {
    key: matchedKey,
    options: sortedOptions,
    preferredBrand,
    minPrice,
    regularPrice,
  };
}

/**
 * Calculates complete lowest basket price and total savings across all shopping items
 */
export function calculateBasketAnalytics(items: ShoppingItem[]): {
  minBasketTotal: number;
  regularBasketTotal: number;
  totalSavingsRub: number;
  savingsPercent: number;
  itemsWithDiscountsCount: number;
  bestDeals: Array<{
    item: ShoppingItem;
    bestBrand: BrandOption;
    isUserFavorite: boolean;
  }>;
} {
  let minBasketTotal = 0;
  let regularBasketTotal = 0;
  let itemsWithDiscountsCount = 0;
  const bestDeals: Array<{
    item: ShoppingItem;
    bestBrand: BrandOption;
    isUserFavorite: boolean;
  }> = [];

  for (const item of items) {
    if (item.isCompleted) continue;

    const brandData = getBrandsForItem(item.name, item.category);
    // Find best deal: if user has a favorite brand, prioritize it if price is good, else lowest price
    let chosen = brandData.options[0];
    if (brandData.preferredBrand) {
      const fav = brandData.options.find((o) => o.name === brandData.preferredBrand);
      if (fav) chosen = fav;
    }

    minBasketTotal += chosen.minPriceRub;
    regularBasketTotal += chosen.regularPriceRub;
    if (chosen.isDiscounted) itemsWithDiscountsCount++;

    bestDeals.push({
      item,
      bestBrand: chosen,
      isUserFavorite: chosen.name === brandData.preferredBrand,
    });
  }

  const totalSavingsRub = Math.max(0, regularBasketTotal - minBasketTotal);
  const savingsPercent =
    regularBasketTotal > 0
      ? Math.round((totalSavingsRub / regularBasketTotal) * 100)
      : 0;

  return {
    minBasketTotal,
    regularBasketTotal,
    totalSavingsRub,
    savingsPercent,
    itemsWithDiscountsCount,
    bestDeals,
  };
}
