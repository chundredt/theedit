import type { AppData } from '../domain/types';
import { migrate } from './migrations';

/**
 * Persistence boundary. The app only talks to this interface, so moving to a real
 * backend (e.g. Postgres behind an API with user accounts) means writing an
 * ApiStorageAdapter that implements the same two methods — no page code changes.
 */
export interface StorageAdapter {
  load(): AppData | null;
  save(data: AppData): void;
}

const KEY = 'randwise:data:v1';

export class LocalStorageAdapter implements StorageAdapter {
  private available = true;
  load(): AppData | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? migrate(JSON.parse(raw)) : null;
    } catch {
      this.available = false;
      return null;
    }
  }
  save(data: AppData): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      this.available = false;
      console.warn('Could not save to localStorage', e);
      throw e;
    }
  }
  get isAvailable() {
    return this.available;
  }
}

/** In-memory adapter for tests and for browsers with storage disabled. */
export class MemoryStorageAdapter implements StorageAdapter {
  private data: AppData | null = null;
  load() {
    return this.data ? structuredClone(this.data) : null;
  }
  save(d: AppData) {
    this.data = structuredClone(d);
  }
}
