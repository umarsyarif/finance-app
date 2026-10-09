import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import axios from '@/lib/axios';

interface OfflineData {
  transactions: any[];
  wallets: any[];
  categories: any[];
  'stats-summary': any;
  'stats-breakdown': any[];
  'stats-trend': any[];
  lastSync: string;
}

interface UseOfflineReturn {
  isOnline: boolean;
  offlineData: OfflineData | null;
  saveOfflineData: (key: keyof OfflineData, data: any) => void;
  getOfflineData: (key: keyof OfflineData) => any;
  clearOfflineData: () => void;
  syncPendingChanges: () => Promise<void>;
}

export interface PendingChange {
  type: 'CREATE_TRANSACTION';
  payload: Record<string, unknown>;
}

const OFFLINE_STORAGE_KEY = 'finance-app-offline-data';
const PENDING_CHANGES_KEY = 'finance-app-pending-changes';

let isSyncing = false;

// Queue a write made while offline; it is replayed by syncPendingChanges when back online
export function queuePendingChange(change: PendingChange) {
  const pending: PendingChange[] = JSON.parse(localStorage.getItem(PENDING_CHANGES_KEY) || '[]');
  pending.push(change);
  localStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify(pending));
}

export function useOffline(): UseOfflineReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState<OfflineData | null>(null);

  const syncRef = useRef<() => Promise<void>>(undefined);

  useEffect(() => {
    syncRef.current = syncPendingChanges;
  });

  useEffect(() => {
    const savedData = localStorage.getItem(OFFLINE_STORAGE_KEY);
    if (savedData) {
      try {
        setOfflineData(JSON.parse(savedData));
      } catch (error) {
        console.error('Failed to parse offline data:', error);
      }
    }

    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online! Syncing data...');
      syncRef.current?.();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.info("You're offline. Changes will be saved locally.");
    };

    if (navigator.onLine) {
      syncRef.current?.();
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveOfflineData = useCallback((key: keyof OfflineData, data: any) => {
    let stored: OfflineData | null = null;
    try {
      stored = JSON.parse(localStorage.getItem(OFFLINE_STORAGE_KEY) || 'null');
    } catch {
      stored = null;
    }
    const currentData = stored || {
      transactions: [],
      wallets: [],
      categories: [],
      'stats-summary': null,
      'stats-breakdown': [],
      'stats-trend': [],
      lastSync: new Date().toISOString()
    };

    const updatedData = {
      ...currentData,
      [key]: data,
      lastSync: new Date().toISOString()
    };

    setOfflineData(updatedData);
    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(updatedData));
  }, []);

  const getOfflineData = useCallback((key: keyof OfflineData) => {
    return offlineData?.[key] || [];
  }, [offlineData]);

  const clearOfflineData = useCallback(() => {
    setOfflineData(null);
    localStorage.removeItem(OFFLINE_STORAGE_KEY);
    localStorage.removeItem(PENDING_CHANGES_KEY);
  }, []);



  const syncPendingChanges = useCallback(async () => {
    // Several components use this hook; only one sync may run at a time
    if (isSyncing) return;
    isSyncing = true;

    try {
      // Take the queue up front so writes queued during the sync are kept
      const pendingChanges: PendingChange[] = JSON.parse(
        localStorage.getItem(PENDING_CHANGES_KEY) || '[]'
      );
      if (pendingChanges.length === 0) return;
      localStorage.removeItem(PENDING_CHANGES_KEY);

      const failed: PendingChange[] = [];
      for (const change of pendingChanges) {
        try {
          if (change.type === 'CREATE_TRANSACTION') {
            await axios.post('/api/transactions', change.payload);
          }
        } catch {
          failed.push(change);
        }
      }

      if (failed.length === 0) {
        toast.success('All changes synced successfully!');
      } else {
        failed.forEach(queuePendingChange);
        toast.error(`Failed to sync ${failed.length} change(s). Will retry later.`);
      }
    } finally {
      isSyncing = false;
    }
  }, []);

  return {
    isOnline,
    offlineData,
    saveOfflineData,
    getOfflineData,
    clearOfflineData,
    syncPendingChanges
  };
}

// Utility function to check if data is stale
export function isDataStale(lastSync: string, maxAgeMinutes: number = 30): boolean {
  const lastSyncTime = new Date(lastSync).getTime();
  const now = new Date().getTime();
  const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
  
  return (now - lastSyncTime) > maxAge;
}

// Utility function to get cache-first data
export function getCacheFirstData<T>(onlineData: T | null, offlineData: T | null, isOnline: boolean): T | null {
  if (isOnline && onlineData) {
    return onlineData;
  }
  return offlineData || onlineData;
}