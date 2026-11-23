import { useState, useEffect, useRef, useCallback } from 'react';
import {
  isNativeSpeechSupported,
  startNativeSpeech,
  stopNativeSpeech,
} from '../services/nativeBridge';

// Web Speech API interface definitions for TypeScript
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    item(index: number): {
      isFinal: boolean;
      length: number;
      item(index: number): {
        transcript: string;
        confidence: number;
      };
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
    [index: number]: {
      isFinal: boolean;
      length: number;
      item(index: number): {
        transcript: string;
        confidence: number;
      };
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEventLike) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/**
 * Formats transcribed Russian speech with voice punctuation commands.
 * Handles words like "точка", "запятая", "новая строка", "восклицательный знак", etc.
 */
export function formatDictatedRussianText(raw: string, applyPunctuation = true): string {
  if (!raw) return '';
  if (!applyPunctuation) return raw;

  let text = raw;

  // Newline commands
  text = text.replace(/(?:\bс\s+новой\s+строки\b|\bновая\s+строка\b|\bперенос\s+строки\b)/gi, '\n');

  // Punctuation commands
  text = text.replace(/(?:\bточка\s+с\s+запятой\b)/gi, '; ');
  text = text.replace(/(?:\bвосклицательный\s+знак\b)/gi, '! ');
  text = text.replace(/(?:\bвопросительный\s+знак\b)/gi, '? ');
  text = text.replace(/(?:\bмноготочие\b)/gi, '... ');
  text = text.replace(/(?:\bдвоеточие\b)/gi, ': ');
  text = text.replace(/(?:\bтире\b)/gi, ' — ');
  text = text.replace(/(?:\bдефис\b)/gi, '-');
  text = text.replace(/(?:\bточка\b)/gi, '. ');
  text = text.replace(/(?:\bзапятая\b)/gi, ', ');

  // Math & finance voice commands
  text = text.replace(/(?:\bзнак\s+плюс\b|\bплюс\b)/gi, ' + ');
  text = text.replace(/(?:\bзнак\s+минус\b|\bминус\b)/gi, ' - ');
  text = text.replace(/(?:\bзнак\s+равно\b|\bравно\b)/gi, ' = ');
  text = text.replace(/(?:\bумножить\s+на\b)/gi, ' * ');
  text = text.replace(/(?:\bразделить\s+на\b)/gi, ' / ');
  text = text.replace(/(?:\bрублей\b|\bрубля\b|\bрубль\b)/gi, ' руб');
  text = text.replace(/(?:\bштук\b|\bштуки\b|\bштука\b)/gi, ' шт');

  // Spacing and capitalization fixes
  text = text.replace(/\s+([.,;:!?])/g, '$1');
  text = text.replace(/\s{2,}/g, ' ');

  return text;
}

export interface UseSpeechDictationOptions {
  onFinalTranscript?: (text: string) => void;
  lang?: string;
  smartPunctuation?: boolean;
}

export function useSpeechDictation({
  onFinalTranscript,
  lang = 'ru-RU',
  smartPunctuation = true,
}: UseSpeechDictationOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isExplicitlyStopped = useRef<boolean>(true);
  const onFinalCallbackRef = useRef(onFinalTranscript);
  const smartPunctuationRef = useRef(smartPunctuation);

  useEffect(() => {
    onFinalCallbackRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    smartPunctuationRef.current = smartPunctuation;
  }, [smartPunctuation]);

  // Check browser or native Android support on mount
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsSupported(false);
      return;
    }
    const hasNative = isNativeSpeechSupported();
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(hasNative || Boolean(SpeechRec));
  }, []);

  const stopListening = useCallback(() => {
    isExplicitlyStopped.current = true;
    if (isNativeSpeechSupported()) {
      stopNativeSpeech();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore if already stopped
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setInterimTranscript('');

    if (typeof window === 'undefined') return;

    // 1. Try Native Android Google SpeechRecognizer first if running inside Android APK
    if (isNativeSpeechSupported()) {
      window.onNativeSpeechResult = (text: string, isFinal: boolean) => {
        const formatted = formatDictatedRussianText(text, smartPunctuationRef.current);
        if (isFinal) {
          setInterimTranscript('');
          if (onFinalCallbackRef.current && formatted.trim()) {
            onFinalCallbackRef.current(formatted);
          }
        } else {
          setInterimTranscript(formatted);
        }
      };

      window.onNativeSpeechError = (errorMsg: string) => {
        setError(errorMsg);
        setIsListening(false);
        setInterimTranscript('');
      };

      window.onNativeSpeechState = (state: string) => {
        if (state === 'start' || state === 'ready') {
          setIsListening(true);
          setError(null);
        } else if (state === 'end') {
          setIsListening(false);
          setInterimTranscript('');
        }
      };

      isExplicitlyStopped.current = false;
      setIsListening(true);
      startNativeSpeech(lang);
      return;
    }

    // 2. Fall back to standard browser Web Speech API
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setError('Распознавание речи не поддерживается в вашем браузере');
      setIsSupported(false);
      return;
    }

    // Stop existing instance if running
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = '';
        let finalized = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalized += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        if (interim) {
          const formattedInterim = formatDictatedRussianText(interim, smartPunctuationRef.current);
          setInterimTranscript(formattedInterim);
        } else {
          setInterimTranscript('');
        }

        if (finalized) {
          const formattedFinal = formatDictatedRussianText(finalized, smartPunctuationRef.current);
          if (onFinalCallbackRef.current && formattedFinal.trim()) {
            onFinalCallbackRef.current(formattedFinal);
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        console.warn('SpeechRecognition error:', event.error, event.message);

        // Friendly error messages in Russian
        switch (event.error) {
          case 'not-allowed':
          case 'service-not-allowed':
            setError('Доступ к микрофону заблокирован. Разрешите микрофон в браузере.');
            isExplicitlyStopped.current = true;
            setIsListening(false);
            break;
          case 'no-speech':
            // Silence detected, no need to abort completely, keep listening unless explicitly stopped
            break;
          case 'audio-capture':
            setError('Микрофон не найден или занят другим приложением.');
            isExplicitlyStopped.current = true;
            setIsListening(false);
            break;
          case 'network':
            setError('Сетевая ошибка распознавания речи Web Speech API.');
            isExplicitlyStopped.current = true;
            setIsListening(false);
            break;
          default:
            setError(`Ошибка голоса: ${event.error}`);
            break;
        }
      };

      recognition.onend = () => {
        setInterimTranscript('');
        // If not explicitly stopped by the user, and not in an error state, automatically restart continuous listening
        if (!isExplicitlyStopped.current) {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      isExplicitlyStopped.current = false;
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (err: unknown) {
      console.error('Failed to initialize SpeechRecognition:', err);
      setError('Не удалось запустить микрофон. Проверьте разрешения браузера.');
      setIsListening(false);
    }
  }, [lang]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isExplicitlyStopped.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  return {
    isListening,
    interimTranscript,
    error,
    clearError: () => setError(null),
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
}
