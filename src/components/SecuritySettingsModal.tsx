import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Lock,
  Unlock,
  KeyRound,
  Fingerprint,
  Check,
  X,
  AlertCircle,
  Clock,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { SecurityConfig } from '../types';
import {
  setPasscode,
  verifyPasscode,
  removePasscode,
  isBiometricAvailable,
  registerBiometrics,
} from '../services/security';

interface SecuritySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SecurityConfig;
  onUpdateConfig: (newConfig: SecurityConfig) => void;
  onLockNow: () => void;
  isCurrentlyUnlocked: boolean;
}

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onLockNow,
  isCurrentlyUnlocked,
}) => {
  // Mode: 'view' | 'create' | 'change' | 'remove'
  const [mode, setMode] = useState<'view' | 'create' | 'change' | 'remove'>('view');

  // Input fields
  const [currentPinInput, setCurrentPinInput] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [biometricSupported, setBiometricSupported] = useState<boolean>(false);
  const [isProcessingBiometrics, setIsProcessingBiometrics] = useState<boolean>(false);

  // Check biometric support on mount
  useEffect(() => {
    isBiometricAvailable().then((supported) => {
      setBiometricSupported(supported);
    });
  }, []);

  // Reset form when modal opens or mode changes
  useEffect(() => {
    if (isOpen) {
      setMode('view');
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      setErrorMessage('');
      setSuccessMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerHaptic = (pattern: number | number[] = 12) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // Toggle category protection
  const handleToggleCategory = (
    key: 'protectFinance' | 'protectShopping' | 'protectArchive'
  ) => {
    triggerHaptic();
    const updated = {
      ...config,
      [key]: !config[key],
    };
    onUpdateConfig(updated);
  };

  // Change auto-lock delay
  const handleTimeoutChange = (minutes: number) => {
    triggerHaptic();
    const updated = {
      ...config,
      autoLockMinutes: minutes,
    };
    onUpdateConfig(updated);
  };

  // Create new passcode handler
  const handleCreatePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (newPinInput.length !== 4 || !/^\d{4}$/.test(newPinInput)) {
      setErrorMessage('PIN-код должен состоять ровно из 4 цифр');
      triggerHaptic(40);
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setErrorMessage('Введенные PIN-коды не совпадают');
      triggerHaptic(40);
      return;
    }

    try {
      const updated = await setPasscode(newPinInput, config);
      onUpdateConfig(updated);
      setSuccessMessage('Защита успешно включена!');
      triggerHaptic([20, 40, 20]);
      setTimeout(() => {
        setMode('view');
        setNewPinInput('');
        setConfirmPinInput('');
        setSuccessMessage('');
      }, 1000);
    } catch {
      setErrorMessage('Не удалось сохранить PIN-код');
    }
  };

  // Change existing passcode handler
  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const isCurrentValid = await verifyPasscode(currentPinInput, config);
    if (!isCurrentValid) {
      setErrorMessage('Неверный текущий PIN-код');
      triggerHaptic(40);
      return;
    }
    if (newPinInput.length !== 4 || !/^\d{4}$/.test(newPinInput)) {
      setErrorMessage('Новый PIN-код должен состоять из 4 цифр');
      triggerHaptic(40);
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setErrorMessage('Подтверждение нового PIN-кода не совпадает');
      triggerHaptic(40);
      return;
    }

    try {
      const updated = await setPasscode(newPinInput, config);
      onUpdateConfig(updated);
      setSuccessMessage('PIN-код успешно изменен!');
      triggerHaptic([20, 40, 20]);
      setTimeout(() => {
        setMode('view');
        setCurrentPinInput('');
        setNewPinInput('');
        setConfirmPinInput('');
        setSuccessMessage('');
      }, 1000);
    } catch {
      setErrorMessage('Ошибка изменения PIN-кода');
    }
  };

  // Remove passcode handler
  const handleRemovePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const isCurrentValid = await verifyPasscode(currentPinInput, config);
    if (!isCurrentValid) {
      setErrorMessage('Неверный текущий PIN-код');
      triggerHaptic(40);
      return;
    }

    const updated = removePasscode(config);
    onUpdateConfig(updated);
    setSuccessMessage('Защита отключена');
    triggerHaptic(20);
    setTimeout(() => {
      setMode('view');
      setCurrentPinInput('');
      setSuccessMessage('');
    }, 800);
  };

  // Toggle biometric auth
  const handleToggleBiometrics = async () => {
    triggerHaptic();
    setErrorMessage('');

    if (config.biometricEnabled) {
      // Disable biometrics
      const updated: SecurityConfig = {
        ...config,
        biometricEnabled: false,
        credentialId: undefined,
      };
      onUpdateConfig(updated);
      return;
    }

    // Enable biometrics -> register with device
    setIsProcessingBiometrics(true);
    try {
      const result = await registerBiometrics();
      if (result.success && result.credentialId) {
        const updated: SecurityConfig = {
          ...config,
          biometricEnabled: true,
          credentialId: result.credentialId,
        };
        onUpdateConfig(updated);
        triggerHaptic([15, 30, 20]);
      } else {
        setErrorMessage(result.error || 'Не удалось настроить биометрию');
        triggerHaptic(40);
      }
    } catch {
      setErrorMessage('Ошибка настройки биометрии');
    } finally {
      setIsProcessingBiometrics(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#fffdfa] dark:bg-[#1a1715] rounded-3xl border border-amber-900/20 dark:border-stone-800 shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-amber-900/10 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-50 leading-tight">
                Защита данных
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                PIN-код и биометрия для важных категорий
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Status banner */}
          <div
            className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
              config.isPasscodeSet
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200'
            }`}
          >
            {config.isPasscodeSet ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldOff className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <p className="font-bold">
                {config.isPasscodeSet
                  ? 'PIN-код активен'
                  : 'Защита пока не настроена'}
              </p>
              <p className="text-stone-600 dark:text-stone-400 mt-0.5 text-[11px] leading-relaxed">
                {config.isPasscodeSet
                  ? 'Выбранные категории защищены локальным кодом и биометрией.'
                  : 'Задайте 4-значный PIN-код, чтобы скрыть финансы и покупки от посторонних глаз.'}
              </p>
            </div>
          </div>

          {/* Success / Error alerts */}
          {successMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* VIEW MODE: Settings & Toggles */}
          {mode === 'view' && (
            <>
              {/* Passcode Management Buttons */}
              {!config.isPasscodeSet ? (
                <button
                  onClick={() => {
                    triggerHaptic();
                    setMode('create');
                    setErrorMessage('');
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Установить PIN-код (4 цифры)</span>
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      triggerHaptic();
                      setMode('change');
                      setErrorMessage('');
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold border border-stone-200/80 dark:border-stone-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Сменить PIN</span>
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic();
                      setMode('remove');
                      setErrorMessage('');
                    }}
                    className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-900/60 transition cursor-pointer flex items-center justify-center gap-1.5"
                    title="Отключить защиту PIN-кодом"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Отключить</span>
                  </button>
                </div>
              )}

              {/* Protected Categories Section */}
              <div className="pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2.5">
                  Защищаемые разделы
                </h4>
                <div className="space-y-2">
                  {/* Category: Finance */}
                  <label className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 dark:bg-stone-900/70 border border-stone-200/80 dark:border-stone-800 cursor-pointer transition hover:border-amber-500/40">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">💰</span>
                      <div>
                        <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                          Финансы & Бюджет
                        </p>
                        <p className="text-[10px] text-stone-500 dark:text-stone-400">
                          Калькулятор, доходы, расходы и закрытые месяцы
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.protectFinance}
                      onChange={() => handleToggleCategory('protectFinance')}
                      className="w-4 h-4 text-amber-600 rounded-md focus:ring-amber-500"
                    />
                  </label>

                  {/* Category: Shopping */}
                  <label className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 dark:bg-stone-900/70 border border-stone-200/80 dark:border-stone-800 cursor-pointer transition hover:border-emerald-500/40">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🛒</span>
                      <div>
                        <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                          Списки покупок
                        </p>
                        <p className="text-[10px] text-stone-500 dark:text-stone-400">
                          Товары, корзины магазинов и архив покупок
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.protectShopping}
                      onChange={() => handleToggleCategory('protectShopping')}
                      className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500"
                    />
                  </label>

                  {/* Category: Archive */}
                  <label className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 dark:bg-stone-900/70 border border-stone-200/80 dark:border-stone-800 cursor-pointer transition hover:border-stone-500/40">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📦</span>
                      <div>
                        <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                          Архив прошлых данных
                        </p>
                        <p className="text-[10px] text-stone-500 dark:text-stone-400">
                          История закрытых периодов
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.protectArchive}
                      onChange={() => handleToggleCategory('protectArchive')}
                      className="w-4 h-4 text-stone-600 rounded-md focus:ring-stone-500"
                    />
                  </label>
                </div>
              </div>

              {/* Biometrics Toggle */}
              <div className="pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
                  Биометрия
                </h4>
                <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200/80 dark:border-stone-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Fingerprint className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                        Face ID / Отпечаток пальца
                      </p>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400">
                        {biometricSupported
                          ? 'Доступно на этом устройстве'
                          : 'Не поддерживается браузером или устройством'}
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={!config.isPasscodeSet || !biometricSupported || isProcessingBiometrics}
                    onClick={handleToggleBiometrics}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-40 ${
                      config.biometricEnabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {isProcessingBiometrics
                      ? '...'
                      : config.biometricEnabled
                      ? 'Включено'
                      : 'Включить'}
                  </button>
                </div>
              </div>

              {/* Auto-Lock Delay */}
              <div className="pt-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    Автоблокировка
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { val: 0, label: 'Сразу' },
                    { val: 1, label: '1 минута' },
                    { val: 5, label: '5 минут' },
                    { val: 15, label: '15 минут' },
                    { val: -1, label: 'При выходе' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => handleTimeoutChange(item.val)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer ${
                        config.autoLockMinutes === item.val
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200/80 dark:border-stone-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lock Now Action */}
              {config.isPasscodeSet && (
                <div className="pt-3 border-t border-stone-200 dark:border-stone-800">
                  <button
                    onClick={() => {
                      triggerHaptic([20, 20]);
                      onLockNow();
                      onClose();
                    }}
                    className="w-full py-2.5 px-4 rounded-2xl bg-stone-900 hover:bg-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 text-white font-bold text-xs transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Заблокировать сейчас</span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* CREATE PASSCODE FORM */}
          {mode === 'create' && (
            <form onSubmit={handleCreatePasscode} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Придумайте PIN-код (4 цифры)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  autoFocus
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-2 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Повторите PIN-код
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-2 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className="flex-1 py-2 px-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={newPinInput.length !== 4 || confirmPinInput.length !== 4}
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs disabled:opacity-40 shadow-xs"
                >
                  Сохранить
                </button>
              </div>
            </form>
          )}

          {/* CHANGE PASSCODE FORM */}
          {mode === 'change' && (
            <form onSubmit={handleChangePasscode} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Текущий PIN-код
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={currentPinInput}
                  onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  autoFocus
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-2 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Новый PIN-код
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-2 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Повторите новый PIN-код
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-2 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className="flex-1 py-2 px-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={
                    currentPinInput.length !== 4 ||
                    newPinInput.length !== 4 ||
                    confirmPinInput.length !== 4
                  }
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs disabled:opacity-40 shadow-xs"
                >
                  Изменить
                </button>
              </div>
            </form>
          )}

          {/* REMOVE PASSCODE FORM */}
          {mode === 'remove' && (
            <form onSubmit={handleRemovePasscode} className="space-y-4">
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Для отключения защиты введите действующий PIN-код. После отключения
                разделы финансов и покупок будут доступны без ввода кода.
              </p>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Текущий PIN-код
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={currentPinInput}
                  onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  autoFocus
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-2 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className="flex-1 py-2 px-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={currentPinInput.length !== 4}
                  className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs disabled:opacity-40 shadow-xs"
                >
                  Отключить защиту
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
