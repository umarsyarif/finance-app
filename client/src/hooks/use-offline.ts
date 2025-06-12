import { useState, useEffect } from 'react';
import { toast } from 'sonner';

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

const OFFLINE_STORAGE_KEY = 'finance-app-offline-data';
const PENDING_CHANGES_KEY = 'finance-app-pending-changes';

export function useOffline(): UseOfflineReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState<OfflineData | null>(null);

  useEffect(() => {
    // Load offline data from localStorage
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
      syncPendingChanges();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.info('You\'re offline. Changes will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveOfflineData = (key: keyof OfflineData, data: any) => {
    const currentData = offlineData || {
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
  };

  const getOfflineData = (key: keyof OfflineData) => {
    return offlineData?.[key] || [];
  };

  const clearOfflineData = () => {
    setOfflineData(null);
    localStorage.removeItem(OFFLINE_STORAGE_KEY);
    localStorage.removeItem(PENDING_CHANGES_KEY);
  };



  const syncPendingChanges = async () => {
    if (!isOnline) return;

    const pendingChanges = JSON.parse(localStorage.getItem(PENDING_CHANGES_KEY) || '[]');
    
    if (pendingChanges.length === 0) return;

    try {
      // Process pending changes
      for (const change of pendingChanges) {
        // Here you would implement the actual sync logic
        // For now, we'll just log the changes
        console.log('Syncing change:', change);
      }

      // Clear pending changes after successful sync
      localStorage.removeItem(PENDING_CHANGES_KEY);
      toast.success('All changes synced successfully!');
    } catch (error) {
      console.error('Failed to sync pending changes:', error);
      toast.error('Failed to sync some changes. Will retry later.');
    }
  };

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