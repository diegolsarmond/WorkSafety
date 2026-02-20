import CryptoJS from 'crypto-js';

const SECRET_KEY = import.meta.env.VITE_STORAGE_KEY || 'default-secret-key-change-me';

export class SecureStorage {
  private static encrypt(data: string): string {
    return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
  }

  private static decrypt(ciphertext: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
      console.error('Failed to decrypt storage item', e);
      return '';
    }
  }

  static setItem(key: string, value: string, keepSignedIn: boolean = false): void {
    const encryptedValue = this.encrypt(value);
    if (keepSignedIn) {
      localStorage.setItem(key, encryptedValue);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, encryptedValue);
      localStorage.removeItem(key);
    }
  }

  static getItem(key: string): string | null {
    // Check both storages
    const localValue = localStorage.getItem(key);
    const sessionValue = sessionStorage.getItem(key);

    const encryptedValue = localValue || sessionValue;
    if (!encryptedValue) return null;

    return this.decrypt(encryptedValue);
  }

  static removeItem(key: string): void {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  static clear(): void {
    localStorage.clear();
    sessionStorage.clear();
  }
}
