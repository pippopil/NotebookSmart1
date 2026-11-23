import { Note, ArchivedBudgetMonth, ArchivedShoppingTrip } from '../types';
import { analyzeNote } from '../utils/mathEngine';
import { extractShoppingItems } from '../utils/shoppingParser';
import {
  CURRENT_SCHEMA_VERSION,
  MigrationBackupRecord,
  pruneExpiredBackups,
  runVersionedMigrations,
} from './storageMigrations';

// Primary Storage & Protection Keys
export const STORAGE_KEY = 'notebook_smart_notes_v1';
export const USER_INITIALIZED_KEY = 'notebook_smart_user_initialized';
export const SAFE_BACKUP_KEY = 'notebook_smart_notes_safe_backup';
export const LAST_VERSION_KEY = 'notebook_smart_installed_version';
export const GLOBAL_AUTO_CALC_KEY = 'notebook_smart_global_auto_calc';
export const LITE_MODE_KEY = 'notebook_smart_lite_mode';
export const SCHEMA_VERSION_KEY = 'notebook_smart_schema_version';
export const PRE_UPDATE_BACKUP_KEY = 'notebook_smart_pre_update_backup';
export const ARCHIVED_BUDGETS_KEY = 'notebook_smart_archived_budgets_v1';
export const ARCHIVED_SHOPPING_KEY = 'notebook_smart_archived_shopping_v1';

/**
 * Reads user preference for "Text-only / Lite mode" (disables heavy visual effects, R-INFRA-05).
 */
export function getLiteMode(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(LITE_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Saves "Text-only / Lite mode" preference and applies CSS class to documentElement.
 */
export function saveLiteMode(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LITE_MODE_KEY, String(enabled));
    }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('lite-mode', enabled);
    }
  } catch {
    // ignore storage errors
  }
}

export function getGlobalAutoCalculate(): boolean {
  try {
    const saved = localStorage.getItem(GLOBAL_AUTO_CALC_KEY);
    return saved !== 'false';
  } catch {
    return true;
  }
}

export function saveGlobalAutoCalculate(enabled: boolean): void {
  try {
    localStorage.setItem(GLOBAL_AUTO_CALC_KEY, String(enabled));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notebook_autocalc_changed', { detail: { enabled } }));
    }
  } catch {}
}

/**
 * Ensures pre-update snapshot & migration flags are preserved across app version upgrades
 * without ever wiping or overwriting user notes with demo data.
 */
export function ensurePreUpdateBackupAndMigrate(targetVersion: string): void {
  try {
    const lastVer = localStorage.getItem(LAST_VERSION_KEY);
    const currentRaw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(SAFE_BACKUP_KEY);

    if (currentRaw && currentRaw !== '[]') {
      localStorage.setItem(USER_INITIALIZED_KEY, 'true');
      if (lastVer !== targetVersion) {
        localStorage.setItem(
          PRE_UPDATE_BACKUP_KEY,
          JSON.stringify({
            fromVersion: lastVer || 'unknown',
            toVersion: targetVersion,
            savedAt: Date.now(),
            raw: currentRaw,
          })
        );
      }
    }
    localStorage.setItem(LAST_VERSION_KEY, targetVersion);
  } catch (e) {
    console.warn('[NotebookSmart] Pre-update backup check warning:', e);
  }
}

const LEGACY_STORAGE_KEYS = [
  'notebook_smart_notes_v1',
  'notebook_smart_notes',
  'notebook_notes',
  'smart_notes_data',
  'notebook_smart_notes_safe_backup',
];

export const INITIAL_NOTES: Note[] = [
  {
    id: 'note-sample-budget-cashflow',
    title: '💰 Бюджет: Доходы и Расходы',
    content: `Учет финансов в тетрадке:

=== Доходы ===
+ Зарплата: 95 000 руб
+ Премия: 15 000
+ Подработка: 12 500

=== Расходы ===
- Аренда квартиры: 35 000 руб
- Продукты и супермаркет: 18 500
- Коммунальные услуги и интернет: 4 200 + 850
- Бензин и транспорт: 5 000
- Спортзал: 3 500

Остаток (чистая прибыль):`,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    updatedAt: Date.now() - 1000 * 60 * 15,
    category: 'payment',
    paperStyle: 'grid',
    color: '#10b981',
    isPinned: true,
    tags: ['Финансы', 'Прибыль', 'Бюджет'],
  },
  {
    id: 'note-sample-simple',
    title: '📝 Мысли и расчет оплат',
    content: `Заметки на полях тетради:
- Позвонить по поводу аренды
- Проверить показания счетчиков воды

Расчет платежей на этот месяц:
Аренда квартиры: 35000 руб
Электричество + свет: 1850 + 620
Интернет: 950 - 10%
Спортзал: 3200

Итого к оплате:`,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    updatedAt: Date.now() - 1000 * 60 * 30,
    category: 'note',
    paperStyle: 'grid',
    color: '#3b82f6',
    isPinned: true,
    tags: ['Заметки', 'Счета'],
  },
  {
    id: 'note-sample-groceries',
    title: '🛒 Список покупок на неделю',
    content: `Список продуктов в тетрадке:
- [ ] Молоко 3.2% 2 л
- [ ] Яйца С0 10 шт
- [ ] Сыр Гауда 300 г
- [ ] Хлеб бородинский 1 шт
- [ ] Кофе зерновой 500 г
- [x] Чай черный 1 пачка
- [ ] Куриное филе 1.2 кг
- [ ] Яблоки голден 1.5 кг
- [ ] Стиральный порошок автомат
- [ ] Бананы 1 кг

К чаю и десерты:
Шоколад темный: 120 * 3
Круассаны: 85 * 4`,
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
    updatedAt: Date.now() - 1000 * 60 * 10,
    category: 'shopping',
    paperStyle: 'grid',
    color: '#10b981',
    isPinned: true,
    reminderEnabled: true,
    reminderDateTime: '2026-10-15T18:30',
    tags: ['Покупки', 'Еда', 'Супермаркет'],
  },
  {
    id: 'note-sample-event',
    title: '📅 Событие: Встреча и презентация',
    content: `План мероприятия:
14:00 — Сбор команды и кофе-брейк: 450 * 5
14:30 — Презентация нового релиза NotebookSmart v1.4.0
16:00 — Обсуждение внедрения и ответы на вопросы

Подготовить материалы:
- [ ] Распечатать схемы тетради
- [ ] Проверить подключение проектора
- [x] Отправить ссылку на GitHub репозиторий`,
    createdAt: Date.now() - 1000 * 60 * 60 * 6,
    updatedAt: Date.now() - 1000 * 60 * 5,
    category: 'event',
    eventDate: '2026-10-15',
    eventTime: '14:00',
    isEventDone: false,
    paperStyle: 'grid',
    color: '#8b5cf6',
    isPinned: false,
    reminderEnabled: true,
    reminderDateTime: '2026-10-15T13:45',
    tags: ['События', 'Встречи', 'Планы'],
  },
];

// ================= PERMANENT STORAGE & INDEXEDDB BACKUP =================
const DB_NAME = 'NotebookSmartDB';
const DB_VERSION = 2;
const STORE_NOTES = 'notes';
const STORE_META = 'meta';
const STORE_BACKUP = '__backup__';

function openIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NOTES)) {
          db.createObjectStore(STORE_NOTES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_BACKUP)) {
          db.createObjectStore(STORE_BACKUP, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Persists a pre-migration backup record into IndexedDB `__backup__` store
 * and prunes expired backups (> 7 days old).
 */
async function saveMigrationBackupToIndexedDB(
  backup: MigrationBackupRecord,
  schemaVersion: number
): Promise<void> {
  try {
    const db = await openIndexedDB();
    if (!db) return;

    if (db.objectStoreNames.contains(STORE_BACKUP)) {
      const readTx = db.transaction(STORE_BACKUP, 'readwrite');
      const backupStore = readTx.objectStore(STORE_BACKUP);
      const getAllReq = backupStore.getAll();
      getAllReq.onsuccess = () => {
        const existing = Array.isArray(getAllReq.result)
          ? (getAllReq.result as MigrationBackupRecord[])
          : [];
        const valid = pruneExpiredBackups(existing);
        backupStore.clear();
        for (const record of valid) {
          backupStore.put(record);
        }
        backupStore.put(backup);
      };
    }

    if (db.objectStoreNames.contains(STORE_META)) {
      const metaTx = db.transaction(STORE_META, 'readwrite');
      metaTx.objectStore(STORE_META).put({
        key: 'schema',
        schemaVersion,
        migratedAt: Date.now(),
      });
    }
  } catch (e) {
    console.warn('[NotebookSmart] IndexedDB backup metadata warning:', e);
  }
}

/**
 * Runs schema migrations on loaded notes with automatic pre-migration snapshot and rollback.
 */
function applySchemaMigrations(notes: Note[]): Note[] {
  try {
    const storedVersionRaw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(SCHEMA_VERSION_KEY) : null;
    const storedVersion = storedVersionRaw ? Number.parseInt(storedVersionRaw, 10) : 1;
    const currentVersion = Number.isFinite(storedVersion) && storedVersion > 0 ? storedVersion : 1;

    if (currentVersion >= CURRENT_SCHEMA_VERSION) {
      return notes;
    }

    const result = runVersionedMigrations(notes, currentVersion, CURRENT_SCHEMA_VERSION);
    if (result.backupCreated) {
      void saveMigrationBackupToIndexedDB(result.backupCreated, result.toVersion);
    }

    if (!result.success && result.rolledBack) {
      console.warn('[NotebookSmart] Schema migration rolled back:', result.error);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('notebook_migration_error', {
            detail: { error: result.error, rolledBack: true },
          })
        );
      }
      return result.notes;
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SCHEMA_VERSION_KEY, String(result.toVersion));
    }
    return result.notes;
  } catch {
    return notes;
  }
}

export async function saveNotesToIndexedDB(notes: Note[], allowClearEmpty: boolean = false): Promise<void> {
  try {
    // Protect IndexedDB from being wiped during startup before async recovery completes
    if (notes.length === 0 && !allowClearEmpty) {
      return;
    }
    const db = await openIndexedDB();
    if (!db) return;
    const tx = db.transaction(STORE_NOTES, 'readwrite');
    const store = tx.objectStore(STORE_NOTES);
    store.clear();
    for (const note of notes) {
      store.put(note);
    }
  } catch (e) {
    console.warn('IndexedDB save notice:', e);
  }
}

export async function loadNotesFromIndexedDB(): Promise<Note[] | null> {
  try {
    const db = await openIndexedDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NOTES, 'readonly');
      const store = tx.objectStore(STORE_NOTES);
      const req = store.getAll();
      req.onsuccess = () => {
        const result = req.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Recovers user data from IndexedDB if localStorage was cleared during app update
 */
export async function restoreNotesFromIndexedDBIfEmpty(): Promise<Note[] | null> {
  try {
    const isUserInitialized = localStorage.getItem(USER_INITIALIZED_KEY) === 'true';
    const localRaw = localStorage.getItem(STORAGE_KEY);
    
    // Only attempt recovery if local is empty or null
    if (!localRaw || localRaw === '[]') {
      const idbNotes = await loadNotesFromIndexedDB();
      if (idbNotes && idbNotes.length > 0) {
        console.log(`[NotebookSmart] Restored ${idbNotes.length} user notes from IndexedDB after update`);
        saveNotes(idbNotes);
        return idbNotes;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Requests permanent storage permission so Android WebView / Mobile Safari
 * does NOT evict user notes during app updates or storage pressure.
 */
export function requestPersistentStorage(): void {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((persisted) => {
      if (persisted) {
        console.log('[NotebookSmart] Persistent storage active: notes will never be evicted.');
      }
    }).catch(() => {});
  }
}

// Counter tracking actual parser runs for incremental parsing verification (R-INFRA-03)
let incrementalParseInvocations = 0;

/**
 * Returns total number of full math/shopping parse executions performed since last reset.
 */
export function getIncrementalParseCount(): number {
  return incrementalParseInvocations;
}

/**
 * Resets the incremental parser invocation counter (used in unit tests).
 */
export function resetIncrementalParseCount(): void {
  incrementalParseInvocations = 0;
}

/**
 * Computes a fast deterministic fingerprint of note fields that affect math/shopping parsing.
 *
 * @param content - Note body text
 * @param category - Note category
 * @param autoCalc - Effective autoCalculate flag
 * @returns Compact fingerprint string
 */
export function computeNoteParseHash(
  content: string,
  category: string,
  autoCalc: boolean
): string {
  const input = `${category}|${autoCalc ? '1' : '0'}|${content}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return `${input.length}:${(hash >>> 0).toString(36)}`;
}

/**
 * Enriches note metadata incrementally: skips math & shopping re-parsing when the note's
 * content/category/autoCalc fingerprint matches `lastParsedHash` unless `forceRecalculate` is true.
 *
 * @param note - Note to enrich
 * @param globalAutoCalc - Optional override for global auto-calculation switch
 * @param forceRecalculate - Forces full re-parse even if fingerprint matches
 * @returns Note with up-to-date cached calculations and `lastParsedAt`
 */
export function enrichNoteMetadata(
  note: Note,
  globalAutoCalc?: boolean,
  forceRecalculate: boolean = false
): Note {
  const effectiveAutoCalc = globalAutoCalc !== undefined ? globalAutoCalc : getGlobalAutoCalculate();
  const content = note.content || '';
  const fingerprint = computeNoteParseHash(content, note.category, effectiveAutoCalc);

  if (
    !forceRecalculate &&
    note.lastParsedHash === fingerprint &&
    typeof note.lastParsedAt === 'number' &&
    typeof note.cachedTotal === 'number' &&
    typeof note.shoppingItemsCount === 'number'
  ) {
    return Array.isArray(note.tags) ? note : { ...note, tags: [] };
  }

  incrementalParseInvocations += 1;
  const math = analyzeNote(content, note.category, effectiveAutoCalc);
  const shopping = extractShoppingItems(content);

  return {
    ...note,
    tags: Array.isArray(note.tags) ? note.tags : [],
    cachedTotal: math.grandTotal,
    cachedIncome: math.totalIncome,
    cachedExpenses: math.totalExpenses,
    cachedNetBalance: math.netBalance,
    cachedPieces: math.totalPieces,
    currency: math.currency,
    shoppingItemsCount: shopping.length,
    completedItemsCount: shopping.filter((i) => i.isCompleted).length,
    lastParsedAt: Date.now(),
    lastParsedHash: fingerprint,
  };
}

/**
 * Forces a full re-parse of all notes (e.g., after math parser rules update, R-INFRA-03).
 *
 * @param notes - Notes array to recalculate
 * @param globalAutoCalc - Effective global auto-calculation setting
 * @returns Newly enriched notes array
 */
export function forceRecalculateAllNotes(notes: Note[], globalAutoCalc?: boolean): Note[] {
  return notes.map((n) => enrichNoteMetadata(n, globalAutoCalc, true));
}

/**
 * Loads notes with multi-tiered protection:
 * 1. Primary localStorage key
 * 2. Legacy storage keys migration
 * 3. Safe permanent backup key
 * 4. User initialization guard (NEVER injects demo notes after first install)
 */
export function loadNotes(): Note[] {
  try {
    requestPersistentStorage();

    // 1. Try to load from primary storage key
    let raw = localStorage.getItem(STORAGE_KEY);

    // 2. If primary storage is empty, check legacy keys
    if (!raw) {
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const legacyData = localStorage.getItem(legacyKey);
        if (legacyData && legacyData !== '[]') {
          raw = legacyData;
          localStorage.setItem(STORAGE_KEY, legacyData);
          break;
        }
      }
    }

    // 3. Check if user already installed and used the app previously
    const isUserInitialized = localStorage.getItem(USER_INITIALIZED_KEY) === 'true';

    if (raw) {
      try {
        const parsed: Note[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // If the user already used the app and emptied their notes, respect their choice
          if (parsed.length === 0 && isUserInitialized) {
            return [];
          }

          if (parsed.length > 0) {
            // Run versioned schema migrations with backup & rollback protection
            const migrated = applySchemaMigrations(parsed);
            // Keep safe backup updated
            localStorage.setItem(SAFE_BACKUP_KEY, JSON.stringify(migrated));
            localStorage.setItem(USER_INITIALIZED_KEY, 'true');
            saveNotesToIndexedDB(migrated);
            return migrated.map((n) => enrichNoteMetadata(n));
          }
        }
      } catch (err) {
        console.warn('Failed parsing notes JSON, checking safe backup recovery', err);
      }
    }

    // 4. Try recovery from safe backup or pre-update snapshot
    const backupRaw = localStorage.getItem(SAFE_BACKUP_KEY);
    if (backupRaw) {
      try {
        const backupParsed: Note[] = JSON.parse(backupRaw);
        if (Array.isArray(backupParsed) && backupParsed.length > 0) {
          console.log(`[NotebookSmart] Recovered ${backupParsed.length} notes from safe backup.`);
          saveNotes(backupParsed);
          return backupParsed.map((n) => enrichNoteMetadata(n));
        }
      } catch {}
    }

    const preUpdateRaw = localStorage.getItem(PRE_UPDATE_BACKUP_KEY);
    if (preUpdateRaw) {
      try {
        const snap = JSON.parse(preUpdateRaw);
        const snapNotes: Note[] = typeof snap?.raw === 'string' ? JSON.parse(snap.raw) : [];
        if (Array.isArray(snapNotes) && snapNotes.length > 0) {
          console.log(`[NotebookSmart] Recovered ${snapNotes.length} notes from pre-update snapshot.`);
          saveNotes(snapNotes);
          return snapNotes.map((n) => enrichNoteMetadata(n));
        }
      } catch {}
    }

    // 5. Existing user protection: If user has used the app previously, DO NOT replace with demo notes!
    if (isUserInitialized) {
      console.log('[NotebookSmart] Existing user detected. Retaining user data without demo notes.');
      return [];
    }

    // 6. First-time brand new install ONLY:
    console.log('[NotebookSmart] First-time install: initializing introductory sample notes.');
    const enriched = INITIAL_NOTES.map((n) => enrichNoteMetadata(n));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enriched));
    localStorage.setItem(SAFE_BACKUP_KEY, JSON.stringify(enriched));
    localStorage.setItem(USER_INITIALIZED_KEY, 'true');
    saveNotesToIndexedDB(enriched);
    return enriched;
  } catch (e) {
    console.error('Failed to load notes from localStorage', e);
    // If user was initialized, never inject demo notes on failure
    if (localStorage.getItem(USER_INITIALIZED_KEY) === 'true') {
      return [];
    }
    return INITIAL_NOTES.map((n) => enrichNoteMetadata(n));
  }
}

export function saveNotes(notes: Note[], allowClearEmpty: boolean = false): void {
  try {
    const serialized = JSON.stringify(notes);
    localStorage.setItem(STORAGE_KEY, serialized);

    // If user has notes, maintain the safe backup
    if (notes.length > 0) {
      localStorage.setItem(SAFE_BACKUP_KEY, serialized);
    }
    localStorage.setItem(USER_INITIALIZED_KEY, 'true');

    // Async persistent IndexedDB write
    saveNotesToIndexedDB(notes, allowClearEmpty);
  } catch (e) {
    console.error('Failed to save notes to localStorage', e);
  }
}

// ================= ARCHIVE OF PREVIOUS MONTHS & COMPLETED SHOPPING =================

export const INITIAL_ARCHIVED_BUDGETS: ArchivedBudgetMonth[] = [
  {
    id: 'archive-budget-2026-09',
    year: 2026,
    month: 9,
    monthName: 'Сентябрь 2026',
    closedAt: new Date(2026, 8, 30, 23, 59).getTime(),
    totalIncome: 132500,
    totalExpenses: 76800,
    netBalance: 55700,
    currency: 'руб',
    notesCount: 2,
    summaryComment: 'Успешный месяц, выполнили цель по накоплениям на 112%!',
    notesSnapshot: [
      {
        id: 'note-snapshot-sep-main',
        title: '💰 Доходы и Расходы Сентябрь 2026',
        content: `=== Доходы ===\n+ Зарплата: 95 000 руб\n+ Премия за проект: 25 000\n+ Подработка и дивиденды: 12 500\n\n=== Расходы ===\n- Аренда жилья: 35 000 руб\n- Продукты питания: 19 200\n- Коммунальные услуги и связь: 4 600\n- Транспорт и ТО: 8 000\n- Кафе и отдых: 10 000\n\nОстаток в итоге: 55 700 руб`,
        income: 132500,
        expenses: 76800,
        balance: 55700,
      },
    ],
  },
  {
    id: 'archive-budget-2026-08',
    year: 2026,
    month: 8,
    monthName: 'Август 2026',
    closedAt: new Date(2026, 7, 31, 23, 59).getTime(),
    totalIncome: 125000,
    totalExpenses: 84300,
    netBalance: 40700,
    currency: 'руб',
    notesCount: 1,
    summaryComment: 'Отпускной месяц: закрыли расходы на билеты и гостиницу.',
    notesSnapshot: [
      {
        id: 'note-snapshot-aug-main',
        title: '💰 Бюджет Август 2026 (Отпуск)',
        content: `=== Доходы ===\n+ Зарплата: 95 000 руб\n+ Отпускные: 30 000\n\n=== Расходы ===\n- Аренда: 35 000 руб\n- Путевка и билеты: 32 000\n- Питание: 14 300\n- Прочие траты: 3 000\n\nОстаток в итоге: 40 700 руб`,
        income: 125000,
        expenses: 84300,
        balance: 40700,
      },
    ],
  },
];

export const INITIAL_ARCHIVED_SHOPPING: ArchivedShoppingTrip[] = [
  {
    id: 'archive-shopping-oct-party',
    sourceNoteId: 'note-old-shopping-1',
    title: '🛒 Закупка к семейному празднику',
    completedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    monthName: 'Октябрь 2026',
    itemsCount: 7,
    totalSpent: 4850,
    currency: 'руб',
    items: [
      { name: 'Торт медовый 1 кг', category: 'sweets', estimatedPrice: 850, isCompleted: true },
      { name: 'Фруктовое ассорти (яблоки, виноград)', category: 'produce', estimatedPrice: 620, isCompleted: true },
      { name: 'Сырная тарелка (Пармезан, Бри)', category: 'dairy', estimatedPrice: 1100, isCompleted: true },
      { name: 'Мясная нарезка', category: 'meat', estimatedPrice: 780, isCompleted: true },
      { name: 'Соки и лимонады 4 шт', category: 'drinks', estimatedPrice: 560, isCompleted: true },
      { name: 'Салфетки праздничные', category: 'household', estimatedPrice: 140, isCompleted: true },
      { name: 'Чай элитный подарочный', category: 'drinks', estimatedPrice: 800, isCompleted: true },
    ],
  },
  {
    id: 'archive-shopping-sep-pantry',
    sourceNoteId: 'note-old-shopping-2',
    title: '🛒 Оптовая закупка бакалеи на осень',
    completedAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
    monthName: 'Сентябрь 2026',
    itemsCount: 6,
    totalSpent: 3420,
    currency: 'руб',
    items: [
      { name: 'Рис басмати 3 кг', category: 'grocery', estimatedPrice: 540, isCompleted: true },
      { name: 'Гречневая крупа 4 пачки', category: 'grocery', estimatedPrice: 380, isCompleted: true },
      { name: 'Макароны твердых сортов 5 уп', category: 'grocery', estimatedPrice: 450, isCompleted: true },
      { name: 'Масло оливковое Extra Virgin 1 л', category: 'grocery', estimatedPrice: 950, isCompleted: true },
      { name: 'Мука пшеничная высший сорт 2 кг', category: 'bakery', estimatedPrice: 200, isCompleted: true },
      { name: 'Стиральный гель автомат 3 л', category: 'household', estimatedPrice: 900, isCompleted: true },
    ],
  },
];

export function loadArchivedBudgets(): ArchivedBudgetMonth[] {
  try {
    const raw = localStorage.getItem(ARCHIVED_BUDGETS_KEY);
    const isUserInitialized = localStorage.getItem(USER_INITIALIZED_KEY) === 'true';

    if (!raw) {
      if (isUserInitialized) {
        return [];
      }
      saveArchivedBudgets(INITIAL_ARCHIVED_BUDGETS);
      return INITIAL_ARCHIVED_BUDGETS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load archived budgets', e);
    return [];
  }
}

export function saveArchivedBudgets(budgets: ArchivedBudgetMonth[]): void {
  try {
    localStorage.setItem(ARCHIVED_BUDGETS_KEY, JSON.stringify(budgets));
  } catch (e) {
    console.error('Failed to save archived budgets', e);
  }
}

export function loadArchivedShopping(): ArchivedShoppingTrip[] {
  try {
    const raw = localStorage.getItem(ARCHIVED_SHOPPING_KEY);
    const isUserInitialized = localStorage.getItem(USER_INITIALIZED_KEY) === 'true';

    if (!raw) {
      if (isUserInitialized) {
        return [];
      }
      saveArchivedShopping(INITIAL_ARCHIVED_SHOPPING);
      return INITIAL_ARCHIVED_SHOPPING;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load archived shopping', e);
    return [];
  }
}

export function saveArchivedShopping(trips: ArchivedShoppingTrip[]): void {
  try {
    localStorage.setItem(ARCHIVED_SHOPPING_KEY, JSON.stringify(trips));
  } catch (e) {
    console.error('Failed to save archived shopping', e);
  }
}
