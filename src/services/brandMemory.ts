import { ShoppingCategory } from '../types';

export interface BrandPreference {
  brandName: string;
  count: number;
  lastUsed: number;
}

// Default popular brands for Russian retail / grocery categories
export const POPULAR_CATEGORY_BRANDS: Record<ShoppingCategory, string[]> = {
  dairy: [
    'Простоквашино',
    'Домик в деревне',
    'Брест-Литовск',
    'ВкусВилл',
    'Село Зелёное',
    'Экомилк',
    'Пискарёвский',
    'Коровка из Кореновки',
  ],
  bakery: [
    'Коломенское',
    'Хлебный Дом',
    'Каравай',
    'Черёмушки',
    'Волжский пекарь',
    'Fazer',
    'ВкусВилл',
  ],
  meat: [
    'Мираторг',
    'Черкизово',
    'Останкино',
    'ВкусВилл',
    'Ближние Горки',
    'Петелинка',
    'Дымов',
    'Вязанка',
  ],
  produce: [
    'Фламенко',
    'Моё лето',
    'Белая Дача',
    'Эко-культура',
    'ВкусВилл',
    'Global Village',
  ],
  grocery: [
    'Макфа',
    'Мистраль',
    'Barilla',
    'Увелка',
    'Шебекинские',
    'Агро-Альянс',
    'Borges',
    'Heinz',
  ],
  drinks: [
    'Greenfield',
    'Tess',
    'Jacobs',
    'Lavazza',
    'Добрый',
    'Rich',
    'J7',
    'Святой Источник',
  ],
  sweets: [
    'Бабаевский',
    'Красный Октябрь',
    'Рот Фронт',
    'Алёнка',
    'Победа',
    'Alpen Gold',
    'Milka',
  ],
  household: [
    'Fairy',
    'Synergetic',
    'Ariel',
    'Tide',
    'Grass',
    'Colgate',
    'Splat',
    'Zewa',
  ],
  other: [
    'ВкусВилл',
    'Красная цена',
    'Каждый день',
    'Маркет Перекрёсток',
  ],
};

const STORAGE_KEY = 'notebook_brand_preferences_v1';

// Benchmark price ratio for calculating minimum prices across stores
export const MIN_PRICE_DISCOUNT_RATIO = 0.72; // ~28% discount for minimum / promotional price in discounters

/**
 * Loads brand selection counts from localStorage
 */
export function getBrandHistory(): Record<string, BrandPreference> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Records that the user selected or typed a specific brand/manufacturer
 */
export function recordBrandChoice(brandName: string): void {
  if (typeof window === 'undefined' || !brandName) return;
  const cleanBrand = brandName.trim();
  if (cleanBrand.length < 2) return;

  try {
    const history = getBrandHistory();
    const existing = history[cleanBrand.toLowerCase()];
    history[cleanBrand.toLowerCase()] = {
      brandName: cleanBrand,
      count: (existing?.count || 0) + 1,
      lastUsed: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Failed to save brand choice', err);
  }
}

/**
 * Returns the brand the user chooses most frequently for a category or item
 */
export function getMostPreferredBrand(category: ShoppingCategory, itemName?: string): string | null {
  const suggestions = getTopSuggestedBrands(category, itemName);
  return suggestions.length > 0 ? suggestions[0] : null;
}

/**
 * Returns top suggested manufacturers/brands, prioritized by user selection frequency
 */
export function getTopSuggestedBrands(category: ShoppingCategory, itemName?: string): string[] {
  const history = getBrandHistory();
  const defaultList = POPULAR_CATEGORY_BRANDS[category] || POPULAR_CATEGORY_BRANDS.other;

  // Extract any brand mentions from item text if already present
  const allCandidateBrands = Array.from(new Set([
    ...Object.values(history).map((h) => h.brandName),
    ...defaultList,
  ]));

  // Score candidate brands
  const scored = allCandidateBrands.map((brand) => {
    const hist = history[brand.toLowerCase()];
    const count = hist?.count || 0;
    const isCategoryDefault = defaultList.includes(brand);
    // Score based on count + default bonus
    const score = count * 10 + (isCategoryDefault ? 2 : 0);
    return { brand, score, count };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 6).map((s) => s.brand);
}

/**
 * Calculates minimum basket price and savings
 */
export function calculateBasketMinPrices(items: { estimatedPriceRub?: number }[]) {
  const regularTotal = items.reduce((sum, item) => sum + (item.estimatedPriceRub || 150), 0);
  const minTotal = Math.round(regularTotal * MIN_PRICE_DISCOUNT_RATIO);
  const savings = Math.max(0, regularTotal - minTotal);

  return {
    regularTotal,
    minTotal,
    savings,
    savingsPercent: regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0,
  };
}
