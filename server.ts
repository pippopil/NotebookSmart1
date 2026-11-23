import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

// Ensure HMR is disabled in AI Studio dev environment to prevent WebSocket errors
process.env.DISABLE_HMR = 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  // In AI Studio environment, the dev server must run on port 3000 by default
  const portArgIndex = process.argv.indexOf('--port');
  const cliPort = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : NaN;
  const PORT = (!isNaN(cliPort) && cliPort > 0) ? cliPort : (Number(process.env.PORT) || 3000);
  const hostArgIndex = process.argv.indexOf('--host');
  const HOST = (hostArgIndex !== -1 && process.argv[hostArgIndex + 1]) ? process.argv[hostArgIndex + 1] : '0.0.0.0';

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ limit: '25mb', extended: true }));

  // API Route: AI OCR Scanner for screenshots, photos, receipts and todo lists
  app.post('/api/ocr-scan', async (req, res) => {
    try {
      const { image, mimeType = 'image/jpeg' } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'Изображение не предоставлено' });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        console.warn('GEMINI_API_KEY not configured for OCR scan');
        return res.status(503).json({
          error: 'GEMINI_API_KEY не настроен. Распознавание фото недоступно.',
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Strip data URL scheme prefix if present
      const base64Data = image.replace(/^data:[^;]+;base64,/, '');

      const prompt = `Ты — умный помощник блокнота NotebookSmart.
Внимательно распознай рукописный или печатный текст, чек, список покупок, список дел (to-do) или список трат/расходов с этого изображения.
Преобразуй информацию в аккуратный структурированный текст для тетради:

1. Списки дел и покупок:
   - Если это пункт задачи или товар без цены:
     - [ ] Название задачи или товара
   - Если пункт уже выполнен или вычеркнут:
     - [x] Выполненный пункт

2. Расходы, чеки и цены:
   - Преобразуй каждую покупку/трату в строку с ценой и валютой (руб), чтобы автоматический калькулятор тетради мог её сосчитать:
     - Молоко 3.2%: 89 руб
     - Хлеб бородинский: 45 руб
     или если это расчет:
     - Сыр: 350 * 2 руб

3. Доходы / Поступления:
   - Если указаны доходы или прибыль:
     + Зарплата: 75 000 руб

4. Заголовки и разделы:
   - Если есть группы/категории, выдели их как:
     === Название раздела ===

Важные требования:
- Выводи ТОЛЬКО распознанный текст для тетради построчно на русском языке.
- Не добавляй никакого вступительного или пояснительного текста, никаких "Вот ваш текст:".
- Сохраняй точные числа и названия.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: base64Data,
            },
          },
          { text: prompt },
        ],
      });

      const extractedText = (response.text || '').trim();
      return res.json({ text: extractedText });
    } catch (error: any) {
      console.error('Error in /api/ocr-scan:', error);
      return res.status(500).json({
        error: error.message || 'Не удалось распознать изображение',
      });
    }
  });

  // API Route: AI Auto-Tagging for notes
  app.post('/api/auto-tag', async (req, res) => {
    try {
      const { title = '', content = '', category = 'note' } = req.body;
      const combinedText = `${title}\n${content}`.trim();

      if (!combinedText) {
        return res.json({ tags: [], isAiGenerated: false });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

      if (!apiKey) {
        console.warn('GEMINI_API_KEY not configured, signaling client fallback');
        return res.status(503).json({
          error: 'GEMINI_API_KEY not configured',
          fallback: true,
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `You are a smart note auto-tagging assistant in NotebookSmart.
Analyze the following note and suggest 3 to 5 concise, highly relevant organization tags.
Common category tag examples:
- Work & Professional: "work", "project", "meeting", "client", "business"
- Personal & Life: "personal", "home", "family", "routine"
- Urgency: "urgent", "priority", "deadline", "today"
- Shopping & Supplies: "shopping", "groceries", "order"
- Finances & Budget: "finances", "budget", "expenses", "income", "taxes"
- Health & Wellness: "health", "fitness", "medicine", "doctor"
- Travel & Events: "travel", "event", "trip", "vacation"
- Study & Ideas: "study", "idea", "notes", "reading"

Choose tags that accurately describe this specific note. Use lowercase words without spaces or special characters (letters, numbers, hyphens allowed).
If the note is primarily in Russian, provide Russian or bilingual tag equivalents (e.g., "work", "срочно", "личное", "покупки", "бюджет").

Note Category: ${category}
Note Title: ${title || 'Untitled'}
Note Content:
${content}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of 3 to 5 concise tags',
              },
            },
            required: ['tags'],
          },
        },
      });

      let parsedTags: string[] = [];
      try {
        const text = response.text || '{}';
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.tags)) {
          parsedTags = parsed.tags;
        } else if (Array.isArray(parsed)) {
          parsedTags = parsed;
        }
      } catch (err) {
        console.error('Failed to parse Gemini output', err);
      }

      // Clean tags: trim, lowercase, strip any existing #
      const cleaned = parsedTags
        .map((t) => String(t).trim().toLowerCase().replace(/^[#@]+/, '').replace(/\s+/g, '-'))
        .filter((t) => t.length > 1 && t.length < 25)
        .slice(0, 5);

      return res.json({
        tags: cleaned,
        isAiGenerated: true,
      });
    } catch (error: any) {
      console.error('Error in /api/auto-tag:', error);
      return res.status(500).json({
        error: error.message || 'Failed to auto-tag note',
        fallback: true,
      });
    }
  });

  // API Route: IP Geolocation fallback when GPS is denied or unavailable
  app.get('/api/ip-location', async (req, res) => {
    try {
      const forwarded = req.headers['x-forwarded-for'];
      const rawIp = typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.socket.remoteAddress || '';

      const cleanIp = rawIp.replace(/^::ffff:/, '');
      const isLocal = !cleanIp || cleanIp === '127.0.0.1' || cleanIp === '::1';

      const queryUrl = isLocal ? 'https://ipwho.is/' : `https://ipwho.is/${cleanIp}`;
      const response = await fetch(queryUrl, { signal: AbortSignal.timeout(4000) });

      if (response.ok) {
        const data = await response.json();
        if (data && data.success !== false && data.latitude && data.longitude) {
          return res.json({
            lat: data.latitude,
            lng: data.longitude,
            city: data.city || 'Москва',
            region: data.region || '',
            country: data.country || 'Россия',
            source: 'ip',
          });
        }
      }
    } catch {
      // Fallback below
    }

    return res.json({
      lat: 55.7558,
      lng: 37.6173,
      city: 'Москва',
      source: 'default',
    });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // IP-based Geolocation fallback endpoint
  app.get('/api/geoip', async (req, res) => {
    try {
      const forwarded = req.headers['x-forwarded-for'];
      const clientIp = typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.socket.remoteAddress || '';

      const isLocal = !clientIp || clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.startsWith('10.') || clientIp.startsWith('192.168.');
      const queryUrl = isLocal
        ? 'http://ip-api.com/json/?lang=ru'
        : `http://ip-api.com/json/${clientIp}?lang=ru`;

      const response = await fetch(queryUrl, { signal: AbortSignal.timeout(4000) }).catch(() => null);
      if (response && response.ok) {
        const data = await response.json().catch(() => null);
        if (data && data.status === 'success') {
          return res.json({
            lat: data.lat,
            lng: data.lon,
            city: data.city || 'Москва',
            region: data.regionName || '',
            country: data.country || 'Россия',
            source: 'ip',
          });
        }
      }

      const fbResponse = await fetch('https://ipwhois.app/json/', { signal: AbortSignal.timeout(4000) }).catch(() => null);
      if (fbResponse && fbResponse.ok) {
        const fbData = await fbResponse.json().catch(() => null);
        if (fbData && fbData.success !== false) {
          return res.json({
            lat: fbData.latitude || 55.7558,
            lng: fbData.longitude || 37.6173,
            city: fbData.city || 'Москва',
            region: fbData.region || '',
            country: fbData.country || 'Россия',
            source: 'ip',
          });
        }
      }

      return res.json({
        lat: 55.7558,
        lng: 37.6173,
        city: 'Москва',
        source: 'default',
      });
    } catch {
      return res.json({
        lat: 55.7558,
        lng: 37.6173,
        city: 'Москва',
        source: 'default',
      });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`NotebookSmart server running on http://${HOST}:${PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error('Server listen/runtime error:', err);
    if (err.code === 'EADDRINUSE') {
      process.exit(1);
    }
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in NotebookSmart server:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection in NotebookSmart server:', reason);
});

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
