/**
 * Browser storage utilities
 */

export const getStorageItem = (key: string, defaultValue: string = ''): string => {
  if (typeof localStorage === 'undefined') return defaultValue;
  return localStorage.getItem(key) || defaultValue;
};

export const setStorageItem = (key: string, value: string): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
};

export const removeStorageItem = (key: string): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
  }
};

export const getJsonFromStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof localStorage === 'undefined') return defaultValue;
  
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

export const setJsonToStorage = <T>(key: string, value: T): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(value));
  }
};
