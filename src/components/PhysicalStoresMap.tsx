import React, { useState, useMemo } from 'react';
import { ShoppingItem, NearbyStore } from '../types';
import { LocationInfo, formatDistance } from '../utils/geoStores';
import {
  MapPin,
  Navigation,
  Clock,
  ExternalLink,
  Store,
  ChevronRight,
  Crosshair,
  ZoomIn,
  ZoomOut,
  Layers,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
} from 'lucide-react';

interface PhysicalStoresMapProps {
  locationInfo: LocationInfo;
  items: ShoppingItem[];
  onOpenStoreRoute?: (store: NearbyStore) => void;
  onRequestGps?: () => void;
}

export interface MapPhysicalStore {
  id: string;
  name: string;
  chain: string;
  categoryType: 'grocery' | 'supermarket' | 'pharmacy' | 'home' | 'mall';
  lat: number;
  lng: number;
  address: string;
  hours: string;
  distanceMeters: number;
  walkMinutes: number;
  icon: string;
  color: string;
  bgColor: string;
  matchedItems: string[];
  yandexUrl: string;
  gisUrl: string;
}

export const PhysicalStoresMap: React.FC<PhysicalStoresMapProps> = ({
  locationInfo,
  items,
  onRequestGps,
}) => {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [mapPan, setMapPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const activeItems = useMemo(() => items.filter((i) => !i.isCompleted), [items]);

  // Generate realistic physical stores around user location with coordinates
  const physicalStores: MapPhysicalStore[] = useMemo(() => {
    const lat = locationInfo.lat || 55.7558;
    const lng = locationInfo.lng || 37.6173;

    // Define store definitions
    const storeDefs = [
      {
        name: 'Пятёрочка',
        chain: '5ka',
        categoryType: 'supermarket' as const,
        dLat: 0.0018,
        dLng: 0.0022,
        hours: '08:00 – 23:00',
        icon: '🔴',
        color: 'text-rose-600',
        bgColor: 'bg-rose-500',
        matchKeywords: ['молоко', 'хлеб', 'сыр', 'яйца', 'масло', 'сахар', 'мука', 'бананы', 'яблоки', 'картофель', 'курица', 'макароны', 'рис', 'печенье', 'колбаса'],
      },
      {
        name: 'Магнит у дома',
        chain: 'magnit',
        categoryType: 'supermarket' as const,
        dLat: -0.0024,
        dLng: 0.0019,
        hours: '08:00 – 23:00',
        icon: '🟥',
        color: 'text-red-600',
        bgColor: 'bg-red-500',
        matchKeywords: ['молоко', 'хлеб', 'крупа', 'чай', 'кофе', 'овощи', 'фрукты', 'конфеты', 'вода', 'сосиски', 'сыр'],
      },
      {
        name: 'ВкусВилл',
        chain: 'vkusvill',
        categoryType: 'grocery' as const,
        dLat: 0.0031,
        dLng: -0.0025,
        hours: '08:00 – 22:00',
        icon: '🟢',
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-600',
        matchKeywords: ['молоко', 'творог', 'сыр', 'хлеб', 'манго', 'рыба', 'индейка', 'йогурт', 'смузи', 'зелень', 'ягоды'],
      },
      {
        name: 'Перекрёсток',
        chain: 'perekrestok',
        categoryType: 'supermarket' as const,
        dLat: -0.0038,
        dLng: -0.0032,
        hours: '08:00 – 23:00',
        icon: '🍀',
        color: 'text-emerald-800',
        bgColor: 'bg-emerald-700',
        matchKeywords: ['мясо', 'стейк', 'выпечка', 'кулинария', 'сыр', 'виноград', 'морепродукты', 'торт', 'соки'],
      },
      {
        name: 'Аптека «Апрель»',
        chain: 'aprel',
        categoryType: 'pharmacy' as const,
        dLat: 0.0012,
        dLng: -0.0016,
        hours: '08:00 – 22:00 (без вых.)',
        icon: '💊',
        color: 'text-cyan-700',
        bgColor: 'bg-cyan-600',
        matchKeywords: ['аспирин', 'парацетамол', 'витамины', 'пластырь', 'бинт', 'мазь', 'лекарства', 'капли', 'термометр'],
      },
      {
        name: 'Аптека «Планета Здоровья»',
        chain: 'planeta',
        categoryType: 'pharmacy' as const,
        dLat: -0.0019,
        dLng: -0.0011,
        hours: 'Круглосуточно 24/7',
        icon: '🏥',
        color: 'text-blue-700',
        bgColor: 'bg-blue-600',
        matchKeywords: ['витамин', 'спрей', 'таблетки', 'крем', 'антисептик', 'линзы'],
      },
      {
        name: 'Хозтовары & Дом (Леруа/FixPrice)',
        chain: 'hoztovary',
        categoryType: 'home' as const,
        dLat: 0.0045,
        dLng: 0.0036,
        hours: '09:00 – 21:00',
        icon: '🛠️',
        color: 'text-amber-700',
        bgColor: 'bg-amber-600',
        matchKeywords: ['мыло', 'порошок', 'губки', 'батарейки', 'пакеты', 'лампа', 'бумага', 'салфетки', 'клей', 'салфетки'],
      },
      {
        name: 'Торговый центр (ТЦ)',
        chain: 'mall',
        categoryType: 'mall' as const,
        dLat: -0.0052,
        dLng: 0.0048,
        hours: '10:00 – 22:00',
        icon: '🏬',
        color: 'text-indigo-700',
        bgColor: 'bg-indigo-600',
        matchKeywords: ['одежда', 'обувь', 'носки', 'футболка', 'джинсы', 'подарок', 'книга'],
      },
    ];

    return storeDefs.map((def, idx) => {
      const storeLat = lat + def.dLat;
      const storeLng = lng + def.dLng;

      // Approximate distance in meters
      const latDiffM = Math.abs(def.dLat) * 111000;
      const lngDiffM = Math.abs(def.dLng) * 111000 * Math.cos((lat * Math.PI) / 180);
      const distanceMeters = Math.round(Math.sqrt(latDiffM * latDiffM + lngDiffM * lngDiffM));
      const { walkMinutes } = formatDistance(distanceMeters);

      // Match items from list that can be bought here
      const matched = activeItems
        .filter((item) => {
          const name = item.name.toLowerCase();
          return def.matchKeywords.some((kw) => name.includes(kw));
        })
        .map((i) => i.name);

      const query = `${def.name} ${locationInfo.city || ''}`;
      const yandexUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(query)}&ll=${storeLng},${storeLat}&z=16`;
      const gisUrl = `https://2gis.ru/search/${encodeURIComponent(def.name)}`;

      return {
        id: `map-store-${def.chain}-${idx}`,
        name: def.name,
        chain: def.chain,
        categoryType: def.categoryType,
        lat: storeLat,
        lng: storeLng,
        address: locationInfo.city
          ? `${locationInfo.city}, филиал рядом (~${distanceMeters} м)`
          : `ул. Рядом, д. ${12 + idx * 3}`,
        hours: def.hours,
        distanceMeters,
        walkMinutes,
        icon: def.icon,
        color: def.color,
        bgColor: def.bgColor,
        matchedItems: matched,
        yandexUrl,
        gisUrl,
      };
    });
  }, [locationInfo, activeItems]);

  const filteredStores = useMemo(() => {
    if (filterType === 'all') return physicalStores;
    return physicalStores.filter((s) => s.categoryType === filterType);
  }, [physicalStores, filterType]);

  const selectedStore = useMemo(() => {
    return physicalStores.find((s) => s.id === selectedStoreId) || null;
  }, [physicalStores, selectedStoreId]);

  return (
    <div className="bg-white dark:bg-stone-900 border border-amber-900/15 dark:border-stone-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Map Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                <span>Ближайшие физические магазины на карте</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  {physicalStores.length} рядом
                </span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {locationInfo.formattedAddress || 'Определение вашего положения...'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick GPS Refresh */}
        {onRequestGps && (
          <button
            onClick={onRequestGps}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold transition active:scale-95 cursor-pointer shrink-0 self-start sm:self-center"
            title="Обновить текущие координаты GPS"
          >
            <Crosshair className="w-3.5 h-3.5 text-emerald-600" />
            <span>Моё местоположение</span>
          </button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {[
          { id: 'all', label: 'Все магазины', icon: '🏬' },
          { id: 'supermarket', label: 'Супермаркеты', icon: '🛒' },
          { id: 'grocery', label: 'У дома & Эко', icon: '🥗' },
          { id: 'pharmacy', label: 'Аптеки', icon: '💊' },
          { id: 'home', label: 'Хозтовары', icon: '🛠️' },
          { id: 'mall', label: 'Торговые центры', icon: '🛍️' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setFilterType(f.id);
              setSelectedStoreId(null);
            }}
            className={`px-2.5 py-1 rounded-xl font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1 shrink-0 ${
              filterType === f.id
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
            }`}
          >
            <span>{f.icon}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* INTERACTIVE VECTOR MAP CONTAINER */}
      <div className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden border border-amber-900/15 dark:border-stone-700 bg-[#f4f1eb] dark:bg-[#181614] select-none shadow-inner">
        {/* Subtle Map Grid lines (Notebook city map aesthetic) */}
        <div
          className="absolute inset-0 opacity-40 dark:opacity-20 pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.08) 0%, transparent 60%),
              linear-gradient(to right, #00000012 1px, transparent 1px),
              linear-gradient(to bottom, #00000012 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 28px 28px, 28px 28px',
          }}
        />

        {/* Map Roads & Blocks Simulation */}
        <svg className="absolute inset-0 w-full h-full opacity-35 dark:opacity-20 pointer-events-none">
          {/* Main thoroughfares */}
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#e5e0d8" strokeWidth="18" />
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#fff" strokeWidth="12" />
          <line x1="45%" y1="0" x2="45%" y2="100%" stroke="#e5e0d8" strokeWidth="16" />
          <line x1="45%" y1="0" x2="45%" y2="100%" stroke="#fff" strokeWidth="10" />

          {/* Secondary streets */}
          <line x1="15%" y1="0" x2="15%" y2="100%" stroke="#f0ebe1" strokeWidth="8" />
          <line x1="75%" y1="0" x2="75%" y2="100%" stroke="#f0ebe1" strokeWidth="8" />
          <line x1="0" y1="25%" x2="100%" y2="25%" stroke="#f0ebe1" strokeWidth="8" />
          <line x1="0" y1="75%" x2="100%" y2="75%" stroke="#f0ebe1" strokeWidth="8" />
        </svg>

        {/* User GPS Center Marker */}
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 flex flex-col items-center pointer-events-none"
          style={{ left: '45%', top: '50%' }}
        >
          <div className="relative flex items-center justify-center">
            <span className="animate-ping absolute w-8 h-8 rounded-full bg-blue-500/40" />
            <div className="w-5 h-5 rounded-full bg-blue-600 text-white border-2 border-white shadow-md flex items-center justify-center text-[9px] font-bold">
              Я
            </div>
          </div>
          <span className="mt-1 px-1.5 py-0.5 rounded-md bg-stone-900/90 text-white text-[9px] font-bold shadow-xs whitespace-nowrap">
            Вы здесь
          </span>
        </div>

        {/* Store Pins Plotted Relative to User Location */}
        {filteredStores.map((st, idx) => {
          // Calculate screen position percentages around center (45%, 50%)
          const dLat = st.lat - (locationInfo.lat || 55.7558);
          const dLng = st.lng - (locationInfo.lng || 37.6173);

          // Scaled offset based on zoomLevel
          const xPercent = 45 + (dLng / 0.007) * 40 * zoomLevel + mapPan.x;
          const yPercent = 50 - (dLat / 0.007) * 40 * zoomLevel + mapPan.y;

          // Clamped inside visible bounds
          const clampedX = Math.max(8, Math.min(92, xPercent));
          const clampedY = Math.max(10, Math.min(90, yPercent));

          const isSelected = selectedStoreId === st.id;
          const hasMatchedItems = st.matchedItems.length > 0;

          return (
            <div
              key={st.id}
              onClick={() => setSelectedStoreId(isSelected ? null : st.id)}
              style={{ left: `${clampedX}%`, top: `${clampedY}%` }}
              className={`absolute z-30 -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 group flex flex-col items-center ${
                isSelected ? 'scale-115 z-40' : 'hover:scale-110'
              }`}
            >
              {/* Badge Pin */}
              <div
                className={`relative px-2 py-1 rounded-xl shadow-md flex items-center gap-1 border transition-all ${
                  isSelected
                    ? 'bg-stone-900 text-white border-amber-400 ring-2 ring-amber-400/50'
                    : 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white border-stone-300 dark:border-stone-600 hover:border-emerald-500'
                }`}
              >
                <span className="text-sm select-none">{st.icon}</span>
                <span className="text-[11px] font-bold whitespace-nowrap">{st.name}</span>
                <span className="text-[9px] font-mono opacity-80 whitespace-nowrap text-emerald-600 dark:text-emerald-400 font-bold">
                  {st.distanceMeters}м
                </span>

                {hasMatchedItems && (
                  <span
                    className="w-2 h-2 rounded-full bg-emerald-500 absolute -top-1 -right-1 ring-1 ring-white"
                    title={`Есть товары из вашего списка: ${st.matchedItems.join(', ')}`}
                  />
                )}
              </div>

              {/* Pin pointer triangle */}
              <div
                className={`w-0 h-0 border-x-4 border-x-transparent border-t-5 -mt-0.5 ${
                  isSelected ? 'border-t-stone-900' : 'border-t-white dark:border-t-stone-800'
                }`}
              />
            </div>
          );
        })}

        {/* Map Controls: Zoom in/out & Recenter */}
        <div className="absolute right-3 top-3 z-30 flex flex-col gap-1.5">
          <button
            onClick={() => setZoomLevel((z) => Math.min(1.8, z + 0.25))}
            className="w-8 h-8 rounded-xl bg-white/95 dark:bg-stone-800 text-stone-700 dark:text-stone-200 shadow-md border border-stone-200 dark:border-stone-700 flex items-center justify-center hover:bg-stone-50 cursor-pointer active:scale-95"
            title="Приблизить"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.25))}
            className="w-8 h-8 rounded-xl bg-white/95 dark:bg-stone-800 text-stone-700 dark:text-stone-200 shadow-md border border-stone-200 dark:border-stone-700 flex items-center justify-center hover:bg-stone-50 cursor-pointer active:scale-95"
            title="Отдалить"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setZoomLevel(1);
              setMapPan({ x: 0, y: 0 });
              setSelectedStoreId(null);
            }}
            className="w-8 h-8 rounded-xl bg-white/95 dark:bg-stone-800 text-stone-700 dark:text-stone-200 shadow-md border border-stone-200 dark:border-stone-700 flex items-center justify-center hover:bg-stone-50 cursor-pointer active:scale-95 text-xs font-bold"
            title="Сбросить карту к центру"
          >
            🎯
          </button>
        </div>

        {/* Map Legend Footer overlay */}
        <div className="absolute left-3 bottom-3 z-30 bg-white/90 dark:bg-stone-900/90 backdrop-blur-xs px-2.5 py-1 rounded-xl border border-stone-200 dark:border-stone-800 text-[10px] text-stone-600 dark:text-stone-400 font-medium flex items-center gap-2">
          <span className="flex items-center gap-1 font-semibold text-stone-800 dark:text-stone-200">
            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
            <span>Вы</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Есть товары</span>
          </span>
        </div>
      </div>

      {/* SELECTED STORE POPUP CARD */}
      {selectedStore ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-stone-800/80 border border-amber-500/30 dark:border-stone-700 space-y-3 animate-in fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{selectedStore.icon}</span>
              <div>
                <h4 className="font-bold text-sm text-stone-900 dark:text-white flex items-center gap-1.5">
                  <span>{selectedStore.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                    ~{selectedStore.distanceMeters} м
                  </span>
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-stone-400" />
                    <span>{selectedStore.hours}</span>
                  </span>
                  <span>•</span>
                  <span>~{selectedStore.walkMinutes} мин пешком</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedStoreId(null)}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>

          {/* Matched items from checklist */}
          {selectedStore.matchedItems.length > 0 ? (
            <div className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-emerald-300 dark:border-emerald-800/60 text-xs">
              <div className="font-bold text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>В наличии из вашего списка ({selectedStore.matchedItems.length}):</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedStore.matchedItems.map((item, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-medium text-[11px] border border-emerald-200 dark:border-emerald-800"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-stone-500 dark:text-stone-400 italic">
              Товары повседневного спроса и свежие продукты
            </div>
          )}

          {/* Route buttons */}
          <div className="flex items-center gap-2 pt-1">
            <a
              href={selectedStore.yandexUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow cursor-pointer active:scale-98"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Маршрут в Яндекс Картах</span>
              <ExternalLink className="w-3 h-3 opacity-75" />
            </a>

            <a
              href={selectedStore.gisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow cursor-pointer active:scale-98"
            >
              <span>2GIS</span>
              <ExternalLink className="w-3 h-3 opacity-75" />
            </a>
          </div>
        </div>
      ) : null}

      {/* Stores List below map */}
      <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
        <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 font-semibold px-1">
          <span>Список магазинов рядом:</span>
          <span>Нажмите для просмотра на карте</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredStores.map((st) => (
            <div
              key={st.id}
              onClick={() => setSelectedStoreId(st.id)}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                selectedStoreId === st.id
                  ? 'bg-amber-500/15 dark:bg-stone-800 border-amber-500/50 shadow-xs ring-1 ring-amber-500/30'
                  : 'bg-stone-50/80 hover:bg-stone-100 dark:bg-stone-800/60 dark:hover:bg-stone-800 border-stone-200/80 dark:border-stone-700/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xl shrink-0">{st.icon}</span>
                <div className="truncate">
                  <div className="font-bold text-xs text-stone-900 dark:text-white truncate">
                    {st.name}
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {st.distanceMeters} м
                    </span>
                    <span>•</span>
                    <span>~{st.walkMinutes} мин</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {st.matchedItems.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    +{st.matchedItems.length} тов.
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
