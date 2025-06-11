import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online! Data will sync automatically.');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.info('You\'re offline. Some features may be limited.');
    };

    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateAvailable(true);
      });
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast.success('App installed successfully!');
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleUpdateClick = () => {
    window.location.reload();
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    setDeferredPrompt(null);
  };

  return (
    <>
      {/* Install Prompt */}
      {showInstallPrompt && (
        <Card className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Download className="h-4 w-4" />
              Install Finance Tracker
            </CardTitle>
            <CardDescription className="text-xs">
              Install our app for a better experience with offline support.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 pt-0">
            <Button onClick={handleInstallClick} size="sm" className="flex-1">
              Install
            </Button>
            <Button onClick={dismissInstallPrompt} variant="outline" size="sm">
              Later
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Update Available Prompt */}
      {updateAvailable && (
        <Card className="fixed top-4 left-4 right-4 z-50 mx-auto max-w-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <RefreshCw className="h-4 w-4" />
              Update Available
            </CardTitle>
            <CardDescription className="text-xs">
              A new version of the app is available.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button onClick={handleUpdateClick} size="sm" className="w-full">
              Update Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed top-4 right-4 z-50">
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="flex items-center gap-2 p-3">
              <WifiOff className="h-4 w-4 text-orange-600" />
              <span className="text-xs text-orange-800">Offline</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Online Indicator (brief) */}
      {isOnline && (
        <div className="fixed top-4 right-4 z-50 opacity-0 animate-pulse">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="flex items-center gap-2 p-3">
              <Wifi className="h-4 w-4 text-green-600" />
              <span className="text-xs text-green-800">Online</span>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}