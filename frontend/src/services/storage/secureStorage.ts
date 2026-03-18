import CryptoJS from 'crypto-js';

const SECRET_KEY = import.meta.env.VITE_STORAGE_KEY || 'default-secret-key-change-me';

export class SecureStorage {
  private static encrypt(data: string): string {
    return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
  }

  private static decrypt(ciphertext: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      // Check if decryption resulted in empty string (corrupted data)
      if (!decrypted) {
        console.warn('[SecureStorage] Decryption resulted in empty string - token may be corrupted');
        return '';
      }
      
      return decrypted;
    } catch (e) {
      console.warn('[SecureStorage] Failed to decrypt storage item:', e);
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
    console.log(`[SecureStorage] Stored ${key} (keepSignedIn: ${keepSignedIn})`);
  }

  static getItem(key: string): string | null {
    // Check both storages
    const localValue = localStorage.getItem(key);
    const sessionValue = sessionStorage.getItem(key);

    const encryptedValue = localValue || sessionValue;
    if (!encryptedValue) {
      console.log(`[SecureStorage] Key "${key}" not found in storage`);
      return null;
    }

    const decrypted = this.decrypt(encryptedValue);
    
    // If decryption failed or returned empty, clear the corrupted data
    if (!decrypted) {
      console.warn(`[SecureStorage] Failed to decrypt "${key}" - clearing corrupted data`);
      this.removeItem(key);
      return null;
    }

    return decrypted;
  }

  static removeItem(key: string): void {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    console.log(`[SecureStorage] Removed ${key}`);
  }

  static clear(): void {
    localStorage.clear();
    sessionStorage.clear();
    console.log('[SecureStorage] Cleared all storage');
  }
}
