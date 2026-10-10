export interface BiometricCredential {
  id: string;
  publicKey: string;
  counter: number;
}

// credential.id is base64url (`-`, `_`, no padding); atob only takes standard base64
export function base64UrlToArrayBuffer(id: string): ArrayBuffer {
  const base64 = id.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(id.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}

export class BiometricAuthService {
  private readonly credentialKey = 'app_lock_credential';
  private readonly userIdKey = 'app_lock_user_id';

  /**
   * Check if biometric authentication is supported on this device
   */
  async isSupported(): Promise<boolean> {
    return !!(
      navigator.credentials &&
      window.PublicKeyCredential &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    );
  }

  /**
   * Register biometric authentication for the current user
   */
  async register(userId: string, userName: string): Promise<boolean> {
    try {
      if (!(await this.isSupported())) {
        throw new Error('Biometric authentication not supported');
      }

      // Generate a random challenge
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'Finance Tracker',
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(userId),
            name: userName,
            displayName: userName,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            requireResidentKey: false,
          },
          timeout: 60000,
          attestation: 'none',
        },
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      // Store credential information
      const credentialData: BiometricCredential = {
        id: credential.id,
        publicKey: this.arrayBufferToBase64((credential.response as any).publicKey || new ArrayBuffer(0)),
        counter: 0,
      };

      localStorage.setItem(this.credentialKey, JSON.stringify(credentialData));
      localStorage.setItem(this.userIdKey, userId);
      
      return true;
    } catch (error) {
      console.error('Biometric registration failed:', error);
      return false;
    }
  }

  /**
   * Authenticate using biometric credentials
   */
  async authenticate(): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      if (!(await this.isSupported())) {
        return { success: false, error: 'Biometric authentication not supported on this device' };
      }

      const credentialData = this.getStoredCredential();
      const userId = localStorage.getItem(this.userIdKey);
      
      if (!credentialData || !userId) {
        return { success: false, error: 'No biometric credentials found. Please set up biometric authentication first.' };
      }

      // Generate a random challenge
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [
            {
              id: base64UrlToArrayBuffer(credentialData.id),
              type: 'public-key',
            },
          ],
          userVerification: 'required',
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (!assertion) {
        return { success: false, error: 'Biometric authentication was cancelled or failed' };
      }

      return { success: true, userId };
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      
      let errorMessage = 'Biometric authentication failed';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Biometric authentication was cancelled or not allowed';
        } else if (error.name === 'SecurityError') {
          errorMessage = 'Security error: Please ensure you are using HTTPS';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Biometric authentication not supported';
        } else if (error.name === 'InvalidStateError') {
          errorMessage = 'Invalid biometric credentials. Please re-enable biometric authentication.';
        } else if (error.name === 'TimeoutError') {
          errorMessage = 'Biometric authentication timed out';
        } else {
          errorMessage = error.message || errorMessage;
        }
      }
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if biometric authentication is enabled for the current device
   */
  isEnabled(): boolean {
    // Enrollments from the old Face ID sign-in must never act as a lock
    localStorage.removeItem('biometric_credential');
    localStorage.removeItem('biometric_user_id');
    return !!this.getStoredCredential();
  }

  /**
   * Disable biometric authentication by removing stored credentials
   */
  disable(): void {
    localStorage.removeItem(this.credentialKey);
    localStorage.removeItem(this.userIdKey);
  }

  /**
   * Get stored credential data
   */
  private getStoredCredential(): BiometricCredential | null {
    try {
      const stored = localStorage.getItem(this.credentialKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

export const biometricService = new BiometricAuthService();