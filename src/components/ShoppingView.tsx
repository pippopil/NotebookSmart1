import React, { useState, useEffect, useMemo } from 'react';
import { Note, ShoppingItem, NearbyStore } from '../types';
import { PhysicalStoresMap } from './PhysicalStoresMap';
import {
  extractShoppingItems,
  formatShoppingListForSharing,
} from '../utils/shoppingParser';
import {
  getNearbyStores,
  MAJOR_CITIES,
  LocationInfo,
  determineBestUserLocation,
} from '../utils/geoStores';
import confetti from 'canvas-confetti';
import {
  ShoppingCart,
  MapPin,
  CheckCircle2,
  Circle,
  Share2,
  Check,
  Store,
  Plus,
  RefreshCw,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';

interface ShoppingViewProps {
  note?: Note | null;
  allNotes: Note[];
  onUpdateNote?: (note: Note) => void;
  onClose?: () => void;
}

export const ShoppingView: React.FC<ShoppingViewProps> = ({
  note,
  allNotes,
  onUpdateNote,
  onClose,
}) => {
  const [selectedNoteId, setSelectedNoteId] = useState<string>(note?.id || '');
  const [shoppingMode, setShoppingMode] = useState<boolean>(false); // In-store mode
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedShare, setCopiedShare] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');

  // Geolocation & Permission State
  const [geoLoading, setGeoLoading] = useState(false);
  const [locationInfo, setLocationInfo] = useState<LocationInfo>(() => {
    try {
      const saved = localStorage.getItem('smart_notepad_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return parsed;
        }
      }
    } catch {}
    return {
      lat: 55.7558,
      lng: 37.6173,
      city: 'Москва',
      formattedAddress: 'Москва (по умолчанию)',
      source: 'default',
    };
  });

  // Pick target note: either prop, or first shopping note, or first available note
  const currentNote = useMemo(() => {
    return (
      allNotes.find((n) => n.id === selectedNoteId) ||
      note ||
      allNotes.find((n) => n.category === 'shopping') ||
      allNotes[0] ||
      null
    );
  }, [allNotes, selectedNoteId, note]);

  // Extract items (checkbox lines)
  const items: ShoppingItem[] = useMemo(() => {
    return currentNote ? extractShoppingItems(currentNote.content) : [];
  }, [currentNote]);

  const completedCount = items.filter((i) => i.isCompleted).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Filter items by category tab
  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return items;
    return items.filter((item) => item.category === activeCategory);
  }, [items, activeCategory]);

  // Haptic feedback
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  };

  // Toggle item completed status
  const handleToggleItem = (item: ShoppingItem) => {
    if (!currentNote || !onUpdateNote || typeof item.lineIndex !== 'number') return;
    triggerHaptic();

    const lines = currentNote.content.split('\n');
    const targetLine = lines[item.lineIndex];

    if (!targetLine) return;

    let updatedLine = targetLine;
    if (item.isCompleted) {
      // Uncheck
      updatedLine = targetLine.replace(/^(\s*[-*+]\s*\[)x(\])/i, '$1 $2');
    } else {
      // Check
      updatedLine = targetLine.replace(/^(\s*[-*+]\s*\[)\s*(\])/i, '$1x$2');

      // Trigger confetti if all items are completed
      if (completedCount + 1 === totalCount && totalCount > 0) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
      }
    }

    lines[item.lineIndex] = updatedLine;
    const updatedContent = lines.join('\n');

    onUpdateNote({
      ...currentNote,
      content: updatedContent,
      updatedAt: Date.now(),
    });
  };

  // Add bulk items into the checklist
  const handleQuickAddBulkItems = (textToAdd: string) => {
    if (!textToAdd.trim() || !currentNote || !onUpdateNote) return;
    triggerHaptic();

    const rawItems = textToAdd
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (rawItems.length === 0) return;

    const formattedLines = rawItems.map((raw) => {
      if (raw.startsWith('- [ ]') || raw.startsWith('- [x]')) return raw;
      return `- [ ] ${raw}`;
    });

    const newContent = currentNote.content.trim()
      ? `${currentNote.content.trim()}\n${formattedLines.join('\n')}`
      : formattedLines.join('\n');

    onUpdateNote({
      ...currentNote,
      content: newContent,
      updatedAt: Date.now(),
    });

    setQuickAddText('');
    setShowQuickAdd(false);
  };

  // Share formatted shopping list
  const handleShareList = async () => {
    triggerHaptic();
    const formatted = formatShoppingListForSharing(
      items,
      currentNote?.title || 'Список покупок'
    );

    if (navigator.share) {
      try {
        await navigator.share({
          title: currentNote?.title || 'Список покупок',
          text: formatted,
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {}
  };

  // Geolocation request
  const handleRequestGps = async () => {
    setGeoLoading(true);
    triggerHaptic();
    try {
      const res = await determineBestUserLocation();
      setLocationInfo(res.location);
      try {
        localStorage.setItem('smart_notepad_location', JSON.stringify(res.location));
      } catch {}
    } catch {}
    setGeoLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 pb-28 space-y-4">
      {/* 1. TOP HEADER BANNER */}
      <div className="bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-stone-900 dark:text-white tracking-tight">
                  {currentNote?.title || 'Список покупок'}
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  {completedCount}/{totalCount} куплено
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Чеклист товаров и расположение ближайших физических магазинов на карте
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {/* In-store mode toggle */}
            <button
              onClick={() => {
                triggerHaptic();
                setShoppingMode(!shoppingMode);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer border ${
                shoppingMode
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
              }`}
              title="Крупный чеклист для удобного вычеркивания в магазине"
            >
              <Store className="w-3.5 h-3.5" />
              <span>{shoppingMode ? 'В магазине (ВКЛ)' : 'Режим покупок'}</span>
            </button>

            <button
              onClick={handleShareList}
              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 transition cursor-pointer"
              title="Поделиться списком"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-white border border-stone-200 dark:border-stone-700 transition cursor-pointer"
                title="Закрыть"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Note selector if multiple shopping notes exist */}
        {allNotes.filter((n) => extractShoppingItems(n.content).length > 0).length > 1 && (
          <div className="flex items-center gap-2 pt-2 border-t border-stone-200 dark:border-stone-800 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-stone-400 whitespace-nowrap">Списки:</span>
            {allNotes
              .filter((n) => extractShoppingItems(n.content).length > 0)
              .map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    triggerHaptic();
                    setSelectedNoteId(n.id);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition border cursor-pointer ${
                    selectedNoteId === n.id
                      ? 'bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/50 font-bold'
                      : 'bg-stone-100 dark:bg-stone-950/60 text-stone-600 dark:text-stone-400 hover:text-stone-900 border-stone-200 dark:border-stone-800'
                  }`}
                >
                  {n.title || 'Список'} ({extractShoppingItems(n.content).length})
                </button>
              ))}
          </div>
        )}
      </div>

      {/* 2. PROGRESS BAR & QUICK ADD BUTTON */}
      <div className="bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-stone-900 dark:text-white block">
              Прогресс покупок в корзине:
            </span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">
              Куплено {completedCount} из {totalCount} наименований ({Math.round(progressPercent)}%)
            </span>
          </div>

          <button
            onClick={() => {
              triggerHaptic();
              setShowQuickAdd(!showQuickAdd);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showQuickAdd ? 'Скрыть ввод' : '➕ Добавить товары'}</span>
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2.5 overflow-hidden border border-stone-200 dark:border-stone-700">
          <div
            className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Quick Bulk Add Input Form */}
        {showQuickAdd && (
          <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-2 animate-in fade-in slide-in-from-top-2">
            <label className="text-xs font-bold text-stone-900 dark:text-white block">
              Введите или вставьте список товаров (через запятую или построчно):
            </label>
            <textarea
              value={quickAddText}
              onChange={(e) => setQuickAddText(e.target.value)}
              placeholder="Например: Молоко 3.2% 1 л, Сыр российский 300 г, Хлеб бородинский, Яблоки сезонные 1 кг, Бананы"
              rows={3}
              className="w-full bg-[#fffdf9] dark:bg-stone-950 p-3 rounded-xl border border-stone-200 dark:border-stone-800 text-xs text-stone-900 dark:text-stone-100 font-mono focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-stone-400">
                Автоматически добавятся как чеклист в тетрадь
              </span>
              <button
                onClick={() => handleQuickAddBulkItems(quickAddText)}
                disabled={!quickAddText.trim()}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow transition active:scale-95 cursor-pointer"
              >
                Добавить в список
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. INTERACTIVE PHYSICAL STORES MAP */}
      <PhysicalStoresMap
        locationInfo={locationInfo}
        items={items}
        onRequestGps={handleRequestGps}
      />

      {/* 4. SHOPPING LIST CHECKLIST (WITHOUT ANY PRICES OR ORDERING BUTTONS) */}
      <div className="bg-white dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-white">
              Чеклист покупок:
            </h3>
          </div>
          <span className="text-xs text-stone-400">
            Нажимайте для отметки купленного
          </span>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'all', label: 'Все товары' },
            { id: 'dairy', label: 'Молочка' },
            { id: 'bakery', label: 'Хлеб' },
            { id: 'meat', label: 'Мясо' },
            { id: 'produce', label: 'Овощи & Фрукты' },
            { id: 'pharmacy', label: 'Аптека' },
            { id: 'household', label: 'Быт' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded-xl font-medium transition cursor-pointer whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                  : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Items List */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-xs text-stone-400">
            Нет товаров в списке. Добавьте пункты с помощью кнопки выше.
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleToggleItem(item)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  item.isCompleted
                    ? 'bg-stone-50/70 dark:bg-stone-900/40 text-stone-400 dark:text-stone-500 border-stone-200 dark:border-stone-800/40'
                    : 'bg-stone-50/90 hover:bg-stone-100 dark:bg-stone-850/70 dark:hover:bg-stone-800 text-stone-900 dark:text-white border-stone-200 dark:border-stone-700/60 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    className="text-emerald-600 dark:text-emerald-400 shrink-0 cursor-pointer p-0.5"
                  >
                    {item.isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 fill-emerald-500/20 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-stone-300 dark:text-stone-600 hover:text-emerald-500" />
                    )}
                  </button>

                  <div className="truncate">
                    <span
                      className={`text-sm font-semibold truncate block ${
                        item.isCompleted
                          ? 'line-through text-stone-400 dark:text-stone-500'
                          : 'text-stone-900 dark:text-stone-100'
                      } ${shoppingMode ? 'text-base font-bold' : ''}`}
                    >
                      {item.name}
                    </span>

                    {item.quantity && (
                      <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                        Количество: {item.quantity} {item.unit || 'шт'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-xs font-semibold text-stone-400">
                  {item.isCompleted ? '✓ Куплено' : 'К покупке'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
