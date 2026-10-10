export class SecureStorageService {
  private readonly prefix = 'finance_app_';

  setItem(key: string, value: string, persistent = false): void {
    const prefixedKey = this.prefix + key;
    if (persistent) {
      localStorage.setItem(prefixedKey, value);
    } else {
      sessionStorage.setItem(prefixedKey, value);
    }
  }

  getItem(key: string): string | null {
    const prefixedKey = this.prefix + key;
    return sessionStorage.getItem(prefixedKey) ?? localStorage.getItem(prefixedKey);
  }

  removeItem(key: string): void {
    const prefixedKey = this.prefix + key;
    sessionStorage.removeItem(prefixedKey);
    localStorage.removeItem(prefixedKey);
  }

  clear(): void {
    [sessionStorage, localStorage].forEach(store => {
      Object.keys(store).forEach(key => {
        if (key.startsWith(this.prefix)) store.removeItem(key);
      });
    });
  }

  setUserPreferences(preferences: Record<string, any>): void {
    this.setItem('user_preferences', JSON.stringify(preferences), true);
  }

  getUserPreferences(): Record<string, any> | null {
    const prefs = this.getItem('user_preferences');
    try {
      return prefs ? JSON.parse(prefs) : null;
    } catch {
      return null;
    }
  }
}

export const secureStorage = new SecureStorageService();
