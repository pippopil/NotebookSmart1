/**
 * AI-powered Auto-tagging Service for NotebookSmart
 * Analyzes note title, content, and category using server-side Gemini,
 * with a high-fidelity local heuristic classifier fallback for instant/offline response,
 * strict privacy controls (DS R-AI-04 / A-02), and metadata-only audit logging.
 */

export interface AutoTagResult {
  tags: string[];
  isAiGenerated: boolean;
  source: 'gemini' | 'heuristic';
  blockedReason?: 'ai_disabled' | 'consent_required' | 'offline' | 'api_error';
}

export interface AiCallLogEntry {
  id: string;
  type: 'auto_tag';
  timestamp: number;
  sizeChars: number;
  source: 'gemini' | 'heuristic';
}

export interface GenerateAutoTagsOptions {
  /**
   * When true, allows network call to Gemini if AI is enabled and user has given consent.
   * Background/automatic triggers MUST keep this false (A-02 privacy-by-default).
   */
  allowNetwork?: boolean;
}

export const AI_DISABLED_STORAGE_KEY = 'notebook_smart_ai_disabled';
export const AI_CONSENT_STORAGE_KEY = 'notebook_smart_ai_consent_given';
export const AI_CALL_LOG_STORAGE_KEY = 'notebook_smart_ai_call_log';
const MAX_AI_LOG_ENTRIES = 100;

/**
 * Standard popular quick-tag suggestions for everyday organization
 */
export const POPULAR_TAGS = [
  '#work',
  '#personal',
  '#urgent',
  '#shopping',
  '#finances',
  '#health',
  '#home',
  '#study',
  '#travel',
  '#ideas',
];

/**
 * Returns whether the user has disabled all outbound AI calls in settings (R-AI-04).
 *
 * @returns true when AI is completely disabled
 */
export function isAiDisabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(AI_DISABLED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists the "Disable AI completely" setting (R-AI-04).
 *
 * @param disabled - True to block all outbound AI calls
 */
export function setAiDisabled(disabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AI_DISABLED_STORAGE_KEY, disabled ? 'true' : 'false');
    }
  } catch {
    // ignore storage quota issues
  }
}

/**
 * Returns whether the user has explicitly consented to sending note text to Gemini (A-02 / R-AI-04).
 *
 * @returns true if consent was granted
 */
export function hasAiConsent(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(AI_CONSENT_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Saves explicit user consent for outbound Gemini AI processing.
 *
 * @param consented - Consent flag
 */
export function setAiConsent(consented: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AI_CONSENT_STORAGE_KEY, consented ? 'true' : 'false');
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Appends a privacy-safe metadata entry (NO note content!) to the local AI audit log.
 *
 * @param entry - Metadata of the AI call (type, sizeChars, source)
 */
export function recordAiCallMetadata(entry: Omit<AiCallLogEntry, 'id' | 'timestamp'>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const existing = getAiCallLogs();
    const next: AiCallLogEntry[] = [
      {
        id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        type: entry.type,
        sizeChars: entry.sizeChars,
        source: entry.source,
      },
      ...existing,
    ].slice(0, MAX_AI_LOG_ENTRIES);
    localStorage.setItem(AI_CALL_LOG_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

/**
 * Reads local AI audit log entries (strictly metadata: type, date, size; never note content).
 *
 * @returns Array of metadata log entries
 */
export function getAiCallLogs(): AiCallLogEntry[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(AI_CALL_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is AiCallLogEntry =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as AiCallLogEntry).timestamp === 'number' &&
        typeof (item as AiCallLogEntry).sizeChars === 'number'
    );
  } catch {
    return [];
  }
}

/**
 * Clears the local AI audit log.
 */
export function clearAiCallLogs(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AI_CALL_LOG_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Local heuristic tag generator: analyzes text for high-confidence keywords.
 * Works completely offline or when Gemini API is unreachable or disabled.
 *
 * @param title - Note title
 * @param content - Note body text
 * @param category - Note category
 * @returns Up to 4 normalized hashtags
 */
export function extractSmartTagsLocally(
  title: string = '',
  content: string = '',
  category: string = 'note'
): string[] {
  const text = `${title} ${content}`.toLowerCase();
  const tags = new Set<string>();

  // 1. Urgency detection
  if (
    /срочн|важн|горит|дедлайн|asap|urgent|быстр|скорее|сегодня|до конца|не забыть|priorit/.test(text)
  ) {
    tags.add('#urgent');
  }

  // 2. Work / Career / Business detection
  if (
    /работ|проект|созвон|отчет|митинг|клиент|договор|шеф|коллег|work|job|задач|task|бизнес|meeting|звонок|презентац|руковод|контракт/.test(
      text
    )
  ) {
    tags.add('#work');
  }

  // 3. Personal / Home / Family detection
  if (
    /личн|семь|дом|ребенок|дет|квартир|мама|пап|жен|муж|уборк|быт|personal|home|отдых|семья|ремонт/.test(
      text
    )
  ) {
    tags.add('#personal');
  }

  // 4. Shopping detection
  if (
    category === 'shopping' ||
    /куп|магазин|продукт|молок|хлеб|список|озон|ozon|вайлдберриз|wb|вкусвилл|доставк|shopping|заказ|чек|рынок|супермаркет/.test(
      text
    )
  ) {
    tags.add('#shopping');
  }

  // 5. Finances / Budget detection
  if (
    category === 'payment' ||
    /руб|\$|€|зарплат|расход|доход|оплат|деньг|бюджет|перевод|счет|карт|нал|finance|деньги|налог|аренд|коммуналк|баланс|трат/.test(
      text
    )
  ) {
    tags.add('#finances');
  }

  // 6. Health & Medical detection
  if (
    /врач|доктор|аптек|таблет|лекарств|анализ|спорт|тренировк|здоров|больниц|поликлиник|health|витамин|рецепт/.test(
      text
    )
  ) {
    tags.add('#health');
  }

  // 7. Travel & Events detection
  if (
    category === 'event' ||
    /билет|поезд|самолет|отель|отпуск|поездк|тур|рейс|гостиниц|travel|путешеств|вылет|аэропорт/.test(
      text
    )
  ) {
    tags.add('#travel');
  }

  // 8. Study & Reading detection
  if (
    /учеб|лекци|книг|экзамен|курс|домашк|конспект|study|read|стать|вебинар|урок/.test(
      text
    )
  ) {
    tags.add('#study');
  }

  // 9. Creative Ideas detection
  if (/иде|мысл|план|проект|задумк|concept|idea|вдохновен/.test(text)) {
    tags.add('#ideas');
  }

  // If no specific tags matched, add default based on category
  if (tags.size === 0) {
    if (category === 'shopping') tags.add('#shopping');
    else if (category === 'payment') tags.add('#finances');
    else if (category === 'event') tags.add('#personal');
    else tags.add('#personal');
  }

  return Array.from(tags).slice(0, 4);
}

/**
 * Normalizes a tag string by prefixing with '#' and cleaning characters.
 *
 * @param tag - Raw tag string
 * @returns Normalized lowercase hashtag or empty string
 */
export function normalizeTag(tag: string): string {
  let cleaned = tag.trim().toLowerCase().replace(/^[#@]+/, '');
  cleaned = cleaned.replace(/\s+/g, '-').replace(/[^a-z0-9а-яё_-]/gi, '');
  return cleaned ? `#${cleaned}` : '';
}

/**
 * Generates tags using server-side Gemini with privacy-by-default enforcement and
 * instant offline heuristic fallback (QW 1.2 + DS R-AI-04 / A-02).
 *
 * @param title - Note title
 * @param content - Note content
 * @param category - Note category
 * @param options - Controls whether outbound network call is allowed
 * @returns AutoTagResult containing tags, source, and optional fallback reason
 */
export async function generateAutoTags(
  title: string,
  content: string,
  category: string = 'note',
  options: GenerateAutoTagsOptions = {}
): Promise<AutoTagResult> {
  const combined = `${title}\n${content}`.trim();
  const localTags = extractSmartTagsLocally(title, content, category);

  // If content is empty/super short or caller requested local-only mode, skip network
  if (combined.length < 3 || !options.allowNetwork) {
    return {
      tags: localTags,
      isAiGenerated: false,
      source: 'heuristic',
    };
  }

  // Hard privacy gate: "Disable AI completely" (DS R-AI-04 / AC-06)
  if (isAiDisabled()) {
    return {
      tags: localTags,
      isAiGenerated: false,
      source: 'heuristic',
      blockedReason: 'ai_disabled',
    };
  }

  // Consent gate: never transmit note content without explicit user consent (DS A-02)
  if (!hasAiConsent()) {
    return {
      tags: localTags,
      isAiGenerated: false,
      source: 'heuristic',
      blockedReason: 'consent_required',
    };
  }

  // Fast offline fallback without waiting for request timeout
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      tags: localTags,
      isAiGenerated: false,
      source: 'heuristic',
      blockedReason: 'offline',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500); // 6.5s timeout

    const response = await fetch('/api/auto-tag', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content,
        category,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data: unknown = await response.json();
      const rawTags =
        data && typeof data === 'object' && 'tags' in data && Array.isArray((data as { tags: unknown }).tags)
          ? (data as { tags: unknown[] }).tags
          : [];

      const formatted = rawTags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => normalizeTag(t))
        .filter((t) => t.length > 1);

      if (formatted.length > 0) {
        recordAiCallMetadata({
          type: 'auto_tag',
          sizeChars: combined.length,
          source: 'gemini',
        });

        return {
          tags: formatted,
          isAiGenerated: true,
          source: 'gemini',
        };
      }
    }
  } catch (err) {
    // Log error type only — NEVER log note content (DS Section 9 #12)
    console.warn('[NotebookSmart] Auto-tag network fallback activated:', err instanceof Error ? err.name : 'error');
  }

  // Fallback to high quality local heuristics
  return {
    tags: localTags,
    isAiGenerated: false,
    source: 'heuristic',
    blockedReason: 'api_error',
  };
}
