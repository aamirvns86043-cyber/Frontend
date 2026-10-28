export const brand = {
  name: 'Luma',
  tagline: 'Keep the moments that move you.',
  accent: '#ff8264',
}

// 👉 Put your Railway backend URL here (no "/" at the end).
//    Find it in Railway: backend service → Settings → Networking → Public Domain.
const RAILWAY_API_URL = 'https://server-production-2461.up.railway.app'

export const API_CONFIG = {
  // VITE_API_BASE_URL (if set on GitHub/locally) wins; otherwise the URL above is used.
  baseUrl: String(import.meta.env.VITE_API_BASE_URL || RAILWAY_API_URL).replace(/\/+$/, ''),
  credentials: 'include' as RequestCredentials,
}
