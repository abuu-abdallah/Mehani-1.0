/**
 * Safe LocalStorage wrapper.
 * Protects against QuotaExceededError, SecurityError (in private/restricted browsing),
 * and corrupted JSON data, ensuring the app never crashes with a white screen.
 */

export const safeStorage = {
  getItem: <T = string>(key: string, defaultValue: T | null = null): T | null => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return defaultValue;
      }
      const item = window.localStorage.getItem(key);
      if (item === null) return defaultValue;
      return item as unknown as T;
    } catch (e) {
      console.warn(`[safeStorage] Failed to read key "${key}":`, e);
      return defaultValue;
    }
  },

  getJSON: <T>(key: string, defaultValue: T): T => {
    try {
      const raw = safeStorage.getItem(key);
      if (!raw) return defaultValue;
      return JSON.parse(raw) as T;
    } catch (e) {
      console.warn(`[safeStorage] Failed to parse JSON for "${key}":`, e);
      return defaultValue;
    }
  },

  setItem: (key: string, value: string): boolean => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      window.localStorage.setItem(key, value);
      return true;
    } catch (e: any) {
      console.warn(`[safeStorage] Failed to set "${key}":`, e);

      // Handle QuotaExceededError gracefully
      if (
        e?.name === 'QuotaExceededError' ||
        e?.code === 22 ||
        e?.code === 1014 ||
        e?.number === -2147024882
      ) {
        console.warn(`[safeStorage] Storage quota exceeded. Attempting graceful cleanup...`);
        try {
          // If setting users, we can attempt to prune heavy image data from cached users
          if (key === 'mahara_users') {
            try {
              const users = JSON.parse(value);
              if (Array.isArray(users)) {
                // Keep only essential thumbnail placeholders for cached storage
                const pruned = users.map((u: any) => {
                  if (u.nidUrl && u.nidUrl.length > 50000) {
                    return { ...u, nidUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" viewBox="0 0 100 60"><rect width="100" height="60" fill="%230d9488"/><text x="50" y="35" font-size="10" fill="white" text-anchor="middle">NID Verified</text></svg>' };
                  }
                  return u;
                });
                window.localStorage.setItem(key, JSON.stringify(pruned));
                return true;
              }
            } catch {
              // Ignore
            }
          }
        } catch (cleanupErr) {
          console.error('[safeStorage] Cleanup failed:', cleanupErr);
        }
      }
      return false;
    }
  },

  setJSON: <T>(key: string, value: T): boolean => {
    try {
      return safeStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`[safeStorage] Failed to stringify JSON for "${key}":`, e);
      return false;
    }
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[safeStorage] Failed to remove "${key}":`, e);
    }
  },

  clearAllMaharaData: (): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove = [
          'mahara_users',
          'mahara_current_user_id',
          'mahara_session_authenticated',
          'mahara_auth_token',
          'mahara_is_guest',
          'mahara_requests',
          'mahara_deposits',
          'mahara_categories',
          'mahara_service_suggestions',
          'mahara_language',
        ];
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      }
    } catch (e) {
      console.warn('[safeStorage] Failed to clear data:', e);
    }
  },
};
