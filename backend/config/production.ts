export default {
  redisCacheExpiresIn: 43200,
  refreshTokenExpiresIn: 43200,
  accessTokenExpiresIn: 120,
  origin: process.env.FRONTEND_URL || 'https://finance.umeh.me',
};