import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Note } from '../types';
import { formatMoney } from '../utils/mathEngine';
import {
  Share2,
  X,
  Copy,
  Check,
  Send,
  MessageCircle,
  Globe,
  Sparkles,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';

interface ShareNoteModalProps {
  note: Note;
  isOpen: boolean;
  onClose: () => void;
}

// Custom SVG Logo for Russian Messenger МАКС (max.ru)
const MaxMessengerIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect width="32" height="32" rx="9" fill="url(#max-gradient)" />
    <path
      d="M8.5 22.5V9.5H11.5L16 16.5L20.5 9.5H23.5V22.5H20.5V14.8L16.8 20.2H15.2L11.5 14.8V22.5H8.5Z"
      fill="white"
    />
    <defs>
      <linearGradient id="max-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366F1" />
        <stop offset="0.5" stopColor="#8B5CF6" />
        <stop offset="1" stopColor="#A855F7" />
      </linearGradient>
    </defs>
  </svg>
);

/**
 * Builds an aesthetically formatted note card text for sharing.
 * Places a clean, beautiful header at the very top (never a raw bare link),
 * avoids duplicate "Итого", and places the link neatly formatted at the bottom.
 */
export function buildFormattedShareText(note: Note, appUrl?: string): string {
  const noteTitle = (note.title || 'Заметка в тетради').trim();
  const rawContent = (note.content || '').trim();

  // Top header (never a raw URL)
  const header = `📓 Умная Тетрадь • ${noteTitle}`;
  const divider = '────────────────────────────';

  // Check if content already contains "Итого" or "Всего" to avoid duplication
  const hasTotalInContent = /(?:итого|всего|total)[\s:]/i.test(rawContent);

  let totalLine = '';
  if (!hasTotalInContent) {
    if (note.cachedTotal && note.cachedTotal > 0) {
      totalLine = `\n\n💰 Итого: ${formatMoney(note.cachedTotal, note.currency)}`;
    } else if (note.cachedPieces && note.cachedPieces > 0) {
      totalLine = `\n\n📦 Итого: ${note.cachedPieces} шт.`;
    }
  }

  let tagsLine = '';
  if (note.tags && note.tags.length > 0) {
    tagsLine = `\n\n🏷️ ${note.tags.join(' ')}`;
  }

  const linkSection = appUrl
    ? `\n${divider}\n📲 Открыть в онлайн-тетради:\n${appUrl}`
    : '';

  return `${header}\n${divider}\n${rawContent}${totalLine}${tagsLine}${linkSection}`;
}

export const ShareNoteModal: React.FC<ShareNoteModalProps> = ({
  note,
  isOpen,
  onClose,
}) => {
  const [copiedType, setCopiedType] = useState<'card' | 'text' | 'link' | 'max' | 'image' | null>(null);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const exportCardRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const triggerHaptic = (ms = 12) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  };

  const shareUrl =
    typeof window !== 'undefined'
      ? window.location.origin + window.location.pathname
      : 'https://ais-dev-ycvofz47hoodwgil62oiw3-62810945990.us-west1.run.app/';

  const formattedShareText = buildFormattedShareText(note, shareUrl);
  const rawTextOnly = `${note.title ? `📝 ${note.title}\n\n` : ''}${note.content || ''}`;

  // 1. Native Web Share (Without separate 'url' field so mobile OS doesn't place a bare link on top)
  const handleNativeShare = async () => {
    triggerHaptic(15);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: note.title || 'Заметка в тетради',
          text: formattedShareText,
        });
        onClose();
      } catch {
        // User cancelled or not supported
      }
    } else {
      handleCopyCard();
    }
  };

  // 2. Share to МАКС (VK MAX Messenger - max.ru)
  const handleShareMax = async () => {
    triggerHaptic(15);
    // Copy formatted text to clipboard first as reliable fallback
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(formattedShareText);
        setCopiedType('max');
        setTimeout(() => setCopiedType(null), 3000);
      } catch {
        // ignore
      }
    }

    // Try web intent / deep link for MAX
    const maxWebUrl = `https://max.ru/:share?text=${encodeURIComponent(formattedShareText)}`;
    window.open(maxWebUrl, '_blank', 'noopener,noreferrer');
  };

  // 3. Telegram Share (Keep url empty to prevent Telegram from prepending a bare URL at line 1)
  const handleShareTelegram = () => {
    triggerHaptic(15);
    const tgUrl = `https://t.me/share/url?url=&text=${encodeURIComponent(formattedShareText)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
  };

  // 4. WhatsApp Share
  const handleShareWhatsApp = () => {
    triggerHaptic(15);
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(formattedShareText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // 5. VKontakte Share
  const handleShareVK = () => {
    triggerHaptic(15);
    const vkUrl = `https://vk.com/share.php?comment=${encodeURIComponent(formattedShareText)}`;
    window.open(vkUrl, '_blank', 'noopener,noreferrer');
  };

  // Copy full card with beautiful header and link
  const handleCopyCard = async () => {
    triggerHaptic(12);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(formattedShareText);
      setCopiedType('card');
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  // Copy plain text only
  const handleCopyPlain = async () => {
    triggerHaptic(12);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(rawTextOnly);
      setCopiedType('text');
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  // Copy app link
  const handleCopyLink = async () => {
    triggerHaptic(12);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedType('link');
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  // Export & share note card as a styled notebook-paper PNG image (QW 2.1)
  const handleShareAsImage = async () => {
    if (!exportCardRef.current || isExportingImage) return;
    triggerHaptic(15);
    setIsExportingImage(true);
    setImageError(null);

    try {
      const dataUrl = await toPng(exportCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#fffdf9',
      });

      // 1. Optional native Android bridge if present in future APK builds
      const nativeBridge = window.AndroidNative as
        | (NonNullable<Window['AndroidNative']> & { shareImage?: (base64: string) => void })
        | undefined;
      if (nativeBridge && typeof nativeBridge.shareImage === 'function') {
        nativeBridge.shareImage(dataUrl);
        setCopiedType('image');
        setTimeout(() => setCopiedType(null), 2500);
        return;
      }

      // Convert dataUrl to Blob/File for Web Share API or direct download
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const safeTitle = (note.title || 'notebook-note')
        .toLowerCase()
        .replace(/[^a-z0-9а-яё_-]+/gi, '_')
        .slice(0, 32);
      const fileName = `${safeTitle || 'note'}.png`;
      const imageFile = new File([blob], fileName, { type: 'image/png' });

      // 2. Web Share API with files (iOS Safari / Android Chrome / PWA)
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [imageFile] })
      ) {
        await navigator.share({
          title: note.title || 'Заметка NotebookSmart',
          files: [imageFile],
        });
        setCopiedType('image');
        setTimeout(() => setCopiedType(null), 2500);
        return;
      }

      // 3. Universal fallback: download PNG directly
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setCopiedType('image');
      setTimeout(() => setCopiedType(null), 2500);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setImageError('Не удалось сформировать картинку. Попробуйте скопировать текст.');
    } finally {
      setIsExportingImage(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#fffdf9] dark:bg-stone-900 border border-amber-900/15 dark:border-stone-700 rounded-3xl p-5 shadow-2xl space-y-4 text-stone-900 dark:text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-amber-900/10 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-stone-900 dark:text-white">
                Поделиться заметкой
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Красивый формат для отправки в мессенджеры
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно экспорта"
            className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alert when copied for MAX */}
        {copiedType === 'max' && (
          <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-400/30 text-purple-900 dark:text-purple-300 text-xs flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>Текст заметки скопирован! Открываем мессенджер МАКС...</span>
          </div>
        )}

        {/* Note Preview Box (Card formatting) */}
        <div className="bg-amber-50/70 dark:bg-stone-950/70 p-3 rounded-2xl border border-amber-200/60 dark:border-stone-800 font-mono text-xs max-h-40 overflow-y-auto leading-relaxed">
          <div className="text-amber-900/80 dark:text-amber-300/80 font-bold border-b border-amber-900/10 dark:border-stone-800 pb-1 mb-1.5 flex items-center justify-between">
            <span>📓 Умная Тетрадь • {note.title || 'Заметка'}</span>
            <span className="text-[10px] font-normal text-stone-500">вид сообщения</span>
          </div>
          <p className="text-stone-700 dark:text-stone-300 whitespace-pre-wrap">
            {note.content || 'Пустая страница...'}
          </p>
          <div className="mt-2 pt-1 border-t border-dashed border-amber-900/15 dark:border-stone-800 text-[10px] text-stone-500 dark:text-stone-400">
            📲 Открыть в онлайн-тетради
          </div>
        </div>

        {/* Messengers Grid: МАКС, Telegram, WhatsApp, VK */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-2">
            Отправить в мессенджер
          </span>
          <div className="grid grid-cols-4 gap-2">
            {/* 1. МАКС (Russian Messenger) */}
            <button
              onClick={handleShareMax}
              className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 transition active:scale-95 cursor-pointer shadow-2xs group"
              title="Поделиться в мессенджере МАКС"
            >
              <div className="transition group-hover:scale-110">
                <MaxMessengerIcon className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold">МАКС</span>
            </button>

            {/* 2. Telegram */}
            <button
              onClick={handleShareTelegram}
              className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 transition active:scale-95 cursor-pointer shadow-2xs group"
              title="Поделиться в Telegram"
            >
              <div className="transition group-hover:scale-110">
                <Send className="w-6 h-6 text-sky-500" />
              </div>
              <span className="text-xs font-bold">Telegram</span>
            </button>

            {/* 3. WhatsApp */}
            <button
              onClick={handleShareWhatsApp}
              className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 transition active:scale-95 cursor-pointer shadow-2xs group"
              title="Поделиться в WhatsApp"
            >
              <div className="transition group-hover:scale-110">
                <MessageCircle className="w-6 h-6 text-emerald-500" />
              </div>
              <span className="text-xs font-bold">WhatsApp</span>
            </button>

            {/* 4. VKontakte */}
            <button
              onClick={handleShareVK}
              className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 transition active:scale-95 cursor-pointer shadow-2xs group"
              title="Поделиться во ВКонтакте"
            >
              <div className="transition group-hover:scale-110">
                <Globe className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-xs font-bold">ВКонтакте</span>
            </button>
          </div>
        </div>

        {/* Share as PNG Notebook Card (QW 2.1) */}
        <button
          type="button"
          onClick={handleShareAsImage}
          disabled={isExportingImage}
          aria-label="Поделиться заметкой как картинкой PNG"
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-stone-900 hover:bg-stone-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-bold text-xs shadow-sm transition active:scale-98 cursor-pointer disabled:opacity-60"
        >
          {isExportingImage ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Создаём лист тетради (PNG)...</span>
            </>
          ) : copiedType === 'image' ? (
            <>
              <Check className="w-4 h-4 text-emerald-400 dark:text-white" />
              <span>Картинка готова!</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-4 h-4" />
              <span>Поделиться как картинка (лист тетради PNG)</span>
            </>
          )}
        </button>

        {imageError && (
          <p className="text-[11px] text-rose-600 dark:text-rose-400 text-center font-medium">
            {imageError}
          </p>
        )}

        {/* Native Web Share Button (Mobile Action Sheet) */}
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-md transition active:scale-98 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Системное меню «Поделиться» (все приложения)</span>
          </button>
        )}

        {/* Copy Actions */}
        <div className="pt-2 border-t border-amber-900/10 dark:border-stone-800 space-y-2">
          <div className="flex items-center gap-2">
            {/* Copy full formatted card */}
            <button
              type="button"
              onClick={handleCopyCard}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 dark:bg-stone-800 text-amber-950 dark:text-amber-300 text-xs font-bold border border-amber-400/40 dark:border-stone-700 transition active:scale-95 cursor-pointer"
            >
              {copiedType === 'card' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400">Красиво скопировано!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Скопировать красиво</span>
                </>
              )}
            </button>

            {/* Copy plain text only */}
            <button
              type="button"
              onClick={handleCopyPlain}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold border border-stone-200 dark:border-stone-700 transition active:scale-95 cursor-pointer"
            >
              {copiedType === 'text' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400">Текст скопирован!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                  <span>Только текст</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-stone-50 hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 text-[11px] transition cursor-pointer"
          >
            {copiedType === 'link' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">Ссылка скопирована</span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5" />
                <span>Скопировать ссылку на тетрадь</span>
              </>
            )}
          </button>
        </div>

        {/* Off-screen styled Notebook Sheet strictly rendered for PNG export */}
        <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
          <div
            ref={exportCardRef}
            className="w-[560px] notebook-grid-warm notebook-margin-red notebook-spiral-border rounded-2xl border border-amber-900/20 p-6 pl-[74px] text-stone-900"
          >
            <div className="flex items-center justify-between border-b border-amber-900/15 pb-3 mb-4">
              <div className="font-extrabold text-lg text-stone-900 leading-tight">
                {note.title || 'Заметка NotebookSmart'}
              </div>
              <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-100/90 px-2.5 py-1 rounded-lg border border-amber-300/60">
                📓 NotebookSmart
              </span>
            </div>

            <div className="whitespace-pre-wrap text-[15px] leading-[28px] text-stone-800 font-medium break-words">
              {(note.content || 'Пустая страница...').slice(0, 1600)}
            </div>

            {(typeof note.cachedTotal === 'number' && note.cachedTotal !== 0) && (
              <div className="mt-4 pt-3 border-t border-amber-900/15 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Итого по странице
                </span>
                <span className="text-base font-extrabold font-mono text-emerald-800">
                  {formatMoney(note.cachedTotal, note.currency)}
                </span>
              </div>
            )}

            {note.tags && note.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {note.tags.map((tg) => (
                  <span
                    key={tg}
                    className="text-[11px] font-mono font-semibold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md"
                  >
                    {tg}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
