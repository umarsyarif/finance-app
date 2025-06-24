export interface StorageOptions {
  persistent?: boolean;
  encrypt?: boolean;
}

export class SecureStorageService {
  private readonly prefix = 'finance_app_';

  /**
   * Store a value with optional persistence and encryption
   */
  setItem(key: string, value: string, options: StorageOptions = {}): void {
    const { persistent = false, encrypt = false } = options;
    const prefixedKey = this.prefix + key;
    
    let processedValue = value;
    if (encrypt) {
      processedValue = this.simpleEncrypt(value);
    }

    if (persistent) {
      localStorage.setItem(prefixedKey + '_persistent', processedValue);
    } else {
      sessionStorage.setItem(prefixedKey, processedValue);
    }
  }

  /**
   * Retrieve a value, checking both session and persistent storage
   */
  getItem(key: string, encrypted = false): string | null {
    const prefixedKey = this.prefix + key;
    
    // Check session storage first
    let value = sessionStorage.getItem(prefixedKey);
    
    // If not found, check persistent storage
    if (!value) {
      value = localStorage.getItem(prefixedKey + '_persistent');
    }

    if (value && encrypted) {
      try {
        return this.simpleDecrypt(value);
      } catch {
        return null;
      }
    }

    return value;
  }

  /**
   * Remove item from both storages
   */
  removeItem(key: string): void {
    const prefixedKey = this.prefix + key;
    sessionStorage.removeItem(prefixedKey);
    localStorage.removeItem(prefixedKey + '_persistent');
  }

  /**
   * Clear all app-related storage
   */
  clear(): void {
    // Clear session storage
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith(this.prefix)) {
        sessionStorage.removeItem(key);
      }
    });

    // Clear persistent storage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Store token with remember me option
   */
  setToken(token: string, rememberMe = false): void {
    this.setItem('access_token', token, { 
      persistent: rememberMe, 
      encrypt: true 
    });
  }

  /**
   * Get stored token
   */
  getToken(): string | null {
    return this.getItem('access_token', true);
  }

  /**
   * Remove stored token
   */
  removeToken(): void {
    this.removeItem('access_token');
  }

  /**
   * Store user preferences
   */
  setUserPreferences(preferences: Record<string, any>): void {
    this.setItem('user_preferences', JSON.stringify(preferences), {
      persistent: true
    });
  }

  /**
   * Get user preferences
   */
  getUserPreferences(): Record<string, any> | null {
    const prefs = this.getItem('user_preferences');
    try {
      return prefs ? JSON.parse(prefs) : null;
    } catch {
      return null;
    }
  }

  /**
   * Simple encryption (for demo purposes - use proper encryption in production)
   */
  private simpleEncrypt(text: string): string {
    try {
      const encoded = btoa(text);
      return encoded.split('').reverse().join('');
    } catch {
      return text;
    }
  }

  /**
   * Simple decryption (for demo purposes - use proper encryption in production)
   */
  private simpleDecrypt(encryptedText: string): string {
    try {
      const reversed = encryptedText.split('').reverse().join('');
      return atob(reversed);
    } catch {
      throw new Error('Decryption failed');
    }
  }

  /**
   * Check if user has enabled "Remember Me"
   */
  hasRememberMe(): boolean {
    return !!localStorage.getItem(this.prefix + 'access_token_persistent');
  }

  /**
   * Set last activity timestamp
   */
  setLastActivity(): void {
    this.setItem('last_activity', Date.now().toString());
  }

  /**
   * Get last activity timestamp
   */
  getLastActivity(): number | null {
    const timestamp = this.getItem('last_activity');
    return timestamp ? parseInt(timestamp, 10) : null;
  }

  /**
   * Check if session should be considered expired based on inactivity
   */
  isSessionExpired(maxInactiveMinutes = 30): boolean {
    const lastActivity = this.getLastActivity();
    if (!lastActivity) return false;

    const now = Date.now();
    const maxInactiveMs = maxInactiveMinutes * 60 * 1000;
    return (now - lastActivity) > maxInactiveMs;
  }
}

export const secureStorage = new SecureStorageService();