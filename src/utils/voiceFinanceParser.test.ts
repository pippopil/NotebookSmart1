import { describe, it, expect } from 'vitest';
import { parseVoiceFinanceAction } from './voiceFinanceParser';

describe('voiceFinanceParser — Voice-to-Action financial detection (QW 2.2)', () => {
  it('detects Russian expense phrase with rubles', () => {
    const res = parseVoiceFinanceAction('потратил 450 рублей на кофе');
    expect(res).not.toBeNull();
    expect(res?.direction).toBe('expense');
    expect(res?.amount).toBe(450);
    expect(res?.currency).toBe('₽');
    expect(res?.suggestedTag).toBe('#auto_voice');
    expect(res?.formattedLine).toBe('- потратил 450 рублей на кофе');
  });

  it('detects expense with symbol currency and thousands spaces', () => {
    const res = parseVoiceFinanceAction('заплатил 1 200 ₽ за такси');
    expect(res).not.toBeNull();
    expect(res?.amount).toBe(1200);
    expect(res?.currency).toBe('₽');
  });

  it('detects price in dollars', () => {
    const res = parseVoiceFinanceAction('цена 50 долларов');
    expect(res).not.toBeNull();
    expect(res?.direction).toBe('expense');
    expect(res?.amount).toBe(50);
    expect(res?.currency).toBe('$');
  });

  it('detects income phrase with Russian thousand multiplier', () => {
    const res = parseVoiceFinanceAction('получил зарплату 85 тысяч рублей');
    expect(res).not.toBeNull();
    expect(res?.direction).toBe('income');
    expect(res?.amount).toBe(85000);
    expect(res?.currency).toBe('₽');
    expect(res?.formattedLine.startsWith('+')).toBe(true);
  });

  it('returns null for non-financial dictated text', () => {
    expect(parseVoiceFinanceAction('встреча с командой в 15 часов')).toBeNull();
    expect(parseVoiceFinanceAction('купить молоко и хлеб')).toBeNull();
  });
});
