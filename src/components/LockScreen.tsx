import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Shield,
  ShieldAlert,
  Fingerprint,
  Delete,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  DollarSign,
  ShoppingCart,
  Archive,
} from 'lucide-react';
import { verifyPasscode, authenticateWithBiometrics } from '../services/security';
import {
  isAndroidNativeApp,
  isNativeBiometricAvailable,
  authenticateWithNativeBiometrics,
} from '../services/nativeBridge';

interface LockScreenProps {
  category?: 'payment' | 'shopping' | 'archive' | 'general';
  title?: string;
  subtitle?: string;
  biometricEnabled?: boolean;
  credentialId?: string;
  onUnlock: () => void;
  onCancel?: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  category = 'general',
  title,
  subtitle,
  biometricEnabled = false,
  credentialId,
  onUnlock,
  onCancel,
}) => {
  const [pin, setPin] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [biometricError, setBiometricError] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const PIN_LENGTH = 4;

  const triggerHaptic = (pattern: number | number[] = 12) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // Determine category specific styling & labels
  const categoryConfig = {
    payment: {
      name: 'Финансы & Бюджет',
      icon: DollarSign,
      accent: 'amber',
      bgGlow: 'bg-amber-500/10 dark:bg-amber-500/15',
      borderAccent: 'border-amber-500/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    shopping: {
      name: 'Списки покупок',
      icon: ShoppingCart,
      accent: 'emerald',
      bgGlow: 'bg-emerald-500/10 dark:bg-emerald-500/15',
      borderAccent: 'border-emerald-500/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    archive: {
      name: 'Архив данных',
      icon: Archive,
      accent: 'stone',
      bgGlow: 'bg-stone-500/10 dark:bg-stone-500/15',
      borderAccent: 'border-stone-500/30',
      iconColor: 'text-stone-600 dark:text-stone-300',
    },
    general: {
      name: 'Защищенный раздел',
      icon: Shield,
      accent: 'amber',
      bgGlow: 'bg-amber-500/10 dark:bg-amber-500/15',
      borderAccent: 'border-amber-500/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
  }[category];

  const MainCategoryIcon = categoryConfig.icon;

  // Handle entered PIN verification
  const handleVerifyPin = useCallback(
    async (candidatePin: string) => {
      setIsVerifying(true);
      setHasError(false);
      setErrorMessage('');

      try {
        const isValid = await verifyPasscode(candidatePin);
        if (isValid) {
          setIsSuccess(true);
          triggerHaptic([15, 40, 20]);
          setTimeout(() => {
            onUnlock();
          }, 200);
        } else {
          setHasError(true);
          setErrorMessage('Неверный PIN-код');
          triggerHaptic([50, 40, 50]);
          setTimeout(() => {
            setPin('');
            setHasError(false);
          }, 600);
        }
      } catch (e) {
        setHasError(true);
        setErrorMessage('Ошибка проверки PIN-кода');
      } finally {
        setIsVerifying(false);
      }
    },
    [onUnlock]
  );

  // Keypad number press
  const handleDigitPress = (digit: string) => {
    if (isVerifying || isSuccess) return;
    triggerHaptic(10);
    setHasError(false);
    setErrorMessage('');

    if (pin.length < PIN_LENGTH) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === PIN_LENGTH) {
        handleVerifyPin(nextPin);
      }
    }
  };

  // Backspace press
  const handleBackspace = () => {
    if (isVerifying || isSuccess) return;
    triggerHaptic(10);
    setHasError(false);
    setErrorMessage('');
    setPin((prev) => prev.slice(0, -1));
  };

  // Clear all
  const handleClear = () => {
    triggerHaptic(10);
    setPin('');
    setHasError(false);
    setErrorMessage('');
  };

  const canUseBiometrics = biometricEnabled || (isAndroidNativeApp() && isNativeBiometricAvailable());

  // Trigger Biometric authentication (Native Android BiometricPrompt with WebAuthn fallback)
  const handleBiometricAuth = useCallback(async () => {
    if (!canUseBiometrics) return;
    setBiometricError('');
    triggerHaptic(15);

    // 1. Try Native Android BiometricPrompt first if running in native app
    if (isAndroidNativeApp() && isNativeBiometricAvailable()) {
      try {
        const nativeRes = await authenticateWithNativeBiometrics(
          categoryConfig.name,
          'Подтвердите отпечаток пальца или Face ID'
        );
        if (nativeRes.success) {
          setIsSuccess(true);
          triggerHaptic([20, 50, 20]);
          setTimeout(() => {
            onUnlock();
          }, 150);
          return;
        } else if (nativeRes.error) {
          setBiometricError(nativeRes.error);
          triggerHaptic(40);
          return;
        }
      } catch {
        // Fallback to WebAuthn
      }
    }

    // 2. WebAuthn fallback for Web/PWA
    if (biometricEnabled && credentialId) {
      try {
        const res = await authenticateWithBiometrics(credentialId);
        if (res.success) {
          setIsSuccess(true);
          triggerHaptic([20, 50, 20]);
          setTimeout(() => {
            onUnlock();
          }, 150);
        } else if (res.error) {
          setBiometricError(res.error);
          triggerHaptic(40);
        }
      } catch (e: any) {
        setBiometricError('Биометрия недоступна');
      }
    }
  }, [canUseBiometrics, biometricEnabled, credentialId, categoryConfig.name, onUnlock]);

  // Try biometric once on mount if enabled
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (canUseBiometrics) {
      timeout = setTimeout(() => {
        handleBiometricAuth();
      }, 350);
    }
    return () => clearTimeout(timeout);
  }, [canUseBiometrics, handleBiometricAuth]);

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isVerifying, isSuccess, onCancel]);

  return (
    <div className="w-full max-w-sm mx-auto my-6 px-4 py-8 flex flex-col items-center justify-center text-center">
      {/* Visual Lock Badge with domain styling */}
      <div className="relative mb-5">
        <div
          className={`w-20 h-20 rounded-3xl ${categoryConfig.bgGlow} border ${categoryConfig.borderAccent} flex items-center justify-center transition-transform active:scale-95 shadow-sm`}
        >
          {isSuccess ? (
            <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-bounce" />
          ) : hasError ? (
            <ShieldAlert className="w-10 h-10 text-rose-500 animate-pin-shake" />
          ) : (
            <div className="relative">
              <MainCategoryIcon className={`w-10 h-10 ${categoryConfig.iconColor}`} />
              <div className="absolute -bottom-1 -right-1 bg-amber-600 dark:bg-amber-500 text-white rounded-full p-1 shadow-sm">
                <Lock className="w-3 h-3" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title & Subtitle */}
      <h2 className="text-lg sm:text-xl font-extrabold text-stone-900 dark:text-stone-50 tracking-tight">
        {title || categoryConfig.name}
      </h2>
      <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1 max-w-xs leading-relaxed">
        {subtitle || 'Введите PIN-код для доступа к защищенным данным'}
      </p>

      {/* PIN Dots Display */}
      <div
        className={`flex items-center justify-center gap-3.5 my-6 ${
          hasError ? 'animate-pin-shake' : ''
        }`}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, index) => {
          const isFilled = index < pin.length;
          return (
            <div
              key={index}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                isSuccess
                  ? 'bg-emerald-500 scale-110 shadow-sm shadow-emerald-500/50'
                  : hasError
                  ? 'bg-rose-500 scale-110'
                  : isFilled
                  ? 'bg-amber-600 dark:bg-amber-500 scale-110 shadow-xs'
                  : 'bg-stone-300 dark:bg-stone-700'
              }`}
            />
          );
        })}
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2 animate-pin-shake">
          {errorMessage}
        </div>
      )}

      {biometricError && (
        <div className="text-xs text-stone-500 dark:text-stone-400 mb-2">
          {biometricError}
        </div>
      )}

      {/* Numeric Touch Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] mx-auto mt-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleDigitPress(digit)}
            disabled={isVerifying || isSuccess}
            className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 hover:bg-stone-200 active:bg-amber-100 dark:bg-stone-850 dark:bg-stone-800 dark:hover:bg-stone-700 dark:active:bg-amber-950/40 text-stone-900 dark:text-stone-100 text-xl font-bold border border-stone-200/90 dark:border-stone-700/80 transition shadow-2xs active:scale-95 flex items-center justify-center cursor-pointer select-none"
          >
            {digit}
          </button>
        ))}

        {/* Bottom row: Biometrics or Clear */}
        {canUseBiometrics ? (
          <button
            type="button"
            onClick={handleBiometricAuth}
            disabled={isVerifying || isSuccess}
            className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition shadow-2xs active:scale-95 flex flex-col items-center justify-center gap-0.5 cursor-pointer select-none"
            title="Войти по биометрии (Face ID / Отпечаток)"
          >
            <Fingerprint className="w-6 h-6" />
            <span className="text-[9px] font-bold uppercase tracking-tight">Био</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleClear}
            disabled={isVerifying || isSuccess || pin.length === 0}
            className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 hover:bg-stone-200 active:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-500 dark:text-stone-400 text-sm font-semibold border border-stone-200/90 dark:border-stone-700/80 transition active:scale-95 flex items-center justify-center cursor-pointer select-none disabled:opacity-40"
          >
            Сброс
          </button>
        )}

        {/* Digit 0 */}
        <button
          type="button"
          onClick={() => handleDigitPress('0')}
          disabled={isVerifying || isSuccess}
          className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 hover:bg-stone-200 active:bg-amber-100 dark:bg-stone-800 dark:hover:bg-stone-700 dark:active:bg-amber-950/40 text-stone-900 dark:text-stone-100 text-xl font-bold border border-stone-200/90 dark:border-stone-700/80 transition shadow-2xs active:scale-95 flex items-center justify-center cursor-pointer select-none"
        >
          0
        </button>

        {/* Backspace */}
        <button
          type="button"
          onClick={handleBackspace}
          disabled={isVerifying || isSuccess || pin.length === 0}
          className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 hover:bg-stone-200 active:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200/90 dark:border-stone-700/80 transition active:scale-95 flex items-center justify-center cursor-pointer select-none disabled:opacity-40"
          title="Удалить цифру"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>

      {/* Return to notes escape button */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Вернуться к обычным заметкам</span>
        </button>
      )}
    </div>
  );
};
