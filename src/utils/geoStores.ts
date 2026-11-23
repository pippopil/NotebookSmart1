import { NearbyStore } from '../types';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface LocationInfo {
  lat: number;
  lng: number;
  city?: string;
  district?: string;
  street?: string;
  formattedAddress: string;
  source: 'gps' | 'ip' | 'manual' | 'default';
  isFallbackFromGps?: boolean;
  gpsBlockedReason?: string;
}

export const MAJOR_CITIES: Record<string, { lat: number; lng: number; name: string }> = {
  moscow: { lat: 55.7558, lng: 37.6173, name: 'Москва' },
  spb: { lat: 59.9343, lng: 30.3351, name: 'Санкт-Петербург' },
  nsk: { lat: 55.0084, lng: 82.9357, name: 'Новосибирск' },
  ekb: { lat: 56.8389, lng: 60.6057, name: 'Екатеринбург' },
  kzn: { lat: 55.7887, lng: 49.1221, name: 'Казань' },
  nn: { lat: 56.3269, lng: 44.0059, name: 'Нижний Новгород' },
  chelyabinsk: { lat: 55.1644, lng: 61.4368, name: 'Челябинск' },
  samara: { lat: 53.1959, lng: 50.1002, name: 'Самара' },
  ufa: { lat: 54.7388, lng: 55.9721, name: 'Уфа' },
  rostov: { lat: 47.2357, lng: 39.7015, name: 'Ростов-на-Дону' },
  krasnodar: { lat: 45.0355, lng: 38.9753, name: 'Краснодар' },
  omsk: { lat: 54.9885, lng: 73.3242, name: 'Омск' },
  voronezh: { lat: 51.6615, lng: 39.2003, name: 'Воронеж' },
  perm: { lat: 58.0105, lng: 56.2502, name: 'Пермь' },
  volgograd: { lat: 48.7080, lng: 44.5133, name: 'Волгоград' },
  krasnoyarsk: { lat: 56.0153, lng: 92.8932, name: 'Красноярск' },
  sochi: { lat: 43.6028, lng: 39.7342, name: 'Сочи' },
  tyumen: { lat: 57.1530, lng: 65.5343, name: 'Тюмень' },
};

export const POPULAR_CHAINS = [
  { name: 'Пятёрочка', chain: '5ka', baseDistance: 220, hours: '08:00 – 23:00', logo: '🔴', tag: 'Магазин у дома' },
  { name: 'Магнит у дома', chain: 'magnit', baseDistance: 290, hours: '08:00 – 23:00', logo: '🟥', tag: 'Выгодные цены' },
  { name: 'ВкусВилл', chain: 'vkusvill', baseDistance: 410, hours: '08:00 – 22:00', logo: '🟢', tag: 'Натуральные продукты' },
  { name: 'Перекрёсток', chain: 'perekrestok', baseDistance: 550, hours: '08:00 – 23:00', logo: '🍀', tag: 'Широкий выбор' },
  { name: 'Дикси', chain: 'dixy', baseDistance: 480, hours: '08:00 – 23:00', logo: '🟠', tag: 'Акции и скидки' },
  { name: 'Самокат (Даркстор)', chain: 'samokat', baseDistance: 650, hours: '08:00 – 23:00', logo: '🛵', tag: 'Доставка 15 мин' },
  { name: 'Лента Супермаркет', chain: 'lenta', baseDistance: 950, hours: '08:00 – 00:00', logo: '🟡', tag: 'Гипермаркет' },
  { name: 'Ашан Сити', chain: 'auchan', baseDistance: 1400, hours: '08:30 – 22:30', logo: '🐦', tag: 'Большие скидки' },
];

/**
 * Calculates distance formatting
 */
export function formatDistance(meters: number): { distanceText: string; walkMinutes: number } {
  let distanceText = '';
  if (meters < 1000) {
    distanceText = `${Math.round(meters)} м`;
  } else {
    distanceText = `${(meters / 1000).toFixed(1)} км`;
  }
  const walkMinutes = Math.max(1, Math.round(meters / 80));
  return { distanceText, walkMinutes };
}

/**
 * Reverse geocode coordinates to street and city via OpenStreetMap Nominatim
 */
export async function reverseGeocodeCoords(lat: number, lng: number): Promise<LocationInfo> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        signal: controller.signal,
        headers: { 'Accept-Language': 'ru, ru-RU;q=0.9, en;q=0.8' },
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.municipality || 'Москва';
      const district = addr.suburb || addr.city_district || addr.neighbourhood || '';
      const street = addr.road || addr.street || '';
      const houseNumber = addr.house_number ? `, д. ${addr.house_number}` : '';

      const formatted = [city, district, street ? `${street}${houseNumber}` : '']
        .filter(Boolean)
        .join(', ');

      return {
        lat,
        lng,
        city,
        district,
        street: street ? `${street}${houseNumber}` : undefined,
        formattedAddress: formatted || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        source: 'gps',
      };
    }
  } catch {
    // Ignore network error in preview
  }

  return {
    lat,
    lng,
    city: 'Рядом с вами',
    formattedAddress: `GPS координаты: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    source: 'gps',
  };
}

/**
 * Fetches user location automatically by IP/Network.
 * Highly reliable: doesn't require any browser permission prompts.
 */
export async function fetchIpLocation(): Promise<LocationInfo | null> {
  // Strategy 1: Server-side proxy /api/geoip
  try {
    const controller = new AbortController();
    const t1 = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('/api/geoip', { signal: controller.signal });
    clearTimeout(t1);

    if (res.ok) {
      const data = await res.json();
      if (data && data.lat && data.lng) {
        return {
          lat: data.lat,
          lng: data.lng,
          city: data.city || 'Москва',
          formattedAddress: data.region
            ? `${data.city || 'Город'}, ${data.region} (по сети)`
            : `${data.city || 'Город'} (по сети)`,
          source: 'ip',
        };
      }
    }
  } catch {
    // Try strategy 2
  }

  // Strategy 2: Server-side proxy /api/ip-location
  try {
    const controller = new AbortController();
    const t2 = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('/api/ip-location', { signal: controller.signal });
    clearTimeout(t2);

    if (res.ok) {
      const data = await res.json();
      if (data && data.lat && data.lng) {
        return {
          lat: data.lat,
          lng: data.lng,
          city: data.city || 'Москва',
          formattedAddress: data.region
            ? `${data.city || 'Город'}, ${data.region} (по сети)`
            : `${data.city || 'Город'} (по сети)`,
          source: 'ip',
        };
      }
    }
  } catch {
    // Try strategy 3
  }

  // Strategy 3: Direct browser client call to ipwho.is (CORS enabled, fast, no API key needed)
  try {
    const controller = new AbortController();
    const t3 = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://ipwho.is/?lang=ru', { signal: controller.signal });
    clearTimeout(t3);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false && data.latitude && data.longitude) {
        return {
          lat: data.latitude,
          lng: data.longitude,
          city: data.city || 'Москва',
          formattedAddress: data.region
            ? `${data.city || 'Город'}, ${data.region} (по сети)`
            : `${data.city || 'Город'} (по сети)`,
          source: 'ip',
        };
      }
    }
  } catch {
    // Final fallback
  }

  return null;
}

/**
 * Native Capacitor Geolocation runner with OS permission prompt
 */
async function getNativeCapacitorLocation(): Promise<{ lat: number; lng: number } | null> {
  if (typeof window === 'undefined') return null;
  if (!Capacitor.isNativePlatform()) return null;

  try {
    // Check and request runtime permissions in Android/iOS native app
    const permStatus = await Geolocation.checkPermissions();
    if (permStatus.location !== 'granted') {
      const req = await Geolocation.requestPermissions();
      if (req.location !== 'granted') {
        return null;
      }
    }

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });

    if (pos && pos.coords) {
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
    }
  } catch {
    // Native GPS failed or timed out
  }

  return null;
}

/**
 * Browser Geolocation helper with timeout Promise
 */
function getBrowserPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not supported in navigator'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * Resilient multi-tier geolocation resolver:
 * 1. Native Capacitor GPS (triggers Android permission prompt)
 * 2. Browser High-Accuracy GPS (precise satellite lock)
 * 3. Browser Low-Accuracy Network/Wi-Fi (fast indoor positioning)
 * 4. Automatic Network/IP Geolocation (zero permission needed, never fails)
 */
export async function determineBestUserLocation(): Promise<{
  location: LocationInfo;
  isGpsDenied: boolean;
  gpsErrorMessage?: string;
}> {
  // Step 1: Check native Capacitor platform
  if (Capacitor.isNativePlatform()) {
    const nativeCoords = await getNativeCapacitorLocation();
    if (nativeCoords) {
      const rev = await reverseGeocodeCoords(nativeCoords.lat, nativeCoords.lng);
      return {
        location: {
          ...rev,
          source: 'gps',
        },
        isGpsDenied: false,
      };
    }
  }

  // Step 2: Try browser high accuracy GPS
  let gpsDenied = false;
  let gpsErrorMsg: string | undefined;

  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await getBrowserPosition({
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 120000,
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const rev = await reverseGeocodeCoords(lat, lng);
      return {
        location: {
          ...rev,
          source: 'gps',
        },
        isGpsDenied: false,
      };
    } catch (err: any) {
      if (err && err.code === 1) {
        // PERMISSION_DENIED
        gpsDenied = true;
        gpsErrorMsg = 'Доступ к GPS заблокирован в браузере или настройках телефона';
      } else {
        // Step 3: Try low accuracy (Wi-Fi and cell tower triangulation)
        try {
          const pos = await getBrowserPosition({
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000,
          });

          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const rev = await reverseGeocodeCoords(lat, lng);
          return {
            location: {
              ...rev,
              source: 'gps',
            },
            isGpsDenied: false,
          };
        } catch (err2: any) {
          if (err2 && err2.code === 1) {
            gpsDenied = true;
            gpsErrorMsg = 'Доступ к GPS заблокирован в браузере';
          } else {
            gpsErrorMsg = 'GPS сигнал слабый или недоступен в помещении';
          }
        }
      }
    }
  } else {
    gpsErrorMsg = 'Браузер не поддерживает определение GPS координат';
  }

  // Step 4: Fallback to automatic IP-based Geolocation
  const ipLoc = await fetchIpLocation();
  if (ipLoc) {
    return {
      location: {
        ...ipLoc,
        isFallbackFromGps: true,
        gpsBlockedReason: gpsErrorMsg,
      },
      isGpsDenied: gpsDenied,
      gpsErrorMessage: gpsErrorMsg,
    };
  }

  // Step 5: Default fallback to Moscow
  return {
    location: {
      lat: 55.7558,
      lng: 37.6173,
      city: 'Москва',
      formattedAddress: 'Москва (по умолчанию)',
      source: 'default',
      isFallbackFromGps: true,
      gpsBlockedReason: gpsErrorMsg,
    },
    isGpsDenied: gpsDenied,
    gpsErrorMessage: gpsErrorMsg,
  };
}

/**
 * Returns nearby supermarkets based on user coordinates or default center
 */
export function getNearbyStores(userLat?: number, userLng?: number, addressLabel?: string): NearbyStore[] {
  const lat = userLat || 55.7558;
  const lng = userLng || 37.6173;

  return POPULAR_CHAINS.map((c, idx) => {
    // Generate realistic distances based on coordinate seed
    const seed = Math.floor(Math.abs(lat * 1000 + lng * 1000) + idx * 73);
    const jitter = (seed % 200) - 80;
    const distanceMeters = Math.max(120, c.baseDistance + jitter);
    const { distanceText, walkMinutes } = formatDistance(distanceMeters);

    const query = `${c.name} ${addressLabel || ''}`.trim();
    const yandexUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(query)}&ll=${lng},${lat}&z=16`;
    const gisUrl = `https://2gis.ru/search/${encodeURIComponent(c.name)}`;
    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name)}&center=${lat},${lng}`;

    return {
      id: `store-${c.chain}-${idx}`,
      name: c.name,
      chain: c.chain,
      distanceMeters,
      distanceText,
      walkMinutes,
      address: addressLabel ? `${addressLabel}, филиал №${idx + 1}` : `ул. Ближайшая, д. ${10 + idx * 4}`,
      isOpen: true,
      workingHours: c.hours,
      mapYandexUrl: yandexUrl,
      map2GisUrl: gisUrl,
      mapGoogleUrl: googleUrl,
    };
  });
}
