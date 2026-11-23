/**
 * Security & Local Passcode / Biometric Protection Service
 * Provides cryptographic passcode hashing, WebAuthn biometric authentication,
 * and auto-lock state handling for sensitive categories (Finance and Shopping).
 */

import { SecurityConfig } from '../types';

export const SECURITY_CONFIG_KEY = 'notebook_smart_security_config_v1';
export const LAST_UNLOCKED_KEY = 'notebook_smart_last_unlocked_ts';

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  isPasscodeSet: false,
  protectFinance: true,
  protectShopping: true,
  protectArchive: false,
  biometricEnabled: false,
  autoLockMinutes: 5,
};

/**
 * Loads current security configuration from localStorage
 */
export function loadSecurityConfig(): SecurityConfig {
  try {
    const raw = localStorage.getItem(SECURITY_CONFIG_KEY);
    if (!raw) return DEFAULT_SECURITY_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SECURITY_CONFIG,
      ...parsed,
    };
  } catch (e) {
    console.error('Failed to load security config', e);
    return DEFAULT_SECURITY_CONFIG;
  }
}

/**
 * Saves security configuration to localStorage
 */
export function saveSecurityConfig(config: SecurityConfig): void {
  try {
    localStorage.setItem(SECURITY_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save security config', e);
  }
}

/**
 * Helper to generate random salt
 */
function generateSalt(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Cryptographic SHA-256 hash using Web Crypto API
 */
export async function hashPasscode(passcode: string, salt: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(`${salt}:${passcode}`);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('SubtleCrypto error, falling back', e);
    }
  }
  // Fallback hash implementation if SubtleCrypto is unavailable
  let hash = 0;
  const str = `${salt}:${passcode}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Set a new passcode
 */
export async function setPasscode(
  pin: string,
  currentConfig?: SecurityConfig
): Promise<SecurityConfig> {
  const config = currentConfig || loadSecurityConfig();
  const salt = generateSalt();
  const hash = await hashPasscode(pin, salt);

  const updated: SecurityConfig = {
    ...config,
    isPasscodeSet: true,
    passcodeHash: hash,
    passcodeSalt: salt,
  };

  saveSecurityConfig(updated);
  return updated;
}

/**
 * Verify entered passcode against saved hash
 */
export async function verifyPasscode(
  pin: string,
  config?: SecurityConfig
): Promise<boolean> {
  const current = config || loadSecurityConfig();
  if (!current.isPasscodeSet || !current.passcodeHash || !current.passcodeSalt) {
    return false;
  }
  const testHash = await hashPasscode(pin, current.passcodeSalt);
  return testHash === current.passcodeHash;
}

/**
 * Remove passcode and disable sensitive category lock
 */
export function removePasscode(currentConfig?: SecurityConfig): SecurityConfig {
  const config = currentConfig || loadSecurityConfig();
  const updated: SecurityConfig = {
    ...config,
    isPasscodeSet: false,
    passcodeHash: undefined,
    passcodeSalt: undefined,
    biometricEnabled: false,
    credentialId: undefined,
  };
  saveSecurityConfig(updated);
  return updated;
}

/**
 * Checks if biometric authentication (WebAuthn Platform Authenticator)
 * like Touch ID, Face ID, Windows Hello, or Android Fingerprint is available
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Registers biometric authentication credential with WebAuthn
 */
export async function registerBiometrics(): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  if (typeof window === 'undefined' || !navigator.credentials) {
    return { success: false, error: 'WebAuthn не поддерживается данным устройством' };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'NotebookSmart Security',
        id: window.location.hostname || 'localhost',
      },
      user: {
        id: userId,
        name: 'user@notebooksmart.local',
        displayName: 'Пользователь NotebookSmart',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: 'Не удалось создать биометрический ключ' };
    }

    // Convert credential.rawId to base64
    const rawId = new Uint8Array(credential.rawId);
    let binary = '';
    for (let i = 0; i < rawId.byteLength; i++) {
      binary += String.fromCharCode(rawId[i]);
    }
    const credIdBase64 = btoa(binary);

    return { success: true, credentialId: credIdBase64 };
  } catch (err: any) {
    console.warn('Biometric registration failed or cancelled', err);
    return {
      success: false,
      error: err?.message?.includes('cancel')
        ? 'Регистрация отменена пользователем'
        : 'Биометрия не настроена или отклонена устройством',
    };
  }
}

/**
 * Authenticates using biometric WebAuthn
 */
export async function authenticateWithBiometrics(
  savedCredentialId?: string
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !navigator.credentials) {
    return { success: false, error: 'WebAuthn не поддерживается' };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const allowCredentials: PublicKeyCredentialDescriptor[] = [];
    if (savedCredentialId) {
      try {
        const binStr = atob(savedCredentialId);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        allowCredentials.push({
          id: bytes.buffer,
          type: 'public-key',
          transports: ['internal'],
        });
      } catch {
        // If base64 decoding fails, proceed without allowCredentials filter
      }
    }

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: 'required',
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      rpId: window.location.hostname || 'localhost',
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    });

    if (assertion) {
      return { success: true };
    }
    return { success: false, error: 'Биометрическая проверка не пройдена' };
  } catch (err: any) {
    console.warn('Biometric authentication failed or cancelled', err);
    return {
      success: false,
      error: err?.name === 'NotAllowedError'
        ? 'Биометрическая проверка отменена'
        : 'Ошибка биометрии',
    };
  }
}

/**
 * Checks whether an auto-lock should occur based on timeout
 */
export function isAutoLockExpired(
  lastUnlockedTimestamp: number,
  timeoutMinutes: number
): boolean {
  if (!lastUnlockedTimestamp) return true;
  // If timeoutMinutes is -1, it means lock only when session ends (reload/close), so within session it never expires
  if (timeoutMinutes === -1) return false;
  // If timeoutMinutes is 0, it means lock immediately on tab/window blur or switch
  if (timeoutMinutes === 0) return true;

  const elapsedMs = Date.now() - lastUnlockedTimestamp;
  const timeoutMs = timeoutMinutes * 60 * 1000;
  return elapsedMs >= timeoutMs;
}
