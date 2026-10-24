import { Preferences } from '@capacitor/preferences';

// In-memory cache for synchronous access, seeded from localStorage
const memoryCache = new Map();

// Initialize memory cache from localStorage if available
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('vrijcheck_')) {
        memoryCache.set(key, window.localStorage.getItem(key));
      }
    }
  }
} catch (e) {
  console.warn('[STORAGE] Could not read initial localStorage:', e);
}

export const appStorage = {
  /**
   * Hydrates memory cache and localStorage from native Capacitor Preferences.
   * Native Preferences use Android SharedPreferences / iOS UserDefaults, which
   * are 100% durable and persist even when the user force-closes the app.
   */
  async init() {
    try {
      const { keys } = await Preferences.keys();
      for (const key of keys) {
        if (key.startsWith('vrijcheck_')) {
          const { value } = await Preferences.get({ key });
          if (value !== null && value !== undefined) {
            memoryCache.set(key, value);
            try {
              window.localStorage.setItem(key, value);
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      console.warn('[STORAGE] Native preferences hydration error:', err);
    }
  },

  /**
   * Synchronous getter from fast memory cache or localStorage
   */
  getItem(key) {
    if (memoryCache.has(key)) {
      return memoryCache.get(key);
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) {
          memoryCache.set(key, val);
          return val;
        }
      }
    } catch (_) {}
    return null;
  },

  /**
   * Setter that synchronously updates cache + localStorage and asynchronously
   * flushes to native persistent storage.
   */
  setItem(key, value) {
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    memoryCache.set(key, strVal);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, strVal);
      }
    } catch (_) {}

    // Flush to native storage asynchronously but immediately
    Preferences.set({ key, value: strVal }).catch((err) => {
      console.warn(`[STORAGE] Error writing ${key} to native preferences:`, err);
    });
  },

  removeItem(key) {
    memoryCache.delete(key);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (_) {}
    Preferences.remove({ key }).catch(() => {});
  }
};
