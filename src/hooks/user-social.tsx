import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, endpoints, errorMessage, setUnauthorizedHandler } from '@/lib/api'
import type { Conversation, Me, ReportTarget, Route, Story } from '@/types/social'

const routes: Route[] = ['home', 'explore', 'reels', 'messages', 'notifications', 'profile', 'settings', 'saved', 'activity', 'auth']

/** Hash looks like  #/home  or  #/home?post=<id>  (the second form is the shareable post link). */
function parseHash(): { route: Route; post: string | null } {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [name, query = ''] = raw.split('?')
  return { route: routes.includes(name as Route) ? (name as Route) : 'home', post: new URLSearchParams(query).get('post') }
}

type SettingsPatch = Record<string, boolean | number | string>

interface SocialContextValue {
  route: Route
  navigate: (route: Route) => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
  me: Me | null
  authReady: boolean
  setSession: (user: Me | null) => void
  logout: () => Promise<void>
  updateSettings: (patch: SettingsPatch) => Promise<void>
  following: Set<string>
  toggleFollow: (username: string) => Promise<void>
  profileUsername: string | null
  viewProfile: (user: { username: string }) => void
  stories: Story[]
  refreshStories: () => Promise<void>
  storyIndex: number | null
  openStory: (index: number) => void
  closeStory: () => void
  createMode: 'post' | 'story' | null
  openCreate: (mode?: 'post' | 'story') => void
  closeCreate: () => void
  reportTarget: ReportTarget | null
  openReport: (target: ReportTarget) => void
  closeReport: () => void
  openPostId: string | null
  openPost: (id: string) => void
  closePost: () => void
  feedVersion: number
  notifyFeedChanged: () => void
  pendingChat: Conversation | null
  openChatWith: (username: string) => Promise<void>
  clearPendingChat: () => void
  unreadMessages: number
  unreadNotifications: number
  refreshCounts: () => Promise<void>
  toast: string
  showToast: (message: string) => void
}

const SocialContext = createContext<SocialContextValue | null>(null)

export function SocialProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parseHash().route)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('luma-theme') === 'dark' ? 'dark' : 'light')
  const [me, setMe] = useState<Me | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [profileUsername, setProfileUsername] = useState<string | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [storyIndex, setStoryIndex] = useState<number | null>(null)
  const [createMode, setCreateMode] = useState<'post' | 'story' | null>(null)
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null)
  const [openPostId, setOpenPostId] = useState<string | null>(() => parseHash().post)
  const [feedVersion, setFeedVersion] = useState(0)
  const [pendingChat, setPendingChat] = useState<Conversation | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [toast, setToast] = useState('')
  const followingRef = useRef(following)
  const meId = me?.id ?? null
  const meUsername = me?.username ?? null

  useEffect(() => { followingRef.current = following }, [following])

  useEffect(() => {
    const onHash = () => setRoute(parseHash().route)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('luma-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const navigate = useCallback((next: Route) => {
    setRoute(next)
    if (window.location.hash !== `#/${next}`) window.location.hash = `/${next}`
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  const showToast = useCallback((message: string) => {
    setToast('')
    window.setTimeout(() => setToast(message), 10)
  }, [])

  /* ---------- session ---------- */
  useEffect(() => {
    let cancelled = false
    api.get<{ user: Me | null }>(endpoints.session)
      .then(res => { if (!cancelled) setMe(res.user) })
      .catch(() => { /* backend offline or not configured: the login page shows the reason on first request */ })
      .finally(() => { if (!cancelled) setAuthReady(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => { setMe(null); setFollowing(new Set()); setStories([]); setRoute('auth') })
    return () => setUnauthorizedHandler(null)
  }, [])

  const setSession = useCallback((user: Me | null) => { setMe(user) }, [])

  const logout = useCallback(async () => {
    try { await api.post(endpoints.logout) } catch { /* cookie is cleared server-side when reachable; clear local state anyway */ }
    setMe(null); setFollowing(new Set()); setStories([]); setProfileUsername(null); setUnreadMessages(0); setUnreadNotifications(0)
    navigate('auth')
  }, [navigate])

  useEffect(() => { if (meId && route === 'auth') navigate('home') }, [meId, route, navigate])

  /* ---------- people I follow ---------- */
  useEffect(() => {
    if (!meId || !meUsername) return
    let cancelled = false
    type Page = { users: { username: string }[]; nextCursor: string | null }
    ;(async () => {
      const names = new Set<string>()
      let cursor: string | null = null
      for (let i = 0; i < 20; i++) {
        const res: Page = await api.get<Page>(`${endpoints.users}/${meUsername}/following?limit=50${cursor ? `&cursor=${cursor}` : ''}`)
        res.users.forEach(user => names.add(user.username))
        cursor = res.nextCursor
        if (!cursor) break
      }
      if (!cancelled) setFollowing(names)
    })().catch(() => {})
    return () => { cancelled = true }
  }, [meId, meUsername])

  const toggleFollow = useCallback(async (username: string) => {
    const already = followingRef.current.has(username)
    try {
      if (already) await api.del(`${endpoints.users}/${encodeURIComponent(username)}/follow`)
      else await api.post(`${endpoints.users}/${encodeURIComponent(username)}/follow`)
      setFollowing(previous => {
        const next = new Set(previous)
        if (already) next.delete(username); else next.add(username)
        return next
      })
    } catch (reason) { showToast(errorMessage(reason)) }
  }, [showToast])

  /* ---------- stories ---------- */
  const refreshStories = useCallback(async () => {
    try {
      const res = await api.get<{ stories: Story[] }>(endpoints.stories)
      setStories(res.stories)
    } catch { /* keep the old strip */ }
  }, [])
  useEffect(() => { if (meId) refreshStories() }, [meId, refreshStories])

  /* ---------- unread badges ---------- */
  const refreshCounts = useCallback(async () => {
    try {
      const [inbox, notes] = await Promise.all([
        api.get<{ unreadTotal: number }>(endpoints.conversations),
        api.get<{ unreadCount: number }>(`${endpoints.notifications}/unread-count`),
      ])
      setUnreadMessages(inbox.unreadTotal); setUnreadNotifications(notes.unreadCount)
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    if (!meId) return
    refreshCounts()
    const timer = window.setInterval(refreshCounts, 30000)
    return () => window.clearInterval(timer)
  }, [meId, route, refreshCounts])

  /* ---------- settings saved on the server (theme, text size, reduce motion, autoplay) ---------- */
  const updateSettings = useCallback(async (patch: SettingsPatch) => {
    setMe(current => current ? { ...current, settings: { ...current.settings, ...patch } } : current)
    try { await api.patch(`${endpoints.me}/settings`, patch) } catch (reason) { showToast(errorMessage(reason)) }
  }, [showToast])

  const settings = me?.settings
  useEffect(() => {
    if (!settings) return
    if (settings.theme === 'dark' || settings.theme === 'light') setTheme(settings.theme)
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion === true)
    document.documentElement.style.fontSize = settings.textSize === 'large' ? '18px' : settings.textSize === 'small' ? '14px' : ''
  }, [settings])

  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    if (meId) updateSettings({ theme: next })
  }, [theme, meId, updateSettings])

  /* ---------- chat shortcut (Profile -> Message) ---------- */
  const openChatWith = useCallback(async (username: string) => {
    try {
      const res = await api.post<{ conversation: Conversation }>(endpoints.conversations, { username })
      setPendingChat(res.conversation)
      navigate('messages')
    } catch (reason) { showToast(errorMessage(reason)) }
  }, [navigate, showToast])

  const viewProfile = useCallback((user: { username: string }) => { setProfileUsername(user.username); navigate('profile') }, [navigate])
  const openStory = useCallback((index: number) => setStoryIndex(index), [])
  const closeStory = useCallback(() => setStoryIndex(null), [])
  const openCreate = useCallback((mode: 'post' | 'story' = 'post') => setCreateMode(mode), [])
  const closeCreate = useCallback(() => setCreateMode(null), [])
  const openReport = useCallback((target: ReportTarget) => setReportTarget(target), [])
  const closeReport = useCallback(() => setReportTarget(null), [])
  const openPost = useCallback((id: string) => setOpenPostId(id), [])
  const closePost = useCallback(() => setOpenPostId(null), [])
  const notifyFeedChanged = useCallback(() => setFeedVersion(value => value + 1), [])
  const clearPendingChat = useCallback(() => setPendingChat(null), [])

  const value = useMemo<SocialContextValue>(() => ({
    route, navigate, theme, toggleTheme, me, authReady, setSession, logout, updateSettings,
    following, toggleFollow, profileUsername, viewProfile,
    stories, refreshStories, storyIndex, openStory, closeStory,
    createMode, openCreate, closeCreate, reportTarget, openReport, closeReport,
    openPostId, openPost, closePost, feedVersion, notifyFeedChanged,
    pendingChat, openChatWith, clearPendingChat,
    unreadMessages, unreadNotifications, refreshCounts, toast, showToast,
  }), [route, navigate, theme, toggleTheme, me, authReady, setSession, logout, updateSettings, following, toggleFollow, profileUsername, viewProfile,
    stories, refreshStories, storyIndex, openStory, closeStory, createMode, openCreate, closeCreate, reportTarget, openReport, closeReport,
    openPostId, openPost, closePost, feedVersion, notifyFeedChanged, pendingChat, openChatWith, clearPendingChat,
    unreadMessages, unreadNotifications, refreshCounts, toast, showToast])

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}

export function useSocial() {
  const context = useContext(SocialContext)
  if (!context) throw new Error('useSocial must be used within SocialProvider')
  return context
}
