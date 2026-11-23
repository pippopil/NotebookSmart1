import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Note, NoteCategory, PaperStyleType, EventCategory, EVENT_CATEGORY_CONFIG, EVENT_CATEGORIES_LIST } from '../types';
import { analyzeNote, formatMoney } from '../utils/mathEngine';
import { extractShoppingItems } from '../utils/shoppingParser';
import {
  ArrowLeft,
  Trash2,
  Share2,
  Pin,
  ShoppingCart,
  Calculator,
  Calendar,
  FileText,
  Clock,
  Check,
  Copy,
  PlusCircle,
  Grid,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Sparkles,
  Bell,
  BellRing,
  BellOff,
  Volume2,
  Tag,
  X,
  Plus,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Eye,
  Edit3,
  Send,
  MessageCircle,
  Mic,
  MicOff,
  Square,
  Camera,
  Image as ImageIcon,
  Type,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileAudio,
  Wand2,
  Eraser,
  ListMusic,
  RotateCcw,
  FileCheck,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { ShareNoteModal } from './ShareNoteModal';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { useSpeechDictation } from '../hooks/useSpeechDictation';
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  formatReminderDateTime,
  toDateTimeLocalString,
  NotificationPermissionState,
} from '../services/notifications';
import {
  generateAutoTags,
  POPULAR_TAGS,
  normalizeTag,
  hasAiConsent,
  isAiDisabled,
  setAiConsent,
} from '../services/aiTagging';
import {
  parseVoiceFinanceAction,
  VoiceFinanceMatch,
} from '../utils/voiceFinanceParser';
import {
  nativeHaptic,
  isAndroidNativeApp,
  getAndroidNotificationStatus,
  requestAndroidBatteryExemption,
  AndroidNotificationStatus,
} from '../services/nativeBridge';

import { getGlobalAutoCalculate } from '../services/storage';

interface NoteEditorProps {
  note: Note;
  globalAutoCalculate?: boolean;
  onUpdate: (updated: Note) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onOpenShopping: (note: Note) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  globalAutoCalculate,
  onUpdate,
  onDelete,
  onClose,
  onOpenShopping,
}) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [category, setCategory] = useState<NoteCategory>(note.category || 'note');
  const autoCalculate = globalAutoCalculate !== undefined ? globalAutoCalculate : getGlobalAutoCalculate();
  const [isPinned, setIsPinned] = useState(note.isPinned || false);
  const [eventDate, setEventDate] = useState(note.eventDate || '');
  const [eventTime, setEventTime] = useState(note.eventTime || '');
  const [eventCategory, setEventCategory] = useState<EventCategory>(note.eventCategory || 'meeting');
  const [isEventDone, setIsEventDone] = useState(note.isEventDone || false);
  const [paperStyle, setPaperStyle] = useState<PaperStyleType>(
    note.paperStyle === 'dark-grid' ? 'grid' : (note.paperStyle || 'grid')
  );
  const [showPaperMenu, setShowPaperMenu] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Push Notifications & Reminders state (OS-level on Android, Web Push fallback in browser)
  const [reminderEnabled, setReminderEnabled] = useState(note.reminderEnabled || false);
  const [reminderDateTime, setReminderDateTime] = useState<string>(() => {
    if (note.reminderDateTime) return note.reminderDateTime;
    if (note.category === 'event' && note.eventDate && note.eventTime) {
      return `${note.eventDate}T${note.eventTime}`;
    }
    const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
    return toDateTimeLocalString(defaultDate);
  });
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermission()
  );
  const [androidStatus, setAndroidStatus] = useState<AndroidNotificationStatus | null>(() =>
    getAndroidNotificationStatus()
  );
  const [testNotifSent, setTestNotifSent] = useState(false);

  useEffect(() => {
    if (!isAndroidNativeApp()) return;
    const prevCallback = window.onNativePermissionResult;
    window.onNativePermissionResult = (json: string) => {
      try {
        const parsed = JSON.parse(json) as AndroidNotificationStatus;
        setAndroidStatus(parsed);
        setNotifPermission(parsed.notificationsEnabled ? 'granted' : 'denied');
      } catch {}
      if (prevCallback) prevCallback(json);
    };
    return () => {
      window.onNativePermissionResult = prevCallback;
    };
  }, []);

  // Tags & AI Auto-tagging state
  const [tags, setTags] = useState<string[]>(note.tags || []);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [isLoadingAiTags, setIsLoadingAiTags] = useState<boolean>(false);
  const [tagInput, setTagInput] = useState<string>('');
  const [isAiSource, setIsAiSource] = useState<boolean>(false);
  const [showAiConsentPrompt, setShowAiConsentPrompt] = useState<boolean>(false);
  const [voiceFinanceNotice, setVoiceFinanceNotice] = useState<VoiceFinanceMatch | null>(null);

  // Formatting & Preview Mode
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [isSocialShareOpen, setIsSocialShareOpen] = useState<boolean>(false);

  // Virtual keyboard & writing focus detection for smart card lifting ("выталкивание карточки вверх")
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);
  const [isTextareaFocused, setIsTextareaFocused] = useState<boolean>(false);
  const [isCardCollapsedManually, setIsCardCollapsedManually] = useState<boolean | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      // If visual viewport height is substantially smaller than window.innerHeight, the virtual keyboard is open
      const diff = window.innerHeight - vv.height;
      setIsKeyboardOpen(diff > 140);
    };
    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, []);

  const isTyping = isTextareaFocused || isKeyboardOpen;
  const shouldLiftCard = isCardCollapsedManually !== null ? isCardCollapsedManually : isTyping;

  // Mobile swipe navigation: swipe horizontally returns to main notes screen
  useSwipeBack({
    onBack: onClose,
    enabled: true,
  });

  // Font Size Presets (scaling font, line height, background lines & calculation rows together)
  const FONT_PRESETS = [
    { label: 'Мелкий', size: 13, lineHeight: 24 },
    { label: 'Стандарт', size: 15, lineHeight: 28 },
    { label: 'Крупный', size: 18, lineHeight: 34 },
    { label: 'Большой', size: 22, lineHeight: 40 },
    { label: 'Макси', size: 26, lineHeight: 48 },
  ];

  const [fontPresetIndex, setFontPresetIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('notebook_font_idx');
      if (saved !== null) {
        const idx = Number(saved);
        if (idx >= 0 && idx < 5) return idx;
      }
    } catch {}
    return 1; // default 'Стандарт' 15px / 28px
  });

  const currentFont = FONT_PRESETS[fontPresetIndex] || FONT_PRESETS[1];

  const handleFontSizeChange = (delta: number) => {
    triggerHaptic(10);
    const nextIdx = Math.max(0, Math.min(FONT_PRESETS.length - 1, fontPresetIndex + delta));
    setFontPresetIndex(nextIdx);
    try {
      localStorage.setItem('notebook_font_idx', String(nextIdx));
    } catch {}
  };

  // OCR Recognition State & File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);
  const [ocrStatusText, setOcrStatusText] = useState<string>('');
  const [showOcrMenu, setShowOcrMenu] = useState<boolean>(false);

  // Synchronized scrolling refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const calcColumnRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef<boolean>(false);

  const handleTextareaScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (isSyncingScroll.current) return;
    if (calcColumnRef.current) {
      isSyncingScroll.current = true;
      calcColumnRef.current.scrollTop = e.currentTarget.scrollTop;
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const handlePreviewScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScroll.current) return;
    if (calcColumnRef.current) {
      isSyncingScroll.current = true;
      calcColumnRef.current.scrollTop = e.currentTarget.scrollTop;
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const handleCalcScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    const top = e.currentTarget.scrollTop;
    if (textareaRef.current) {
      textareaRef.current.scrollTop = top;
    }
    if (previewRef.current) {
      previewRef.current.scrollTop = top;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  // Image OCR Handler
  const handleImageFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setCopiedText('Выберите файл изображения (JPG, PNG, WEBP)');
      setTimeout(() => setCopiedText(null), 2500);
      return;
    }

    triggerHaptic(15);
    setIsOcrProcessing(true);
    setOcrStatusText('Чтение изображения...');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Url = reader.result as string;
        setOcrStatusText('AI распознает дела, покупки и расходы...');

        const response = await fetch('/api/ocr-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64Url,
            mimeType: file.type || 'image/jpeg',
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Ошибка распознавания');
        }

        const data = await response.json();
        const extracted = (data.text || '').trim();

        if (extracted) {
          triggerHaptic(25);
          setContent((prev) => {
            if (!prev.trim()) return extracted;
            return prev.trimEnd() + '\n\n' + extracted;
          });
          setCopiedText('✓ Распознано и добавлено в тетрадь!');
          setTimeout(() => setCopiedText(null), 3000);
        } else {
          setCopiedText('Текст на изображении не обнаружен');
          setTimeout(() => setCopiedText(null), 3000);
        }
      } catch (err: any) {
        console.error('OCR Error:', err);
        setCopiedText(err.message || 'Ошибка распознавания');
        setTimeout(() => setCopiedText(null), 3500);
      } finally {
        setIsOcrProcessing(false);
        setOcrStatusText('');
      }
    };

    reader.onerror = () => {
      setIsOcrProcessing(false);
      setOcrStatusText('');
      setCopiedText('Ошибка чтения файла изображения');
      setTimeout(() => setCopiedText(null), 2500);
    };

    reader.readAsDataURL(file);
  };

  // Auto-analysis of math and shopping automatically when autoCalculate !== false
  const mathSummary = useMemo(
    () => analyzeNote(content, category, autoCalculate),
    [content, category, autoCalculate]
  );
  const shoppingItems = useMemo(() => extractShoppingItems(content), [content]);

  // Synchronize state changes back to parent
  useEffect(() => {
    onUpdate({
      ...note,
      title,
      content,
      category,
      tags,
      isPinned,
      eventDate,
      eventTime,
      eventCategory,
      isEventDone,
      paperStyle,
      reminderEnabled,
      reminderDateTime,
      reminderTriggered: false,
      updatedAt: Date.now(),
      cachedTotal: mathSummary.grandTotal,
      cachedIncome: mathSummary.totalIncome,
      cachedExpenses: mathSummary.totalExpenses,
      cachedNetBalance: mathSummary.netBalance,
      cachedPieces: mathSummary.totalPieces,
      currency: mathSummary.currency,
      shoppingItemsCount: shoppingItems.length,
      completedItemsCount: shoppingItems.filter((i) => i.isCompleted).length,
    });
  }, [
    title,
    content,
    category,
    tags,
    isPinned,
    eventDate,
    eventTime,
    eventCategory,
    isEventDone,
    paperStyle,
    reminderEnabled,
    reminderDateTime,
  ]);

  // Haptic feedback (Native Android Vibrator with browser fallback)
  const triggerHaptic = (ms: number = 12) => {
    nativeHaptic(ms >= 30 ? 'heavy' : ms >= 20 ? 'medium' : 'light');
  };

  // Add a tag to current note
  const handleAddTag = (tagToAdd: string) => {
    const norm = normalizeTag(tagToAdd);
    if (!norm) return;
    triggerHaptic(10);
    if (!tags.includes(norm)) {
      setTags((prev) => [...prev, norm]);
    }
    setSuggestedTags((prev) => prev.filter((t) => t.toLowerCase() !== norm.toLowerCase()));
    setTagInput('');
  };

  // Remove a tag
  const handleRemoveTag = (tagToRemove: string) => {
    triggerHaptic(10);
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // Keyboard navigation in editor: Ctrl/Cmd+S to save, Esc to exit/close popups (DS R-A11Y-02)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        triggerHaptic(10);
        onUpdate({
          ...note,
          title,
          content,
          category,
          tags,
          isPinned,
          eventDate,
          eventTime,
          eventCategory,
          isEventDone,
          paperStyle,
          reminderEnabled,
          reminderDateTime,
          updatedAt: Date.now(),
        });
        setCopiedText('✓ Заметка сохранена');
        setTimeout(() => setCopiedText(null), 1800);
      } else if (e.key === 'Escape') {
        if (showAiConsentPrompt) {
          setShowAiConsentPrompt(false);
        } else if (isSocialShareOpen) {
          setIsSocialShareOpen(false);
        } else if (showVoiceModal) {
          setShowVoiceModal(false);
        } else if (showPaperMenu) {
          setShowPaperMenu(false);
        } else if (showOcrMenu) {
          setShowOcrMenu(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    note,
    title,
    content,
    category,
    tags,
    isPinned,
    eventDate,
    eventTime,
    eventCategory,
    isEventDone,
    paperStyle,
    reminderEnabled,
    reminderDateTime,
    showAiConsentPrompt,
    isSocialShareOpen,
    showPaperMenu,
    showOcrMenu,
    onUpdate,
    onClose,
  ]);

  // Execute AI Auto-Tagging (with explicit privacy gate DS R-AI-04 / A-02)
  const executeAutoTagging = async (allowNetwork: boolean) => {
    setIsLoadingAiTags(true);
    try {
      const res = await generateAutoTags(title, content, category, { allowNetwork });
      const filtered = res.tags.filter(
        (t) => !tags.some((existing) => existing.toLowerCase() === t.toLowerCase())
      );
      setSuggestedTags(filtered);
      setIsAiSource(res.isAiGenerated);
      if (allowNetwork && res.blockedReason === 'ai_disabled') {
        setCopiedText('AI отключён в настройках — подобраны локальные теги');
        setTimeout(() => setCopiedText(null), 2600);
      } else if (allowNetwork && res.blockedReason === 'offline') {
        setCopiedText('Нет сети (требуется интернет) — подобраны локальные теги');
        setTimeout(() => setCopiedText(null), 2600);
      }
    } catch {
      // Handled internally in generateAutoTags
    } finally {
      setIsLoadingAiTags(false);
    }
  };

  // Manual click on AI Auto-Tagging button
  const handleTriggerAiTagging = async () => {
    triggerHaptic(15);
    if (!isAiDisabled() && !hasAiConsent()) {
      setShowAiConsentPrompt(true);
      return;
    }
    await executeAutoTagging(true);
  };

  // Suggest tags locally without transmitting note content over network (DS A-02)
  useEffect(() => {
    const combined = `${title} ${content}`.trim();
    if (combined.length >= 6 && tags.length === 0 && suggestedTags.length === 0) {
      const timer = setTimeout(() => {
        void executeAutoTagging(false);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [title, content]);

  // Insert snippet or operator at cursor position
  const insertTextAtCursor = (textToInsert: string) => {
    triggerHaptic();
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + textToInsert);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;

    const nextContent = current.substring(0, start) + textToInsert + current.substring(end);
    setContent(nextContent);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + textToInsert.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 10);
  };

  // Voice Dictation & Dedicated Voice Transcription Hub
  const [useSmartPunctuation, setUseSmartPunctuation] = useState<boolean>(true);
  const [showVoiceModal, setShowVoiceModal] = useState<boolean>(false);
  const [transcriptHistory, setTranscriptHistory] = useState<
    { id: string; time: string; text: string }[]
  >([]);

  const handleSpeechFinal = (finalChunk: string) => {
    triggerHaptic(10);
    const chunkTrimmed = finalChunk.trim();
    if (!chunkTrimmed) return;

    const nowTime = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setTranscriptHistory((prev) => [
      ...prev,
      {
        id: String(Date.now()) + '-' + Math.random().toString(36).substring(2, 6),
        time: nowTime,
        text: chunkTrimmed,
      },
    ]);

    const voiceFinance = parseVoiceFinanceAction(chunkTrimmed);
    if (voiceFinance) {
      setVoiceFinanceNotice(voiceFinance);
      setTags((prev) =>
        prev.some((t) => t.toLowerCase() === '#auto_voice') ? prev : [...prev, '#auto_voice']
      );
      if (category === 'note' || category === 'general') {
        setCategory('payment');
      }
    }

    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const current = textarea.value;
      let textToInsert = voiceFinance ? voiceFinance.formattedLine : chunkTrimmed;
      if (
        start > 0 &&
        !/\s$/.test(current.substring(0, start)) &&
        !/^\s/.test(textToInsert) &&
        !/^[.,;:!?]/.test(textToInsert)
      ) {
        textToInsert = (voiceFinance ? '\n' : ' ') + textToInsert;
      }
      const nextContent = current.substring(0, start) + textToInsert + current.substring(end);
      setContent(nextContent);
      setTimeout(() => {
        textarea.focus();
        const newPos = start + textToInsert.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 10);
    } else {
      const chunkToAppend = voiceFinance ? voiceFinance.formattedLine : chunkTrimmed;
      setContent((prev) => {
        if (!prev) return chunkToAppend;
        const needsSpace = !/\s$/.test(prev) && !/^[.,;:!?]/.test(chunkToAppend);
        return prev + (voiceFinance ? '\n' : needsSpace ? ' ' : '') + chunkToAppend;
      });
    }
  };

  const {
    isListening,
    interimTranscript,
    error: speechError,
    clearError: clearSpeechError,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
    toggleListening,
  } = useSpeechDictation({
    onFinalTranscript: handleSpeechFinal,
    lang: 'ru-RU',
    smartPunctuation: useSmartPunctuation,
  });

  // Text formatting: wraps selection with markers, bold, italic or underline
  const wrapSelection = (prefix: string, suffix: string) => {
    triggerHaptic(10);
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + prefix + suffix);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const selected = current.substring(start, end);
    const replacement = selected ? `${prefix}${selected}${suffix}` : `${prefix}выделение${suffix}`;
    const nextContent = current.substring(0, start) + replacement + current.substring(end);
    setContent(nextContent);

    setTimeout(() => {
      textarea.focus();
      const cursorStart = start + prefix.length;
      const cursorEnd = cursorStart + (selected ? selected.length : 9);
      textarea.setSelectionRange(cursorStart, cursorEnd);
    }, 15);
  };

  // Clean Markdown Marker: applies colored highlighting without inserting messy raw HTML tags (<mark class="...">)
  const applyColorMarker = (colorName: 'yellow' | 'green' | 'pink' | 'blue' | 'orange' | 'purple') => {
    triggerHaptic(10);
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const selected = current.substring(start, end);

    if (!selected) {
      const placeholder = 'выделение';
      const markerTag = `==${colorName}:${placeholder}==`;
      const nextContent = current.substring(0, start) + markerTag + current.substring(end);
      setContent(nextContent);
      setTimeout(() => {
        textarea.focus();
        const cursorStart = start + colorName.length + 3; // position cursor inside placeholder
        textarea.setSelectionRange(cursorStart, cursorStart + placeholder.length);
      }, 15);
      return;
    }

    // Strip previous marker tags if already wrapped
    const cleanSelected = selected
      .replace(/<mark class="marker-[^"]+">(.*?)<\/mark>/gi, '$1')
      .replace(/==(?:[a-z]+:)?(.*?)==/gi, '$1');

    const markerTag = `==${colorName}:${cleanSelected}==`;
    const nextContent = current.substring(0, start) + markerTag + current.substring(end);
    setContent(nextContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + markerTag.length);
    }, 15);
  };

  // One-click sanitizer: strips legacy <mark class="..."> HTML code tags and restores clean text
  const handleCleanCodeTags = () => {
    triggerHaptic(20);
    const cleaned = content
      .replace(/<mark class="marker-[^"]+">(.*?)<\/mark>/gi, '$1')
      .replace(/<mark[^>]*>(.*?)<\/mark>/gi, '$1')
      .replace(/<\/?[a-z][^>]*>/gi, '');
    setContent(cleaned);
    setCopiedText('✓ Все теги кода очищены!');
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Remove color marker from selected text (or entire text if nothing selected)
  const handleRemoveColorMarker = () => {
    triggerHaptic(10);
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const selected = current.substring(start, end);

    if (!selected) {
      handleCleanCodeTags();
      return;
    }

    const clean = selected
      .replace(/<mark class="marker-[^"]+">(.*?)<\/mark>/gi, '$1')
      .replace(/==(?:[a-z]+:)?(.*?)==/gi, '$1');

    const nextContent = current.substring(0, start) + clean + current.substring(end);
    setContent(nextContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + clean.length);
    }, 15);
  };

  const hasLegacyHtmlTags = /<mark\b|<\/mark>|<[a-z]+ class=/i.test(content);

  // Copy result or insert calculation
  const handleCopyResult = (val: number, cur?: string) => {
    triggerHaptic();
    const str = formatMoney(val, cur);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(str);
      setCopiedText(`Скопировано: ${str}`);
      setTimeout(() => setCopiedText(null), 1800);
    }
  };

  // Insert grand total into text
  const handleInsertGrandTotal = () => {
    triggerHaptic();
    let label = 'Итого:';
    if (mathSummary.hasIncomeExpenseSplit) {
      label = 'Остаток в итоге:';
    } else if (mathSummary.currency === 'шт.') {
      label = 'Итого количество:';
    } else if (mathSummary.currency) {
      label = 'Итого к оплате:';
    } else {
      label = 'Итого результат:';
    }
    const totalStr = `\n\n${label} ${formatMoney(mathSummary.grandTotal, mathSummary.currency)}`;
    setContent((prev) => prev + totalStr);
  };

  // Share note text across social media or system share
  const handleShare = () => {
    triggerHaptic();
    setIsSocialShareOpen(true);
  };

  // Paper styling class mapping
  const paperClass = {
    'dark-grid': 'notebook-grid-dark',
    grid: 'notebook-grid-warm',
    lines: 'notebook-lines',
    kraft: 'notebook-kraft',
    dots: 'notebook-dots',
    plain: 'notebook-plain',
  }[paperStyle] || 'notebook-grid-warm';

  const paperNames: Record<PaperStyleType, string> = {
    grid: 'В клетку (тетрадь)',
    lines: 'В линейку',
    kraft: 'Крафтовая бумага',
    dots: 'Точечная (Bullet)',
    plain: 'Чистый лист (слоновая кость)',
    'dark-grid': 'Ночная клетка',
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#faf7f2] dark:bg-[#141210] text-stone-900 dark:text-stone-100 flex flex-col safe-top safe-bottom transition-colors">
      {/* COMPACT & RESPONSIVE TOP ACTION HEADER (Never overflows on mobile) */}
      <div className="px-3 sm:px-4 py-2.5 bg-[#fcfaf7]/95 dark:bg-stone-900/95 backdrop-blur-xl border-b border-amber-900/10 dark:border-stone-800 flex items-center justify-between gap-1.5 shrink-0 z-20">
        {/* Back Button */}
        <button
          onClick={onClose}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs sm:text-sm font-semibold transition active:scale-95 cursor-pointer border border-stone-200 dark:border-stone-700 shrink-0"
          title="Вернуться к списку заметок"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden xs:inline">Назад</span>
        </button>

        {/* Right Tools: Day/Night, Paper, Shopping, Pin, Share, Delete */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Day / Night mode toggle */}
          <ThemeToggle compact />

          {/* Paper Texture Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                triggerHaptic();
                setShowPaperMenu(!showPaperMenu);
              }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 text-xs font-medium transition cursor-pointer"
              title="Выбрать фактуру бумаги"
            >
              <Grid className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden md:inline">{paperNames[paperStyle]}</span>
            </button>

            {showPaperMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-stone-900 border border-amber-900/15 dark:border-stone-700 rounded-2xl shadow-xl p-1.5 z-30 animate-in fade-in zoom-in-95">
                <div className="text-[10px] uppercase font-bold text-stone-600 dark:text-stone-300 px-2 py-1 tracking-wider">
                  Фактура бумаги
                </div>
                {(['grid', 'lines', 'kraft', 'dots', 'plain'] as PaperStyleType[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      triggerHaptic();
                      setPaperStyle(p);
                      setShowPaperMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                      paperStyle === p
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 font-bold'
                        : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <span>{paperNames[p]}</span>
                    {paperStyle === p && <Check className="w-3.5 h-3.5 text-amber-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Shopping quick link if items exist */}
          {(category === 'shopping' || shoppingItems.length > 0) && (
            <button
              onClick={() => onOpenShopping({ ...note, content, title })}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-emerald-100/90 hover:bg-emerald-200 dark:bg-emerald-600/30 dark:hover:bg-emerald-600/40 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-xs font-bold transition active:scale-95 cursor-pointer shrink-0"
              title="Открыть корзину покупок"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>{shoppingItems.length}</span>
            </button>
          )}

          {/* Voice dictation button in top bar (Web Speech API) */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              if (!isSpeechSupported) {
                setCopiedText('Голосовой ввод не поддерживается браузером');
                setTimeout(() => setCopiedText(null), 2500);
                return;
              }
              toggleListening();
            }}
            className={`p-1.5 rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1 ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-600 text-white border border-rose-600 shadow-md animate-pulse'
                : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
            }`}
            title={
              isListening
                ? 'Идет запись... Нажмите, чтобы остановить'
                : isSpeechSupported
                ? 'Диктовать заметку голосом (Web Speech API)'
                : 'Голосовой ввод не поддерживается в этом браузере'
            }
          >
            {isListening ? (
              <>
                <Mic className="w-4 h-4 animate-bounce text-white" />
                <span className="text-[11px] font-bold hidden sm:inline text-white">Запись...</span>
              </>
            ) : (
              <Mic className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            )}
          </button>

          {/* Pin note button */}
          <button
            onClick={() => {
              triggerHaptic();
              setIsPinned(!isPinned);
            }}
            className={`p-1.5 rounded-xl transition cursor-pointer shrink-0 ${
              isPinned
                ? 'bg-amber-400/25 text-amber-900 dark:text-amber-300 border border-amber-400/40'
                : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700'
            }`}
            title={isPinned ? 'Открепить' : 'Закрепить'}
          >
            <Pin className={`w-4 h-4 ${isPinned ? 'fill-amber-500 text-amber-700' : ''}`} />
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 transition cursor-pointer shrink-0"
            title="Поделиться заметкой"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Delete button */}
          <button
            onClick={() => {
              triggerHaptic();
              if (window.confirm('Удалить эту страницу тетради?')) {
                onDelete(note.id);
                onClose();
              }
            }}
            className="p-1.5 rounded-xl bg-stone-100 hover:bg-rose-100 dark:bg-stone-800 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-stone-200 dark:border-stone-700 transition cursor-pointer shrink-0"
            title="Удалить страницу"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* UNIFIED SCROLLABLE BODY: Enables full-page vertical scrolling in Events & Notes */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain flex flex-col min-h-0">

      {/* SIMPLIFIED 3-MODE SELECTOR & QUICK STATUS (Compact when keyboard is open or card is lifted) */}
      {shouldLiftCard ? (
        <div className="px-3 sm:px-4 py-1.5 bg-stone-50/90 dark:bg-stone-900/90 border-b border-amber-900/10 dark:border-stone-800 flex items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-900 dark:text-amber-300 font-bold text-[11px] shrink-0">
              {category === 'shopping' ? (
                <ShoppingCart className="w-3 h-3 text-emerald-600" />
              ) : category === 'event' ? (
                <Calendar className="w-3 h-3 text-purple-600" />
              ) : (
                <FileText className="w-3 h-3 text-blue-600" />
              )}
              <span>
                {category === 'shopping'
                  ? 'Покупки'
                  : category === 'event'
                  ? 'Событие'
                  : 'Заметка (умный лист)'}
              </span>
            </span>
            {tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="text-[10px] font-mono text-stone-600 dark:text-stone-400 bg-stone-200/70 dark:bg-stone-800 px-1.5 py-0.5 rounded-md shrink-0"
              >
                #{t}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[10px] text-stone-500 font-mono">+{tags.length - 3}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsCardCollapsedManually(false)}
            className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer shrink-0"
            title="Развернуть категории, теги и карточки"
          >
            Развернуть
          </button>
        </div>
      ) : (
        <div className="px-3 sm:px-4 py-2 bg-stone-50/90 dark:bg-stone-900/90 border-b border-amber-900/10 dark:border-stone-800 shrink-0">
          <div className="grid grid-cols-3 gap-1.5" data-no-swipe="true">
          {[
            { id: 'note', label: '📝 Заметка', icon: FileText, activeClass: 'bg-blue-600 text-white', tip: 'Универсальная заметка: расчёты начинаются автоматически' },
            { id: 'shopping', label: '🛒 Покупки', icon: ShoppingCart, activeClass: 'bg-emerald-600 text-white', tip: 'Список товаров с отметками' },
            { id: 'event', label: '📅 Событие', icon: Calendar, activeClass: 'bg-purple-600 text-white', tip: 'Планы, встречи и будильник' },
          ].map((cat) => {
            const Icon = cat.icon;
            const isSelected =
              cat.id === 'note'
                ? category !== 'shopping' && category !== 'event'
                : category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  triggerHaptic();
                  setCategory(cat.id as NoteCategory);
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? `${cat.activeClass} shadow-xs`
                    : 'bg-stone-200/80 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 hover:bg-stone-300/80 dark:hover:bg-stone-700'
                }`}
                title={cat.tip}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{cat.label.replace(/^[^\s]+\s/, '')}</span>
              </button>
            );
          })}
        </div>

        {/* Specific controls if "События" is selected */}
        {category === 'event' && (
          <div className="mt-2 pt-2 border-t border-amber-900/10 dark:border-stone-800 space-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white dark:bg-stone-950 px-2.5 py-1 rounded-xl border border-stone-200 dark:border-stone-800">
                <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="bg-transparent text-stone-900 dark:text-stone-100 text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-white dark:bg-stone-950 px-2.5 py-1 rounded-xl border border-stone-200 dark:border-stone-800">
                <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="bg-transparent text-stone-900 dark:text-stone-100 text-xs focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setIsEventDone(!isEventDone);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  isEventDone
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                    : 'bg-white dark:bg-stone-950 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isEventDone ? 'Завершено' : 'Отметить выполненным'}</span>
              </button>
            </div>

            {/* Event Category selector with vibrant visual color badges */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold mr-1">
                Категория события:
              </span>
              {EVENT_CATEGORIES_LIST.map((cat) => {
                const isActive = (eventCategory || 'meeting') === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setEventCategory(cat.id);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? `${cat.badgeClass} ring-2 ring-purple-500/50 shadow-xs scale-102`
                        : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-800 hover:border-stone-300'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PUSH NOTIFICATIONS / REMINDER CONTROLS (for Event & Shopping notes) */}
        {(category === 'event' || category === 'shopping') && (
          <div className="mt-2.5 pt-2.5 border-t border-amber-900/10 dark:border-stone-800 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    triggerHaptic();
                    if (!reminderEnabled && notifPermission !== 'granted') {
                      const granted = await requestNotificationPermission();
                      setNotifPermission(granted ? 'granted' : 'denied');
                    }
                    setReminderEnabled(!reminderEnabled);
                  }}
                  className={`p-1.5 rounded-xl border transition cursor-pointer ${
                    reminderEnabled
                      ? category === 'event'
                        ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600'
                        : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700'
                  }`}
                  title={reminderEnabled ? 'Выключить напоминание' : 'Включить напоминание'}
                >
                  {reminderEnabled ? (
                    <BellRing className="w-4 h-4 animate-bounce" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                </button>

                <div>
                  <div className="flex items-center gap-1.5 font-bold text-stone-900 dark:text-white">
                    <span>Напоминание (Push-уведомление)</span>
                    {reminderEnabled && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-mono">
                        Активно
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 block">
                    {reminderEnabled
                      ? formatReminderDateTime(reminderDateTime) || 'Время не выбрано'
                      : category === 'event'
                      ? 'Получить пуш перед событием'
                      : 'Напомнить пойти за покупками'}
                  </span>
                </div>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic();
                  if (!reminderEnabled && notifPermission !== 'granted') {
                    const granted = await requestNotificationPermission();
                    setNotifPermission(granted ? 'granted' : 'denied');
                  }
                  setReminderEnabled(!reminderEnabled);
                }}
                className={`w-10 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                  reminderEnabled
                    ? category === 'event'
                      ? 'bg-purple-600'
                      : 'bg-emerald-600'
                    : 'bg-stone-300 dark:bg-stone-700'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-200 ${
                    reminderEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Expanded Reminder Configuration */}
            {reminderEnabled && (
              <div className="mt-2.5 pt-2 border-t border-dashed border-amber-900/15 dark:border-stone-800 space-y-2 animate-in fade-in">
                {/* Datetime picker */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white dark:bg-stone-950 px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 flex-1 min-w-[200px]">
                    <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <input
                      type="datetime-local"
                      value={reminderDateTime}
                      onChange={(e) => setReminderDateTime(e.target.value)}
                      className="bg-transparent text-stone-900 dark:text-stone-100 text-xs focus:outline-none w-full"
                    />
                  </div>

                  {/* System Android or Browser permission button / test alarm */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {notifPermission !== 'granted' ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const granted = await requestNotificationPermission();
                          setNotifPermission(granted ? 'granted' : 'denied');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-[11px] transition shadow-xs cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <Bell className="w-3 h-3" />
                        <span>
                          {isAndroidNativeApp() ? 'Разрешить уведомления Android' : 'Разрешить уведомления'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          await sendTestNotification();
                          setTestNotifSent(true);
                          setTimeout(() => setTestNotifSent(false), 2500);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium text-[11px] transition cursor-pointer flex items-center gap-1 shrink-0"
                        title="Проверить системный будильник и уведомление"
                      >
                        <Volume2 className="w-3 h-3 text-emerald-600" />
                        <span>
                          {testNotifSent
                            ? '✓ Сигнал отправлен!'
                            : isAndroidNativeApp()
                            ? 'Тест будильника Android'
                            : 'Тест звука & пуша'}
                        </span>
                      </button>
                    )}

                    {isAndroidNativeApp() && androidStatus && !androidStatus.batteryOptimizationIgnored && (
                      <button
                        type="button"
                        onClick={() => requestAndroidBatteryExemption()}
                        className="px-2.5 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700 font-bold text-[11px] transition cursor-pointer shrink-0"
                        title="Чтобы будильник звонил даже в спящем режиме и на заблокированном экране"
                      >
                        ⚡ Работа в фоне Android
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Reminder Preset Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5" data-no-swipe="true">
                  <span className="text-[10px] text-stone-600 dark:text-stone-400 uppercase font-bold shrink-0">
                    Быстро:
                  </span>
                  {category === 'event' ? (
                    <>
                      {eventDate && eventTime && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            setReminderDateTime(`${eventDate}T${eventTime}`);
                          }}
                          className="px-2 py-0.8 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] whitespace-nowrap cursor-pointer"
                        >
                          В момент события
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          let base = new Date();
                          if (eventDate && eventTime) {
                            base = new Date(`${eventDate}T${eventTime}`);
                          }
                          const target = new Date(base.getTime() - 15 * 60 * 1000);
                          setReminderDateTime(toDateTimeLocalString(target));
                        }}
                        className="px-2 py-0.8 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 text-[11px] whitespace-nowrap cursor-pointer"
                      >
                        За 15 мин
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          let base = new Date();
                          if (eventDate && eventTime) {
                            base = new Date(`${eventDate}T${eventTime}`);
                          }
                          const target = new Date(base.getTime() - 60 * 60 * 1000);
                          setReminderDateTime(toDateTimeLocalString(target));
                        }}
                        className="px-2 py-0.8 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 text-[11px] whitespace-nowrap cursor-pointer"
                      >
                        За 1 час
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          let base = new Date();
                          if (eventDate && eventTime) {
                            base = new Date(`${eventDate}T${eventTime}`);
                          }
                          const target = new Date(base.getTime() - 24 * 60 * 60 * 1000);
                          setReminderDateTime(toDateTimeLocalString(target));
                        }}
                        className="px-2 py-0.8 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 text-[11px] whitespace-nowrap cursor-pointer"
                      >
                        За 1 день
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          setReminderDateTime(toDateTimeLocalString(new Date(Date.now() + 30 * 60 * 1000)));
                        }}
                        className="px-2 py-0.8 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] whitespace-nowrap cursor-pointer"
                      >
                        +30 мин
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          setReminderDateTime(toDateTimeLocalString(new Date(Date.now() + 60 * 60 * 1000)));
                        }}
                        className="px-2 py-0.8 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] whitespace-nowrap cursor-pointer"
                      >
                        +1 час
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          const d = new Date();
                          d.setHours(19, 0, 0, 0);
                          if (d.getTime() < Date.now()) {
                            d.setDate(d.getDate() + 1);
                          }
                          setReminderDateTime(toDateTimeLocalString(d));
                        }}
                        className="px-2 py-0.8 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 text-[11px] whitespace-nowrap cursor-pointer"
                      >
                        Сегодня 19:00
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          const d = new Date();
                          d.setDate(d.getDate() + 1);
                          d.setHours(10, 0, 0, 0);
                          setReminderDateTime(toDateTimeLocalString(d));
                        }}
                        className="px-2 py-0.8 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 text-[11px] whitespace-nowrap cursor-pointer"
                      >
                        Завтра 10:00
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Note Title Input with Clear High Contrast */}
      <div className={`px-3 sm:px-4 bg-white/80 dark:bg-stone-900/60 border-b border-amber-900/10 dark:border-stone-800 shrink-0 transition-all ${
        shouldLiftCard ? 'py-1 sm:py-1.5' : 'py-2 sm:py-2.5'
      }`}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            category === 'event'
              ? 'Название события или встречи...'
              : category === 'shopping'
              ? 'Список покупок в тетрадке...'
              : 'Заголовок страницы (расчёты идут автоматически)...'
          }
          className={`w-full bg-transparent font-bold text-stone-900 dark:text-white placeholder-stone-500/70 dark:placeholder-stone-400 focus:outline-none font-mono ${
            shouldLiftCard ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
          }`}
        />
      </div>

      {/* AI AUTO-TAGGING & ORGANIZATION BAR */}
      {!shouldLiftCard && (
      <div className="px-4 py-2 bg-stone-50/90 dark:bg-stone-900/50 border-b border-amber-900/10 dark:border-stone-800 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 text-stone-500 dark:text-stone-400 font-semibold text-[11px] mr-0.5">
            <Tag className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Теги:</span>
          </div>

          {/* Existing tags */}
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100/90 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-amber-300/80 dark:border-stone-700 font-mono text-[11px] font-bold"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-100 cursor-pointer p-0.5"
                title="Удалить тег"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}

          {/* Quick Add Custom Tag Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tagInput.trim()) {
                handleAddTag(tagInput);
              }
            }}
            className="inline-flex items-center"
          >
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="+ свой #тег..."
              className="w-24 px-2 py-0.5 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-[11px] font-mono focus:outline-none focus:border-amber-500 focus:w-32 transition-all placeholder-stone-400"
            />
          </form>

          {/* AI Generate Tags Button */}
          <button
            type="button"
            onClick={handleTriggerAiTagging}
            disabled={isLoadingAiTags}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/35 text-amber-900 dark:text-amber-300 border border-amber-400/40 text-[11px] font-bold transition active:scale-95 cursor-pointer disabled:opacity-50 ml-auto"
            title="Автоматически подобрать теги по смыслу заметки с помощью AI"
          >
            <Sparkles
              className={`w-3 h-3 text-amber-600 dark:text-amber-400 ${
                isLoadingAiTags ? 'animate-spin' : ''
              }`}
            />
            <span>{isLoadingAiTags ? 'Анализ AI...' : 'AI авто-теги'}</span>
          </button>
        </div>

        {/* AI Suggestions Row */}
        {suggestedTags.length > 0 && (
          <div className="mt-2 pt-1.5 border-t border-stone-200/60 dark:border-stone-800/60 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 tracking-wider flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-amber-500" />
              <span>{isAiSource ? 'AI предлагает:' : 'Рекомендации:'}</span>
            </span>
            {suggestedTags.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => handleAddTag(sug)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800 font-mono text-[11px] font-bold transition active:scale-95 cursor-pointer"
                title={`Добавить тег ${sug}`}
              >
                <span>+</span>
                <span>{sug}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                suggestedTags.forEach((s) => {
                  if (!tags.includes(s)) {
                    setTags((prev) => [...prev, s]);
                  }
                });
                setSuggestedTags([]);
              }}
              className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline font-bold ml-1 cursor-pointer"
            >
              Добавить все
            </button>
          </div>
        )}
      </div>
      )}

      {/* FINANCIAL BREAKDOWN PANEL: ПРИБЫЛЬ vs РАСХОДЫ vs ОСТАТОК (Показывается автоматически при наличии доходов и расходов) */}
      {autoCalculate && mathSummary.hasIncomeExpenseSplit && (
        shouldLiftCard ? (
          /* COMPACT LIFTED STRIP: Gives maximum vertical space to notebook */
          <div className="mx-2.5 sm:mx-3 mt-1.5 px-3 py-1.5 bg-white/95 dark:bg-stone-900/90 border border-amber-900/15 dark:border-stone-800 rounded-xl shadow-2xs flex items-center justify-between gap-1.5 text-xs shrink-0 transition-all">
            <button
              type="button"
              onClick={() => setIsCardCollapsedManually(false)}
              className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs truncate text-left cursor-pointer hover:opacity-80 flex-1 min-w-0"
              title="Развернуть карточки баланса"
            >
              <Wallet className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-emerald-700 dark:text-emerald-400 font-bold whitespace-nowrap">
                +{formatMoney(mathSummary.totalIncome, mathSummary.currency)}
              </span>
              <span className="text-stone-400 select-none">/</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold whitespace-nowrap">
                −{formatMoney(mathSummary.totalExpenses, mathSummary.currency)}
              </span>
              <span className="text-stone-400 select-none">=</span>
              <span className={`font-extrabold whitespace-nowrap ${
                mathSummary.netBalance >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-400'
              }`}>
                {formatMoney(mathSummary.netBalance, mathSummary.currency)}
              </span>
              {mathSummary.totalIncome > 0 && (
                <span className="text-[10px] text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded-md border border-emerald-200 dark:border-emerald-800/60 ml-0.5 whitespace-nowrap hidden xs:inline">
                  {mathSummary.savingsRatePercent}%
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsCardCollapsedManually(false)}
              className="p-1 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 cursor-pointer shrink-0 flex items-center gap-1 text-[11px] font-semibold transition active:scale-95"
              title="Развернуть карточки баланса"
            >
              <span className="hidden xs:inline">Развернуть</span>
              <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
            </button>
          </div>
        ) : (
          /* FULL 3-BOX FINANCIAL BREAKDOWN CARD */
          <div className="mx-3 sm:mx-4 mt-2 bg-white/95 dark:bg-stone-900/90 border border-amber-900/15 dark:border-stone-800 rounded-2xl p-3 shadow-xs shrink-0 transition-all">
            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-amber-900/10 dark:border-stone-800">
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Баланс: Прибыль минус Расходы</span>
              </span>

              <div className="flex items-center gap-1.5">
                {mathSummary.totalIncome > 0 && (
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                    Норма сбережений: {mathSummary.savingsRatePercent}%
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsCardCollapsedManually(true)}
                  className="flex items-center gap-0.5 px-2 py-0.8 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[11px] font-medium cursor-pointer transition active:scale-95 border border-stone-200 dark:border-stone-700"
                  title="Свернуть карточку вверх для просторного поля ввода"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden xs:inline">Свернуть</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-center">
              {/* Income */}
              <div className="p-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40">
                <span className="text-[10px] text-emerald-800 dark:text-emerald-400 block font-semibold">
                  🟢 Прибыль (доходы)
                </span>
                <span className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-300">
                  +{formatMoney(mathSummary.totalIncome, mathSummary.currency)}
                </span>
              </div>

              {/* Expenses */}
              <div className="p-2 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40">
                <span className="text-[10px] text-rose-800 dark:text-rose-400 block font-semibold">
                  🔴 Расходы (траты)
                </span>
                <span className="text-xs sm:text-sm font-bold text-rose-900 dark:text-rose-300">
                  −{formatMoney(mathSummary.totalExpenses, mathSummary.currency)}
                </span>
              </div>

              {/* Net Remaining Balance */}
              <div className="p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40">
                <span className="text-[10px] text-amber-900 dark:text-amber-300 block font-semibold">
                  💰 Остаток (итог)
                </span>
                <span className={`text-xs sm:text-sm font-extrabold ${
                  mathSummary.netBalance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {formatMoney(mathSummary.netBalance, mathSummary.currency)}
                </span>
              </div>
            </div>
          </div>
        )
      )}

      {/* TEXT FORMATTING TOOLBAR (Bold, Italic, Underline, Color Markers, Cleaner & Preview Mode) */}
      <div
        data-no-swipe="true"
        className="px-3 sm:px-4 py-1.5 bg-stone-50/90 dark:bg-stone-900/90 border-b border-amber-900/10 dark:border-stone-800 flex items-center justify-between gap-1.5 overflow-x-auto scrollbar-none shrink-0 text-xs"
      >
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 mr-1 flex items-center gap-1">
            <Highlighter className="w-3 h-3 text-amber-500" />
            <span className="hidden sm:inline">Стиль:</span>
          </span>

          {/* Bold Button */}
          <button
            type="button"
            onClick={() => wrapSelection('**', '**')}
            className="p-1 sm:px-2 sm:py-1 rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-900 dark:text-white border border-stone-200 dark:border-stone-700 font-bold text-xs transition active:scale-95 cursor-pointer shadow-2xs"
            title="Сделать жирным (**текст**)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* Italic Button */}
          <button
            type="button"
            onClick={() => wrapSelection('*', '*')}
            className="p-1 sm:px-2 sm:py-1 rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-900 dark:text-white border border-stone-200 dark:border-stone-700 font-serif italic text-xs transition active:scale-95 cursor-pointer shadow-2xs"
            title="Сделать курсивом (*текст*)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          {/* Underline Button */}
          <button
            type="button"
            onClick={() => wrapSelection('<u>', '</u>')}
            className="p-1 sm:px-2 sm:py-1 rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-900 dark:text-white border border-stone-200 dark:border-stone-700 underline text-xs transition active:scale-95 cursor-pointer shadow-2xs"
            title="Подчеркнуть текст (<u>текст</u>)"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>

          {/* Clean Color Highlighters (Highlights text without raw HTML code tags) */}
          <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-stone-200 dark:border-stone-700">
            {/* Yellow Marker */}
            <button
              type="button"
              onClick={() => applyColorMarker('yellow')}
              className="w-5 h-5 rounded-full bg-yellow-300 hover:scale-110 active:scale-95 border border-yellow-500/50 transition cursor-pointer shadow-2xs"
              title="Выделить желтым маркером"
            />

            {/* Green Marker */}
            <button
              type="button"
              onClick={() => applyColorMarker('green')}
              className="w-5 h-5 rounded-full bg-emerald-400 hover:scale-110 active:scale-95 border border-emerald-600/50 transition cursor-pointer shadow-2xs"
              title="Выделить зеленым маркером"
            />

            {/* Pink Marker */}
            <button
              type="button"
              onClick={() => applyColorMarker('pink')}
              className="w-5 h-5 rounded-full bg-pink-400 hover:scale-110 active:scale-95 border border-pink-600/50 transition cursor-pointer shadow-2xs"
              title="Выделить розовым маркером"
            />

            {/* Blue Marker */}
            <button
              type="button"
              onClick={() => applyColorMarker('blue')}
              className="w-5 h-5 rounded-full bg-sky-400 hover:scale-110 active:scale-95 border border-sky-600/50 transition cursor-pointer shadow-2xs"
              title="Выделить голубым маркером"
            />

            {/* Orange Marker */}
            <button
              type="button"
              onClick={() => applyColorMarker('orange')}
              className="w-5 h-5 rounded-full bg-orange-400 hover:scale-110 active:scale-95 border border-orange-600/50 transition cursor-pointer shadow-2xs"
              title="Выделить оранжевым маркером"
            />

            {/* Purple Marker */}
            <button
              type="button"
              onClick={() => applyColorMarker('purple')}
              className="w-5 h-5 rounded-full bg-purple-400 hover:scale-110 active:scale-95 border border-purple-600/50 transition cursor-pointer shadow-2xs"
              title="Выделить сиреневым маркером"
            />

            {/* Eraser / Remove Color Marker */}
            <button
              type="button"
              onClick={handleRemoveColorMarker}
              className="p-1 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 transition cursor-pointer shadow-2xs ml-0.5"
              title="Снять выделение цвета с текста"
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>

            {/* Clean HTML code tags button */}
            {hasLegacyHtmlTags && (
              <button
                type="button"
                onClick={handleCleanCodeTags}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 text-[10px] font-bold transition active:scale-95 cursor-pointer shadow-2xs ml-0.5 animate-pulse"
                title="Очистить устаревшие теги разметки (<mark>)"
              >
                <Wand2 className="w-3 h-3 text-amber-700 dark:text-amber-300" />
                <span className="hidden xs:inline">Очистить теги</span>
              </button>
            )}
          </div>

          {/* Font Size Stepper (Управление размером шрифта) */}
          <div className="flex items-center gap-0.5 ml-1 pl-1.5 border-l border-stone-200 dark:border-stone-700">
            <div className="flex items-center bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-1 py-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => handleFontSizeChange(-1)}
                disabled={fontPresetIndex === 0}
                className="px-1 py-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 disabled:opacity-30 cursor-pointer text-xs font-bold transition"
                title="Уменьшить шрифт"
              >
                A-
              </button>
              <span
                className="text-[11px] font-mono font-bold px-1.5 text-amber-700 dark:text-amber-400 select-none whitespace-nowrap cursor-default"
                title={`Размер шрифта: ${currentFont.size}px (${currentFont.label})`}
              >
                {currentFont.size}px
              </span>
              <button
                type="button"
                onClick={() => handleFontSizeChange(1)}
                disabled={fontPresetIndex === FONT_PRESETS.length - 1}
                className="px-1 py-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 disabled:opacity-30 cursor-pointer text-xs font-bold transition"
                title="Увеличить шрифт"
              >
                A+
              </button>
            </div>
          </div>
        </div>

        {/* Right Tools: OCR Scanner, Speech Hub & Mode Switcher */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Hidden Image Inputs for OCR (Camera & File upload) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFileSelected}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageFileSelected}
          />

          {/* OCR Scan Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setShowOcrMenu(!showOcrMenu);
              }}
              disabled={isOcrProcessing}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-xs font-semibold transition active:scale-95 border cursor-pointer shrink-0 ${
                isOcrProcessing
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 animate-pulse'
                  : 'bg-white hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
              }`}
              title="Распознать список дел, покупок или расходов с фото, скриншота или чека"
            >
              {isOcrProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              )}
              <span className="hidden xs:inline">{isOcrProcessing ? 'Скан...' : 'Скан фото'}</span>
            </button>

            {showOcrMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-stone-900 border border-amber-900/15 dark:border-stone-700 rounded-2xl shadow-xl p-1.5 z-30 animate-in fade-in zoom-in-95">
                <div className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 px-2 py-1 tracking-wider">
                  Распознать с изображения
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setShowOcrMenu(false);
                    cameraInputRef.current?.click();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-amber-600" />
                  <span>Сделать фото (камера)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setShowOcrMenu(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>Выбрать скриншот / файл</span>
                </button>
              </div>
            )}
          </div>

          {/* Dedicated Voice Transcription Hub Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setShowVoiceModal(true);
            }}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition active:scale-95 cursor-pointer shrink-0 shadow-2xs"
            title="Открыть расшифровку голосовой заметки с таймкодами и историей речи"
          >
            <FileAudio className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span className="hidden xs:inline">Расшифровка</span>
          </button>

          {/* Voice Dictation Inline Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              if (!isSpeechSupported) {
                setCopiedText('Голосовой ввод не поддерживается');
                setTimeout(() => setCopiedText(null), 2500);
                return;
              }
              toggleListening();
            }}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-xs font-semibold transition active:scale-95 border cursor-pointer shrink-0 ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-600 animate-pulse shadow-xs'
                : 'bg-white hover:bg-rose-50/80 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
            }`}
            title={isListening ? 'Остановить запись голоса' : 'Диктовать заметку голосом'}
          >
            <Mic className={`w-3.5 h-3.5 ${isListening ? 'animate-bounce text-white' : 'text-rose-500'}`} />
            <span>{isListening ? 'Слушаю...' : 'Диктовка'}</span>
          </button>

          {/* Mode Switcher: Edit or Preview */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setIsPreviewMode(!isPreviewMode);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition active:scale-95 border cursor-pointer shrink-0 ${
              isPreviewMode
                ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                : 'bg-white hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
            }`}
            title={isPreviewMode ? 'Переключиться в режим ввода текста' : 'Посмотреть красивое форматирование и маркеры'}
          >
            {isPreviewMode ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{isPreviewMode ? 'Редактировать' : 'Красивый вид'}</span>
          </button>
        </div>
      </div>

      {/* ACTIVE VOICE DICTATION DOCKED BANNER (Web Speech API) */}
      {isListening && (
        <div className="mx-2.5 sm:mx-3 mt-1.5 p-2 sm:p-2.5 rounded-2xl bg-rose-50/95 dark:bg-rose-950/60 border-2 border-rose-400 dark:border-rose-600 shadow-md animate-in fade-in shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-rose-800 dark:text-rose-200">
                  🎙️ Диктовка голосом
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-rose-200/80 dark:bg-rose-900/80 text-rose-900 dark:text-rose-100 font-mono font-bold">
                  REC
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Smart punctuation toggle */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setUseSmartPunctuation(!useSmartPunctuation);
                }}
                className={`text-[10px] px-2 py-0.5 rounded-lg border transition font-medium cursor-pointer ${
                  useSmartPunctuation
                    ? 'bg-rose-100 dark:bg-rose-900/80 border-rose-300 dark:border-rose-600 text-rose-800 dark:text-rose-200'
                    : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500'
                }`}
                title="Автоматически заменять слова 'точка', 'запятая', 'новая строка' на знаки препинания"
              >
                Пунктуация: {useSmartPunctuation ? 'ВКЛ' : 'ВЫКЛ'}
              </button>

              {/* Stop button */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(15);
                  stopListening();
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
                title="Остановить запись голоса"
              >
                <Square className="w-3 h-3 fill-white" />
                <span>Завершить</span>
              </button>
            </div>
          </div>

          {/* Real-time recognized speech preview */}
          <div className="mt-1.5 px-2.5 py-1.5 rounded-xl bg-white/95 dark:bg-stone-900/90 border border-rose-200 dark:border-rose-800/60 text-xs font-mono min-h-[32px] flex items-center">
            {interimTranscript ? (
              <span className="text-stone-900 dark:text-stone-100 italic">
                «{interimTranscript}»
              </span>
            ) : (
              <span className="text-stone-400 dark:text-stone-500">
                Говорите в микрофон, текст печатается прямо в тетрадь...
              </span>
            )}
          </div>

          {/* Quick Voice Punctuation & Snippets Chips */}
          <div className="mt-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5 text-[11px]">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase shrink-0 mr-0.5">
              Вставить:
            </span>
            <button
              type="button"
              onClick={() => insertTextAtCursor('\n')}
              className="px-2 py-0.5 rounded-md bg-white dark:bg-stone-800 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 font-mono cursor-pointer shrink-0"
            >
              ↵ Новая строка
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor(', ')}
              className="px-2 py-0.5 rounded-md bg-white dark:bg-stone-800 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 font-mono cursor-pointer shrink-0"
            >
              , Запятая
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor('. ')}
              className="px-2 py-0.5 rounded-md bg-white dark:bg-stone-800 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 font-mono cursor-pointer shrink-0"
            >
              . Точка
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor('? ')}
              className="px-2 py-0.5 rounded-md bg-white dark:bg-stone-800 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 font-mono cursor-pointer shrink-0"
            >
              ? Вопрос
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor(': ')}
              className="px-2 py-0.5 rounded-md bg-white dark:bg-stone-800 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 font-mono cursor-pointer shrink-0"
            >
              : Двоеточие
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor(' — ')}
              className="px-2 py-0.5 rounded-md bg-white dark:bg-stone-800 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 font-mono cursor-pointer shrink-0"
            >
              — Тире
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor(' руб')}
              className="px-2 py-0.5 rounded-md bg-white dark:bg-stone-800 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 font-mono cursor-pointer shrink-0"
            >
              ₽ руб
            </button>
          </div>
        </div>
      )}

      {/* Voice Error Banner */}
      {speechError && (
        <div className="mx-2.5 sm:mx-3 mt-1.5 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2 shadow-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <MicOff className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{speechError}</span>
          </div>
          <button
            type="button"
            onClick={clearSpeechError}
            className="p-1 rounded-lg hover:bg-amber-200/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Global auto-calculation is now managed centrally via App Settings / Control Panel */}

      {/* НАСТОЯЩИЙ ЛИСТ БУМАГИ С ПОЛЯМИ, ПЕРФОРАЦИЕЙ И СПИРАЛЬЮ */}
      <div className="flex-1 min-h-[380px] sm:min-h-[460px] flex overflow-hidden relative m-2.5 sm:m-3 rounded-2xl border border-amber-900/15 dark:border-stone-700/80 notebook-paper-shadow page-dog-ear">
        {/* Notebook Spiral Left Border (Реалистичные кольца тетради) */}
        <div className="w-3.5 sm:w-4 bg-gradient-to-r from-amber-100 via-amber-200 to-amber-100 dark:from-stone-900 dark:via-stone-800 dark:to-stone-900 border-r border-amber-300/60 dark:border-stone-700/80 flex flex-col justify-around py-3 shrink-0 select-none">
          {[...Array(14)].map((_, i) => (
            <div
              key={i}
              className="w-2 sm:w-2.5 h-1 sm:h-1.5 bg-amber-500/70 dark:bg-stone-400/80 rounded-full mx-auto shadow-inner border border-amber-700/50 dark:border-stone-600"
            />
          ))}
        </div>

        {/* Notebook Sheet Body with selected Paper Style and Red Margins (at 56px) */}
        <div
          style={{ '--notebook-line-height': `${currentFont.lineHeight}px` } as React.CSSProperties}
          className={`flex-1 flex overflow-hidden relative p-0 gap-1 ${paperClass} notebook-margin-red text-stone-900 dark:text-stone-100`}
        >
          {/* Main Textarea aligned on paper lines/grid strictly to the right of red margin (pl-16 = 64px) */}
          <div className="flex-1 h-full relative pl-16 pr-2 sm:pr-3 overflow-hidden">
            {isPreviewMode ? (
              <div
                ref={previewRef}
                onScroll={handlePreviewScroll}
                className="w-full h-full overflow-y-auto font-mono selectable-text text-stone-900 dark:text-stone-100 pt-[14px]"
                style={{
                  lineHeight: `${currentFont.lineHeight}px`,
                  fontSize: `${currentFont.size}px`,
                }}
              >
                {content.split('\n').map((line, idx) => {
                  let html = line
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, '<u class="underline decoration-stone-600 dark:decoration-stone-300 underline-offset-2">$1</u>')
                    .replace(/&lt;mark class="marker-yellow"&gt;(.*?)&lt;\/mark&gt;/gi, '<mark class="marker-yellow">$1</mark>')
                    .replace(/&lt;mark class="marker-green"&gt;(.*?)&lt;\/mark&gt;/gi, '<mark class="marker-green">$1</mark>')
                    .replace(/&lt;mark class="marker-pink"&gt;(.*?)&lt;\/mark&gt;/gi, '<mark class="marker-pink">$1</mark>')
                    .replace(/&lt;mark class="marker-blue"&gt;(.*?)&lt;\/mark&gt;/gi, '<mark class="marker-blue">$1</mark>')
                    .replace(/&lt;mark class="marker-orange"&gt;(.*?)&lt;\/mark&gt;/gi, '<mark class="marker-orange">$1</mark>')
                    .replace(/&lt;mark class="marker-purple"&gt;(.*?)&lt;\/mark&gt;/gi, '<mark class="marker-purple">$1</mark>')
                    .replace(/==yellow:(.*?)==/gi, '<mark class="marker-yellow">$1</mark>')
                    .replace(/==green:(.*?)==/gi, '<mark class="marker-green">$1</mark>')
                    .replace(/==pink:(.*?)==/gi, '<mark class="marker-pink">$1</mark>')
                    .replace(/==blue:(.*?)==/gi, '<mark class="marker-blue">$1</mark>')
                    .replace(/==orange:(.*?)==/gi, '<mark class="marker-orange">$1</mark>')
                    .replace(/==purple:(.*?)==/gi, '<mark class="marker-purple">$1</mark>')
                    .replace(/==(.*?)==/gi, '<mark class="marker-yellow">$1</mark>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-stone-950 dark:text-white">$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
                    .replace(/^- \[ \]/g, '⬜ ')
                    .replace(/^- \[x\]/gi, '✅ ');

                  return (
                    <div
                      key={idx}
                      style={{
                        height: `${currentFont.lineHeight}px`,
                        lineHeight: `${currentFont.lineHeight}px`,
                      }}
                      className="truncate"
                      dangerouslySetInnerHTML={{ __html: html || '&nbsp;' }}
                    />
                  );
                })}
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                onFocus={() => setIsTextareaFocused(true)}
                onBlur={() => setIsTextareaFocused(false)}
                onScroll={handleTextareaScroll}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  category === 'payment'
                    ? `Учет финансов в тетрадке:\n=== Доходы ===\n+ Зарплата: 95 000 руб\n+ Премия: 15 000\n\n=== Расходы ===\n- Аренда: 35 000 руб\n- Продукты: 18 500\n- Коммуналка: 4 500\n\nОстаток в итоге:`
                    : category === 'shopping'
                    ? `Список продуктов в тетрадке:\n- [ ] Молоко 3.2% 2 л\n- [ ] Сыр 400 г\n- [ ] Хлеб 1 шт\n- [ ] Кофе 1 пачка`
                    : category === 'event'
                    ? `План события в тетради:\n14:00 — Встреча с коллегами\nКофе-брейк: 450 * 4\nПодготовить отчет и слайды`
                    : `Заметки в тетрадке и быстрый расчет:\nАренда: 35000 руб\nСвет + вода: 2400 + 1350\nОбед: 450 * 2\nИтого к оплате:`
                }
                style={{
                  lineHeight: `${currentFont.lineHeight}px`,
                  fontSize: `${currentFont.size}px`,
                  paddingTop: '14px',
                }}
                className="w-full h-full bg-transparent resize-none focus:outline-none font-mono selectable-text text-stone-900 dark:text-stone-100 placeholder-stone-500/70 dark:placeholder-stone-400 font-medium overflow-y-auto pb-36"
              />
            )}
          </div>

          {/* Live Math Results Margin (aligned exactly to note text lines with lockstep scroll) */}
          {mathSummary.totalCalculatedLines > 0 && (
            <div
              ref={calcColumnRef}
              onScroll={handleCalcScroll}
              style={{ paddingTop: '14px' }}
              className="w-28 sm:w-36 h-full overflow-y-auto pl-2 border-l border-amber-900/15 dark:border-stone-700/60 flex flex-col font-mono text-xs select-none shrink-0"
            >
              <div className="space-y-0">
                {mathSummary.lines.map((line, idx) => (
                  <div
                    key={idx}
                    style={{
                      height: `${currentFont.lineHeight}px`,
                      lineHeight: `${currentFont.lineHeight}px`,
                    }}
                    className="flex items-center justify-end"
                  >
                    {line.result !== null ? (
                      <button
                        onClick={() => handleCopyResult(line.result!, line.currency)}
                        className={`group/res flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-bold text-xs transition active:scale-95 shadow-2xs cursor-pointer ${
                          line.isTotalLine
                            ? 'bg-amber-100 hover:bg-amber-200 border-amber-400 text-amber-950 dark:bg-amber-600/40 dark:text-amber-200'
                            : line.type === 'income'
                            ? 'bg-emerald-100 hover:bg-emerald-200 border-emerald-400 text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-200'
                            : line.type === 'expense'
                            ? 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-950 dark:bg-rose-950/60 dark:text-rose-200'
                            : 'bg-teal-50 hover:bg-teal-100 border-teal-300 text-teal-950 dark:bg-teal-950/50 dark:text-teal-200'
                        }`}
                        title={
                          line.isTotalLine
                            ? 'Итоговая строка'
                            : line.type === 'income'
                            ? 'Прибыль'
                            : line.type === 'expense'
                            ? 'Расход'
                            : 'Результат расчета'
                        }
                      >
                        <span>
                          {line.isTotalLine
                            ? `= ${formatMoney(line.result, line.currency)}`
                            : line.type === 'income'
                            ? `+${formatMoney(line.result, line.currency)}`
                            : line.type === 'expense'
                            ? `−${formatMoney(line.result, line.currency)}`
                            : `= ${formatMoney(line.result, line.currency)}`}
                        </span>
                        <Copy className="w-2.5 h-2.5 opacity-0 group-hover/res:opacity-100 transition" />
                      </button>
                    ) : (
                      <span className="text-stone-400 dark:text-stone-600 text-[10px] select-none">—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close Unified Scrollable Body */}
      </div>

      {/* Copied toast notification */}
      {copiedText && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-semibold text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{copiedText}</span>
        </div>
      )}

      {/* Voice-to-Action Financial Operation Indicator Banner (QW 2.2 + DS R-AI-02) */}
      {voiceFinanceNotice && (
        <div
          role="status"
          aria-live="polite"
          className="mx-3 sm:mx-4 mb-2 px-3 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/70 flex items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200 shadow-xs shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold truncate">
              Распознано как финансовая операция:{' '}
              <strong className="font-mono">
                {voiceFinanceNotice.direction === 'income' ? '+' : '-'}
                {formatMoney(voiceFinanceNotice.amount, voiceFinanceNotice.currency)}
              </strong>{' '}
              (#auto_voice)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setVoiceFinanceNotice(null)}
            aria-label="Скрыть уведомление голосовой операции"
            className="p-1 rounded-lg text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200/60 dark:hover:bg-emerald-900/60 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* First-use AI Privacy Consent Banner (DS R-AI-04 / A-02) */}
      {showAiConsentPrompt && (
        <div
          role="dialog"
          aria-label="Согласие на отправку заметки в Gemini AI"
          className="mx-3 sm:mx-4 mb-2 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-indigo-950 dark:text-indigo-100 shadow-sm shrink-0"
        >
          <div className="space-y-0.5">
            <div className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Текст заметки отправляется в Gemini для подбора тегов</span>
            </div>
            <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300">
              Вы можете всегда отключить AI полностью в настройках приложения.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowAiConsentPrompt(false);
                void executeAutoTagging(false);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-indigo-200 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200 font-semibold text-[11px] cursor-pointer"
            >
              Только локально
            </button>
            <button
              type="button"
              onClick={() => {
                setAiConsent(true);
                setShowAiConsentPrompt(false);
                void executeAutoTagging(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] cursor-pointer"
            >
              Разрешить Gemini
            </button>
          </div>
        </div>
      )}

      {/* Floating Cashflow / Grand Total Bar (Automatic whenever autoCalculate is ON and numbers/pieces are found) */}
      {autoCalculate && (mathSummary.totalCalculatedLines > 0 || (mathSummary.totalPieces || 0) > 0) && !shouldLiftCard && (
        <div className="mx-3 sm:mx-4 mb-2 bg-white/95 dark:bg-stone-900/95 border border-amber-900/15 dark:border-stone-800 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between shadow-md transition-all shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-400">
              {mathSummary.currency ? <Wallet className="w-4 h-4" /> : <Calculator className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-[11px] text-stone-600 dark:text-stone-400 uppercase font-bold tracking-wide">
                {mathSummary.currency === 'шт.' || (mathSummary.grandTotal === 0 && (mathSummary.totalPieces || 0) > 0)
                  ? 'Итого количество:'
                  : mathSummary.hasIncomeExpenseSplit
                  ? 'Остаток в итоге:'
                  : mathSummary.currency
                  ? 'Итого сумма:'
                  : 'Итого результат:'}
              </span>
              <div className="text-base sm:text-lg font-bold text-stone-900 dark:text-white font-mono leading-none">
                {mathSummary.currency === 'шт.' || (mathSummary.grandTotal === 0 && (mathSummary.totalPieces || 0) > 0)
                  ? `${mathSummary.totalPieces || 0} шт.`
                  : (mathSummary.totalPieces || 0) > 0
                  ? `${formatMoney(mathSummary.grandTotal, mathSummary.currency)} | ${mathSummary.totalPieces} шт.`
                  : formatMoney(mathSummary.grandTotal, mathSummary.currency)}
              </div>
            </div>
          </div>

          <button
            onClick={handleInsertGrandTotal}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-white font-bold text-xs transition active:scale-95 shadow cursor-pointer shrink-0 bg-amber-600 hover:bg-amber-500"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Вставить в тетрадь</span>
          </button>
        </div>
      )}

      {/* Quick Keypad Toolbar: Math + Income/Expense Presets + Pieces + Voice */}
      <div
        data-no-swipe="true"
        className="px-3 py-2 bg-stone-100/90 dark:bg-stone-900 border-t border-amber-900/10 dark:border-stone-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0"
      >
        {/* Inline Voice Dictation */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            if (!isSpeechSupported) {
              setCopiedText('Голосовой ввод не поддерживается');
              setTimeout(() => setCopiedText(null), 2500);
              return;
            }
            toggleListening();
          }}
          className={`px-2.5 py-1.5 rounded-lg font-mono text-xs font-bold whitespace-nowrap active:scale-95 transition border shadow-2xs cursor-pointer flex items-center gap-1 shrink-0 ${
            isListening
              ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
              : 'bg-rose-50 hover:bg-rose-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-stone-700'
          }`}
          title={isListening ? 'Остановить запись голоса' : 'Диктовать заметку голосом'}
        >
          <Mic className={`w-3.5 h-3.5 ${isListening ? 'animate-bounce text-white' : 'text-rose-500'}`} />
          <span>{isListening ? 'Слушаю...' : '🎙️ Диктовка'}</span>
        </button>

        {/* Dedicated Voice Transcription Hub Modal Trigger */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setShowVoiceModal(true);
          }}
          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-mono text-xs font-semibold whitespace-nowrap active:scale-95 transition border border-stone-200 dark:border-stone-700/60 shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
          title="Открыть окно расшифровки речи с таймкодами и историей"
        >
          <FileAudio className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          <span>Расшифровка</span>
        </button>

        {(autoCalculate
          ? [
              { label: '🟢 + Доход', insert: '\n+ Доход: 50 000 руб' },
              { label: '🔴 - Расход', insert: '\n- Трата: 2 500 руб' },
              { label: '₽', insert: ' руб' },
              { label: '+', insert: ' + ' },
              { label: '-', insert: ' - ' },
              { label: '×', insert: ' * ' },
              { label: '÷', insert: ' / ' },
              { label: '%', insert: '%' },
              { label: '📦 шт.', insert: ' шт' },
              { label: '- [ ]', insert: '\n- [ ] ' },
              { label: '• Список', insert: '\n• ' },
              { label: '⏰ Время', insert: ` ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} ` },
            ]
          : [
              { label: '- [ ] Чекбокс', insert: '\n- [ ] ' },
              { label: '• Список', insert: '\n• ' },
              { label: '1. Пункт', insert: '\n1. ' },
              { label: '⏰ Время', insert: ` ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} ` },
              { label: '« Цитата »', insert: '\n> ' },
              { label: '⭐ Важно', insert: ' ⭐ ' },
              { label: '📌 Заметка', insert: ' 📌 ' },
            ]
        ).map((btn, idx) => (
          <button
            key={idx}
            onClick={() => insertTextAtCursor(btn.insert)}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-mono text-xs font-semibold whitespace-nowrap active:scale-95 transition border border-stone-200 dark:border-stone-700/60 shadow-2xs cursor-pointer"
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* DEDICATED VOICE TRANSCRIPTION MODAL ("Расшифровка голосовой заметки") */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div
            data-no-swipe="true"
            className="w-full sm:max-w-xl max-h-[88vh] bg-[#fcfaf7] dark:bg-stone-900 border border-amber-900/20 dark:border-stone-700 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-6"
          >
            {/* Modal Header */}
            <div className="p-4 bg-white/95 dark:bg-stone-950/90 border-b border-amber-900/10 dark:border-stone-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                }`}>
                  <FileAudio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <span>Расшифровка голосовой заметки</span>
                    {isListening && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-rose-500 text-white font-mono font-bold animate-ping">
                        LIVE
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Нативное распознавание речи, таймкоды и автоматическая вставка
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setShowVoiceModal(false);
                }}
                className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sound Wave Visualizer & Live Speech Banner */}
            <div className="p-4 bg-amber-50/50 dark:bg-stone-950/40 border-b border-amber-900/10 dark:border-stone-800 shrink-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isListening ? 'bg-rose-500 animate-ping' : 'bg-stone-400'}`} />
                  <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    {isListening ? 'Идет запись... Говорите' : 'Микрофон на паузе'}
                  </span>
                </div>

                {/* Sound wave bars */}
                <div className="flex items-center gap-1 h-5">
                  {[40, 75, 95, 60, 85, 50, 90, 70].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: isListening ? `${h}%` : '20%' }}
                      className={`w-1 rounded-full transition-all duration-150 ${
                        isListening
                          ? 'bg-rose-500 animate-pulse'
                          : 'bg-stone-300 dark:bg-stone-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Live speech preview */}
              <div className="p-3 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-mono min-h-[48px] flex items-center shadow-inner">
                {interimTranscript ? (
                  <span className="text-rose-600 dark:text-rose-400 font-medium italic">
                    «{interimTranscript}»
                  </span>
                ) : isListening ? (
                  <span className="text-stone-400 dark:text-stone-500 animate-pulse">
                    Слушаю вас... Говорите фразу, список дел или расчет
                  </span>
                ) : (
                  <span className="text-stone-400 dark:text-stone-500">
                    Нажмите кнопку «Начать запись» ниже, чтобы надиктовать текст
                  </span>
                )}
              </div>
            </div>

            {/* Transcribed Text List / History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[160px] max-h-[300px]">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 dark:text-stone-400 pb-1">
                <span>История фраз ({transcriptHistory.length}):</span>
                {transcriptHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setTranscriptHistory([]);
                    }}
                    className="text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Очистить список</span>
                  </button>
                )}
              </div>

              {transcriptHistory.length === 0 ? (
                <div className="text-center py-8 text-stone-400 dark:text-stone-600 text-xs space-y-2">
                  <FileText className="w-8 h-8 mx-auto opacity-40" />
                  <p>Пока нет расшифрованных фраз. Начните говорить!</p>
                </div>
              ) : (
                transcriptHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 flex items-start justify-between gap-2 shadow-2xs group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span className="text-[10px] font-mono text-stone-600 dark:text-stone-400 font-bold">
                          {item.time}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-stone-900 dark:text-stone-100 select-text">
                        {item.text}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          insertTextAtCursor(`\n${item.text}`);
                          setCopiedText('✓ Вставлено в тетрадь');
                          setTimeout(() => setCopiedText(null), 1800);
                        }}
                        className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 cursor-pointer"
                        title="Вставить эту фразу в тетрадь"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          navigator.clipboard?.writeText(item.text);
                          setCopiedText('✓ Скопировано!');
                          setTimeout(() => setCopiedText(null), 1800);
                        }}
                        className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 cursor-pointer"
                        title="Скопировать"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="p-3 bg-white/95 dark:bg-stone-950 border-t border-amber-900/10 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                {/* Toggle Record Button */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    toggleListening();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 shadow cursor-pointer ${
                    isListening
                      ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>{isListening ? '⏹️ Стоп запись' : '🎙️ Начать запись'}</span>
                </button>

                {/* Copy All Transcript Button */}
                {transcriptHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      const fullText = transcriptHistory.map((t) => t.text).join('\n');
                      navigator.clipboard?.writeText(fullText);
                      setCopiedText('✓ Вся расшифровка скопирована!');
                      setTimeout(() => setCopiedText(null), 2000);
                    }}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold cursor-pointer transition active:scale-95"
                    title="Скопировать весь текст расшифровки"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Копировать</span>
                  </button>
                )}
              </div>

              {/* Insert into Note Button */}
              {transcriptHistory.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(15);
                      const fullBlock = `\n\n🎙️ Расшифровка записи (${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}):\n` +
                        transcriptHistory.map((t) => `- ${t.text}`).join('\n');
                      setContent((prev) => prev.trimEnd() + fullBlock);
                      setCopiedText('✓ Расшифровка вставлена блоком в тетрадь!');
                      setTimeout(() => setCopiedText(null), 2500);
                      setShowVoiceModal(false);
                    }}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition active:scale-95 shadow cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Вставить в тетрадь</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Social Media Share Modal */}
      <ShareNoteModal
        note={{
          ...note,
          title,
          content,
          tags,
          cachedTotal: mathSummary.grandTotal,
          currency: mathSummary.currency,
          cachedPieces: mathSummary.totalPieces,
        }}
        isOpen={isSocialShareOpen}
        onClose={() => setIsSocialShareOpen(false)}
      />
    </div>
  );
};
