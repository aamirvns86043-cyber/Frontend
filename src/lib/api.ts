import { API_CONFIG } from '@/config'

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

let unauthorizedHandler: (() => void) | null = null
/** Called when the server says the session is gone (401 UNAUTHENTICATED), so the app can show the login page. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

export const errorMessage = (reason: unknown) => (reason instanceof Error ? reason.message : 'Something went wrong. Please try again.')

/**
 * Backend adapter. Set VITE_API_BASE_URL to the API origin (no trailing slash).
 * Auth is an httpOnly cookie set by the server, so nothing secret lives in the browser.
 * Errors carry the server's message ({ error, code }) so the UI can show it as-is.
 */
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_CONFIG.baseUrl) throw new Error('Backend is not connected. Set VITE_API_BASE_URL and rebuild the app.')
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(`${API_CONFIG.baseUrl}${path}`, { ...options, headers, credentials: API_CONFIG.credentials })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection.', 0)
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && data?.code === 'UNAUTHENTICATED') unauthorizedHandler?.()
    throw new ApiError(data?.error ?? `Request failed with status ${response.status}`, response.status, data?.code)
  }
  return data as T
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  get: <T,>(path: string) => apiRequest<T>(path),
  post: <T,>(path: string, body?: unknown) => apiRequest<T>(path, json('POST', body)),
  put: <T,>(path: string, body?: unknown) => apiRequest<T>(path, json('PUT', body)),
  patch: <T,>(path: string, body?: unknown) => apiRequest<T>(path, json('PATCH', body)),
  del: <T,>(path: string, body?: unknown) => apiRequest<T>(path, json('DELETE', body)),
  /** Upload a photo/video; returns { id, url, kind }. Send the id in mediaIds when creating a post/story. */
  upload: <T = { id: string; url: string; kind: 'image' | 'video' }>(file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiRequest<T>('/api/media', { method: 'POST', body: form })
  },
}

export const endpoints = {
  session: '/api/auth/session',
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  logoutAll: '/api/auth/logout-all',
  signup: '/api/auth/signup',
  usernameAvailability: '/api/auth/username-availability',
  requestOtp: '/api/auth/otp/request',
  verifyOtp: '/api/auth/otp/verify',
  resetPassword: '/api/auth/password/reset',
  feed: '/api/posts/feed',
  saved: '/api/posts/saved',
  posts: '/api/posts',
  stories: '/api/stories',
  reels: '/api/reels',
  explore: '/api/explore',
  search: '/api/search',
  activity: '/api/activity',
  reports: '/api/reports',
  conversations: '/api/conversations',
  notifications: '/api/notifications',
  suggestions: '/api/users/suggestions',
  users: '/api/users',
  me: '/api/users/me',
}
