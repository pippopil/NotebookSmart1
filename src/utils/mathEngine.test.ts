import { describe, it, expect } from 'vitest';
import {
  analyzeLine,
  analyzeNote,
  safeEvalMath,
  formatMoney,
  normalizeNumbers,
  normalizeMultipliers,
} from './mathEngine';

describe('mathEngine — core financial & arithmetic parser (QW 1.3)', () => {
  it('evaluates percentage discount "3000 - 15%" to 2550', () => {
    expect(safeEvalMath('3000 - 15%')).toBe(2550);
    const line = analyzeLine('3000 - 15%', 1);
    expect(line.result).toBe(2550);
  });

  it('evaluates piece multiplication "5 шт * 380" to 1900 with piece unit', () => {
    const line = analyzeLine('5 шт * 380', 1);
    expect(line.result).toBe(1900);
    expect(line.isPieceCalculation).toBe(true);
    expect(line.currency).toBe('шт.');
  });

  it('ignores meeting timestamps like "Встреча в 14:00"', () => {
    const line = analyzeLine('Встреча в 14:00', 1);
    expect(line.result).toBeNull();
    expect(line.lineKind).toBe('text');
  });

  it('ignores standalone calendar years like "2024 год"', () => {
    const line = analyzeLine('2024 год', 1);
    expect(line.result).toBeNull();
    expect(line.lineKind).toBe('text');
  });

  it('sums mid-expression currency amounts "Аренда 35 000 руб + 2400" to 37400 ₽', () => {
    const line = analyzeLine('Аренда 35 000 руб + 2400', 1);
    expect(line.result).toBe(37400);
    expect(line.currency).toBe('₽');
    expect(line.type).toBe('expense');
  });

  it('normalizes Russian multipliers and grouped thousands', () => {
    expect(normalizeMultipliers('3 тыс + 1.5к')).toBe('3000 + 1500');
    expect(normalizeNumbers('35 000 + 1.500,50')).toBe('35000 + 1500.50');
    expect(safeEvalMath('3 тыс + 1.5к')).toBe(4500);
  });

  it('ignores phone numbers and street addresses without financial context', () => {
    expect(analyzeLine('Позвонить +7 999 123-45-67', 1).result).toBeNull();
    expect(analyzeLine('ул. Ленина, дом 12, кв 45', 1).result).toBeNull();
  });

  it('computes net balance for multi-line income and expense notes', () => {
    const noteText = [
      '+ Зарплата: 100 000 руб',
      '- Аренда 35 000 руб + 2400',
      '- Кофе: 350 * 4',
      'Итого:',
    ].join('\n');

    const summary = analyzeNote(noteText, 'payment', true);
    expect(summary.totalIncome).toBe(100000);
    expect(summary.totalExpenses).toBe(38800);
    expect(summary.netBalance).toBe(61200);
    expect(summary.grandTotal).toBe(61200);
    expect(summary.hasIncomeExpenseSplit).toBe(true);
    expect(summary.currency).toBe('₽');
  });

  it('formats currencies and pieces cleanly', () => {
    expect(formatMoney(37400, '₽')).toBe('37 400 ₽');
    expect(formatMoney(1900, 'шт.')).toBe('1 900 шт.');
    expect(formatMoney(125.5, '$')).toBe('$125.50');
  });
});
