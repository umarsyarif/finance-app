export default {
  redisCacheExpiresIn: 43200, // 30 days in minutes
  refreshTokenExpiresIn: 43200, // 30 days in minutes
  accessTokenExpiresIn: 120, // 2 hours in minutes
  origin: 'http://localhost:5173',
  // AI capture: empty key disables the capture endpoints (503)
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  // Asset sync secrets (AES-256-GCM key, base64 32 bytes); empty = asset sync disabled
  assetsEncryptionKey: '',
  vapidPublicKey: '',
  vapidPrivateKey: '',
  vapidSubject: '',
};
