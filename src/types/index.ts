export type NoteCategory = 'note' | 'shopping' | 'event' | 'payment' | 'general' | 'budget' | 'calculation';

export type PaperStyleType = 'grid' | 'dark-grid' | 'lines' | 'plain' | 'kraft' | 'dots';

export type EventCategory = 'meeting' | 'deadline' | 'holiday' | 'birthday' | 'trip' | 'task';

export interface EventCategoryConfig {
  id: EventCategory;
  label: string;
  icon: string;
  colorClass: string;
  bgClass: string;
  badgeClass: string;
  borderClass: string;
  dotColor: string;
}

export const EVENT_CATEGORY_CONFIG: Record<EventCategory, EventCategoryConfig> = {
  meeting: {
    id: 'meeting',
    label: 'Встреча',
    icon: '🤝',
    colorClass: 'text-sky-700 dark:text-sky-300',
    bgClass: 'bg-sky-50 dark:bg-sky-950/40',
    borderClass: 'border-sky-300 dark:border-sky-700/60',
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-200 border-sky-300 dark:border-sky-700',
    dotColor: 'bg-sky-500',
  },
  deadline: {
    id: 'deadline',
    label: 'Дедлайн',
    icon: '⏰',
    colorClass: 'text-rose-700 dark:text-rose-300',
    bgClass: 'bg-rose-50 dark:bg-rose-950/40',
    borderClass: 'border-rose-300 dark:border-rose-700/60',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 border-rose-300 dark:border-rose-700',
    dotColor: 'bg-rose-500',
  },
  holiday: {
    id: 'holiday',
    label: 'Праздник',
    icon: '🎉',
    colorClass: 'text-purple-700 dark:text-purple-300',
    bgClass: 'bg-purple-50 dark:bg-purple-950/40',
    borderClass: 'border-purple-300 dark:border-purple-700/60',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-200 border-purple-300 dark:border-purple-700',
    dotColor: 'bg-purple-500',
  },
  birthday: {
    id: 'birthday',
    label: 'День рождения',
    icon: '🎂',
    colorClass: 'text-amber-700 dark:text-amber-300',
    bgClass: 'bg-amber-50 dark:bg-amber-950/40',
    borderClass: 'border-amber-300 dark:border-amber-700/60',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 border-amber-300 dark:border-amber-700',
    dotColor: 'bg-amber-500',
  },
  trip: {
    id: 'trip',
    label: 'Поездка',
    icon: '✈️',
    colorClass: 'text-teal-700 dark:text-teal-300',
    bgClass: 'bg-teal-50 dark:bg-teal-950/40',
    borderClass: 'border-teal-300 dark:border-teal-700/60',
    badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-200 border-teal-300 dark:border-teal-700',
    dotColor: 'bg-teal-500',
  },
  task: {
    id: 'task',
    label: 'Дело',
    icon: '📋',
    colorClass: 'text-stone-700 dark:text-stone-300',
    bgClass: 'bg-stone-50 dark:bg-stone-800',
    borderClass: 'border-stone-300 dark:border-stone-700',
    badgeClass: 'bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200 border-stone-300 dark:border-stone-700',
    dotColor: 'bg-stone-500',
  },
};

export const EVENT_CATEGORIES_LIST: EventCategoryConfig[] = [
  EVENT_CATEGORY_CONFIG.meeting,
  EVENT_CATEGORY_CONFIG.deadline,
  EVENT_CATEGORY_CONFIG.holiday,
  EVENT_CATEGORY_CONFIG.birthday,
  EVENT_CATEGORY_CONFIG.trip,
  EVENT_CATEGORY_CONFIG.task,
];

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  category: NoteCategory;
  color?: string;
  isPinned?: boolean;
  tags: string[];
  // Event specific
  eventDate?: string;
  eventTime?: string;
  isEventDone?: boolean;
  eventCategory?: EventCategory;
  // Notebook Paper Style
  paperStyle?: PaperStyleType;
  // Push Notifications & Reminders (Event & Shopping)
  reminderDateTime?: string; // ISO string e.g. "2026-10-15T14:00"
  reminderEnabled?: boolean;
  reminderTriggered?: boolean;
  // Smart Auto-Calculation toggle (enabled automatically when note has calculable lines)
  autoCalculate?: boolean;
  // Archive fields
  isArchived?: boolean;
  archivedMonth?: string; // e.g. "2026-09"
  archivedAt?: number;
  // Calculated cache
  cachedTotal?: number;
  cachedIncome?: number;
  cachedExpenses?: number;
  cachedNetBalance?: number;
  cachedPieces?: number;
  currency?: string;
  shoppingItemsCount?: number;
  completedItemsCount?: number;
  // Incremental parsing cache metadata (R-INFRA-03)
  lastParsedAt?: number;
  lastParsedHash?: string;
}

export interface ArchivedBudgetMonth {
  id: string; // e.g. "archive-budget-2026-09"
  year: number;
  month: number; // 1-12
  monthName: string; // e.g. "Сентябрь 2026"
  closedAt: number;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  currency: string;
  notesCount: number;
  notesSnapshot: Array<{
    id: string;
    title: string;
    content: string;
    income: number;
    expenses: number;
    balance: number;
  }>;
  summaryComment?: string;
}

export interface ArchivedShoppingTrip {
  id: string;
  sourceNoteId?: string;
  title: string;
  completedAt: number;
  monthName: string; // e.g. "Октябрь 2026"
  itemsCount: number;
  items: Array<{
    name: string;
    category?: string;
    estimatedPrice?: number;
    isCompleted: boolean;
  }>;
  totalSpent?: number;
  currency?: string;
}

export interface LineCalculation {
  lineNumber: number;
  rawText: string;
  expression: string | null;
  result: number | null;
  currency: string;
  label: string;
  isTotalLine: boolean;
  type: 'income' | 'expense' | 'total' | 'neutral';
  isPieceCalculation?: boolean;
  lineKind?: 'money' | 'pieces' | 'math' | 'text';
}

export interface NoteCalculationSummary {
  lines: LineCalculation[];
  grandTotal: number;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  hasIncomeExpenseSplit: boolean;
  savingsRatePercent: number;
  currency: string;
  totalCalculatedLines: number;
  breakdownByCurrency: Record<string, number>;
  totalPieces?: number;
  hasPiecesCalculation?: boolean;
}

export interface ShoppingItem {
  id: string;
  name: string;
  originalText: string;
  quantity?: number;
  unit?: string;
  category: ShoppingCategory;
  isCompleted: boolean;
  estimatedPriceRub?: number;
  price?: number;
  unitPrice?: number;
  currency?: string;
  hasCustomPrice?: boolean;
  lineIndex?: number;
}

export type ShoppingCategory =
  | 'dairy'       // молочные
  | 'bakery'      // хлеб и выпечка
  | 'meat'        // мясо, рыба
  | 'produce'     // фрукты и овощи
  | 'grocery'     // бакалея, крупы, макароны
  | 'drinks'      // напитки, кофе, чай
  | 'household'   // бытовая химия, дом
  | 'sweets'      // сладости, снеки
  | 'other';

export interface StoreOption {
  id: string;
  name: string;
  type: 'marketplace' | 'delivery' | 'offline_store';
  logoColor: string;
  deliveryTime: string;
  tag: string;
  getSearchUrl: (query: string) => string;
  getMultiItemCartUrl?: (items: string[]) => string;
  description: string;
  freeDeliveryThreshold?: number;
}

export interface NearbyStore {
  id: string;
  name: string;
  chain: string;
  distanceMeters: number;
  distanceText: string;
  walkMinutes: number;
  address: string;
  isOpen: boolean;
  workingHours: string;
  mapYandexUrl: string;
  map2GisUrl: string;
  mapGoogleUrl: string;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export interface SyncStatus {
  isConfigured: boolean;
  isConnected: boolean;
  lastSyncedAt: number;
  syncMethod: 'firebase' | 'local';
  roomCode?: string;
}

export interface SecurityConfig {
  isPasscodeSet: boolean;
  passcodeHash?: string;
  passcodeSalt?: string;
  protectFinance: boolean;   // Protect 'calc' (payments/budget) tab and payment notes
  protectShopping: boolean;  // Protect 'shopping' tab and shopping notes
  protectArchive: boolean;   // Protect 'archive' tab
  biometricEnabled: boolean; // Face ID / Fingerprint / WebAuthn
  credentialId?: string;
  autoLockMinutes: number;   // 0 = immediate, 1 = 1m, 5 = 5m, 15 = 15m, -1 = session
}
