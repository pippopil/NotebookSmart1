import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  clearAiCallLogs,
  extractSmartTagsLocally,
  generateAutoTags,
  getAiCallLogs,
  setAiConsent,
  setAiDisabled,
} from './aiTagging';

// Minimal in-memory localStorage mock for Node Vitest environment
const memoryStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => (memoryStorage.has(key) ? memoryStorage.get(key)! : null),
  setItem: (key: string, value: string) => {
    memoryStorage.set(key, String(value));
  },
  removeItem: (key: string) => {
    memoryStorage.delete(key);
  },
  clear: () => {
    memoryStorage.clear();
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  configurable: true,
});

describe('aiTagging — offline fallback & privacy controls (QW 1.2 + DS R-AI-04 / AC-06)', () => {
  beforeEach(() => {
    memoryStorage.clear();
    clearAiCallLogs();
    vi.restoreAllMocks();
  });

  it('extracts accurate local tags offline for shopping and finances', () => {
    expect(extractSmartTagsLocally('Покупки', 'Купить молоко и продукты в магазине')).toContain('#shopping');
    expect(extractSmartTagsLocally('Бюджет', 'Зарплата 100000 руб и траты')).toContain('#finances');
  });

  it('blocks outbound AI fetch completely when aiDisabled is enabled (AC-06)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    setAiConsent(true);
    setAiDisabled(true);

    const res = await generateAutoTags('Бюджет', 'Зарплата 120000 руб', 'payment', {
      allowNetwork: true,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.source).toBe('heuristic');
    expect(res.blockedReason).toBe('ai_disabled');
    expect(res.tags).toContain('#finances');
  });

  it('blocks outbound AI fetch when user consent has not been given (A-02)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    setAiDisabled(false);
    setAiConsent(false);

    const res = await generateAutoTags('Проект', 'Срочный созвон с клиентом', 'note', {
      allowNetwork: true,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.blockedReason).toBe('consent_required');
    expect(res.tags).toContain('#work');
  });

  it('falls back gracefully to local tags on network failure without throwing', async () => {
    setAiDisabled(false);
    setAiConsent(true);
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network down'));

    const res = await generateAutoTags('Магазин', 'Купить хлеб и молоко', 'shopping', {
      allowNetwork: true,
    });

    expect(res.source).toBe('heuristic');
    expect(res.blockedReason).toBe('api_error');
    expect(res.tags).toContain('#shopping');
  });

  it('logs ONLY metadata (no note content!) on successful Gemini call', async () => {
    setAiDisabled(false);
    setAiConsent(true);
    const secretContent = 'СЕКРЕТНЫЙ_ПАРОЛЬ_И_СУММА_999999';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tags: ['#finances', '#urgent'] }),
    } as Response);

    const res = await generateAutoTags('Личное', secretContent, 'note', {
      allowNetwork: true,
    });

    expect(res.source).toBe('gemini');
    expect(res.isAiGenerated).toBe(true);
    expect(res.tags).toEqual(['#finances', '#urgent']);

    const logs = getAiCallLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('auto_tag');
    expect(logs[0].sizeChars).toBeGreaterThan(0);
    // Guarantee zero note content in persisted log
    expect(JSON.stringify(logs)).not.toContain(secretContent);
  });
});
