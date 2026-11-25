import { describe, it, expect } from 'vitest';
import { detectSmartCategory } from './smartCategoryDetector';
import { analyzeNote } from './mathEngine';
import { extractShoppingItems } from './shoppingParser';

describe('detectSmartCategory', () => {
  const fixedNow = new Date('2026-11-25T10:00:00');

  it('suggests Финансы (payment) for budgets and expenses', () => {
    const content = 'Зарплата: +120000 ₽\nАренда квартиры: -35000 ₽\nКоммуналка: -4500 ₽';
    const calcSummary = analyzeNote(content, 'note', true);
    const suggestion = detectSmartCategory('Бюджет на месяц', content, 'note', {
      calcSummary,
      shoppingItemsCount: extractShoppingItems(content).length,
      now: fixedNow,
    });

    expect(suggestion).not.toBeNull();
    expect(suggestion?.category).toBe('payment');
    expect(suggestion?.label).toBe('Финансы');
    expect(suggestion?.confidence).toBe('high');
  });

  it('suggests Покупки (shopping) for grocery lists even with prices', () => {
    const content = 'Молоко 2 л - 180 ₽\nХлеб 1 шт - 60 ₽\nЯйца 10 шт - 140 ₽\nСыр 300 г - 320 ₽';
    const calcSummary = analyzeNote(content, 'note', true);
    const shoppingItemsCount = extractShoppingItems(content).length;
    const suggestion = detectSmartCategory('Список покупок в магазин', content, 'note', {
      calcSummary,
      shoppingItemsCount,
      now: fixedNow,
    });

    expect(suggestion).not.toBeNull();
    expect(suggestion?.category).toBe('shopping');
    expect(suggestion?.label).toBe('Покупки');
  });

  it('suggests Событие (event) and extracts date, time, and subcategory', () => {
    const content = 'Встреча со стоматологом завтра в 15:30 на ул. Ленина';
    const suggestion = detectSmartCategory('Запись к врачу', content, 'note', {
      now: fixedNow,
    });

    expect(suggestion).not.toBeNull();
    expect(suggestion?.category).toBe('event');
    expect(suggestion?.label).toBe('Событие');
    expect(suggestion?.extractedEventDate).toBe('2026-11-26');
    expect(suggestion?.extractedEventTime).toBe('15:30');
    expect(suggestion?.extractedEventSubcategory).toBe('meeting');
  });

  it('extracts Russian day and month dates for events', () => {
    const content = 'День рождения мамы 28 ноября в 18:00, заказать торт';
    const suggestion = detectSmartCategory('Праздник', content, 'note', {
      now: fixedNow,
    });

    expect(suggestion).not.toBeNull();
    expect(suggestion?.category).toBe('event');
    expect(suggestion?.extractedEventDate).toBe('2026-11-28');
    expect(suggestion?.extractedEventTime).toBe('18:00');
    expect(suggestion?.extractedEventSubcategory).toBe('birthday');
  });

  it('returns null when note is already in the detected category', () => {
    const content = 'Зарплата: +90000 ₽\nКредит: -20000 ₽';
    const calcSummary = analyzeNote(content, 'payment', true);
    const suggestion = detectSmartCategory('Бюджет', content, 'payment', {
      calcSummary,
      now: fixedNow,
    });

    expect(suggestion).toBeNull();
  });

  it('returns null for short or generic non-categorical text', () => {
    const suggestion = detectSmartCategory('Мысли', 'Просто небольшая заметка на память', 'note', {
      now: fixedNow,
    });

    expect(suggestion).toBeNull();
  });
});
