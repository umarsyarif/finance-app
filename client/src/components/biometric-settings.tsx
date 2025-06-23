import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Fingerprint, Shield, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { toast } from 'sonner';

export function BiometricSettings() {
  const { 
    biometricEnabled, 
    biometricSupported, 
    enableBiometric, 
    disableBiometric,
    biometricLogin 
  } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [testingBiometric, setTestingBiometric] = useState(false);

  const handleToggleBiometric = async (enabled: boolean) => {
    if (enabled) {
      setIsLoading(true);
      try {
        const success = await enableBiometric();
        if (success) {
          toast.success('Biometric authentication enabled successfully!');
        } else {
          toast.error('Failed to enable biometric authentication. Please try again.');
        }
      } catch (error) {
        toast.error('An error occurred while enabling biometric authentication.');
      } finally {
        setIsLoading(false);
      }
    } else {
      disableBiometric();
      toast.success('Biometric authentication disabled.');
    }
  };

  const handleTestBiometric = async () => {
    if (!biometricEnabled) return;
    
    setTestingBiometric(true);
    try {
      const success = await biometricLogin();
      if (success) {
        toast.success('Biometric authentication test successful!');
      } else {
        toast.error('Biometric authentication test failed.');
      }
    } catch (error) {
      toast.error('An error occurred during biometric test.');
    } finally {
      setTestingBiometric(false);
    }
  };

  if (!biometricSupported) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            <CardTitle>Biometric Authentication</CardTitle>
            <Badge variant="secondary">Not Supported</Badge>
          </div>
          <CardDescription>
            Biometric authentication is not supported on this device or browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>
              To use biometric authentication, you need a device with Face ID, Touch ID, or fingerprint sensor,
              and a compatible browser.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          <CardTitle>Biometric Authentication</CardTitle>
          {biometricEnabled ? (
            <Badge variant="default" className="bg-green-500">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Enabled
            </Badge>
          ) : (
            <Badge variant="outline">
              <Shield className="h-3 w-3 mr-1" />
              Disabled
            </Badge>
          )}
        </div>
        <CardDescription>
          Use Face ID, Touch ID, or fingerprint to quickly and securely access your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">Enable biometric login</p>
            <p className="text-xs text-muted-foreground">
              Quick access without entering your password
            </p>
          </div>
          <Switch 
            checked={biometricEnabled}
            onCheckedChange={(checked: boolean) => handleToggleBiometric(checked)}
            disabled={isLoading}
          />
        </div>
        
        {biometricEnabled && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Test biometric authentication</p>
                <p className="text-xs text-muted-foreground">
                  Verify that your biometric authentication is working correctly
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleTestBiometric}
                disabled={testingBiometric}
              >
                {testingBiometric ? 'Testing...' : 'Test'}
              </Button>
            </div>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Biometric data is stored securely on your device</p>
          <p>• We never have access to your biometric information</p>
          <p>• You can disable this feature at any time</p>
        </div>
      </CardContent>
    </Card>
  );
}