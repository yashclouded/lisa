// LISA: Measurement History Local Persistence
// Manages versioned local storage with validation, corruption recovery, and size capping

import { MeasurementRecord } from '../types';

export const HISTORY_STORAGE_KEY = 'lisa.history.v1';
export const MAX_HISTORY_RECORDS = 50;

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
}

/**
 * Loads measurement history from localStorage.
 * Gracefully recovers from missing, malformed, or corrupt JSON.
 */
export function loadHistory(): MeasurementRecord[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('Malformed history data in localStorage (not an array). Initializing empty history.');
      return [];
    }

    // Basic schema validation for records
    const validRecords = parsed.filter(
      (r) => r && typeof r === 'object' && typeof r.id === 'string' && typeof r.timestamp === 'string'
    );

    return validRecords.slice(0, MAX_HISTORY_RECORDS);
  } catch (err) {
    console.error('Failed to parse measurement history from localStorage. Recovering gracefully:', err);
    return [];
  }
}

/**
 * Persists measurement history to localStorage.
 * Capped at MAX_HISTORY_RECORDS to prevent storage exhaustion.
 */
export function saveHistory(records: MeasurementRecord[]): boolean {
  const storage = getStorage();
  if (!storage) {
    return false;
  }

  try {
    const capped = records.slice(0, MAX_HISTORY_RECORDS);
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(capped));
    return true;
  } catch (err) {
    console.error('Failed to save measurement history to localStorage:', err);
    return false;
  }
}

/**
 * Clears persisted measurement history from localStorage.
 */
export function clearHistory(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    return true;
  } catch (err) {
    console.error('Failed to clear measurement history from localStorage:', err);
    return false;
  }
}
