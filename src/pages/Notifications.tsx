import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCheck, Heart, MessageCircle, UserPlus } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { MediaThumb } from '@/components/MediaThumb'
import { useSocial } from '@/hooks/use-social'
import { api, endpoints, errorMessage } from '@/lib/api'
import type { NotificationItem } from '@/types/social'

const icons = { like: Heart, comment: MessageCircle, follow: UserPlus }
const describe = (item: NotificationItem) => item.type === 'like' ? 'liked your post.' : item.type === 'follow' ? 'started following you.' : `commented: “${item.text}”`

export default function Notifications() {
  const { viewProfile, openPost, following, toggleFollow, refreshCounts, showToast } = useSocial()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const load = useCallback(async (before: string | null) => {
    setLoading(true)
    try {
      const res = await api.get<{ notifications: NotificationItem[]; nextCursor: string | null }>(`${endpoints.notifications}?limit=30${before ? `&before=${encodeURIComponent(before)}` : ''}`)
      setItems(previous => before ? [...previous, ...res.notifications] : res.notifications)
      setNextCursor(res.nextCursor)
    } catch (reason) { showToast(errorMessage(reason)) } finally { setLoading(false) }
  }, [showToast])
  useEffect(() => { load(null) }, [load])

  const open = async (item: NotificationItem) => {
    if (!item.read) {
      setItems(values => values.map(value => value.id === item.id ? { ...value, read: true } : value))
      api.post(`${endpoints.notifications}/${item.id}/read`).then(refreshCounts).catch(() => {})
    }
    if (item.type !== 'follow' && item.post) openPost(item.post.id); else viewProfile(item.user)
  }
  const markAll = async () => {
    try {
      await api.post(`${endpoints.notifications}/read`)
      setItems(values => values.map(value => ({ ...value, read: true }))); refreshCounts()
    } catch (reason) { showToast(errorMessage(reason)) }
  }
  const unread = items.filter(item => !item.read).length
  const visible = filter === 'all' ? items : items.filter(item => !item.read)

  return <div className="notifications-page page-enter"><header className="page-heading"><div><p className="eyebrow">STAY IN THE LOOP</p><h1>Notifications</h1></div></header>
    <div className="notification-toolbar"><div className="segmented"><button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All activity</button><button type="button" className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Unread {unread > 0 && <span>{unread}</span>}</button></div><button type="button" className="text-button with-icon" onClick={markAll} disabled={unread === 0}><CheckCheck size={16} />Mark all read</button></div>
    <section className="notification-list">{visible.length ? visible.map(item => { const Icon = icons[item.type]; return <div key={item.id} className={`notification-item ${!item.read ? 'unread' : ''}`}><button type="button" className="notification-main" onClick={() => open(item)}><span className="notification-avatar"><Avatar user={item.user} size="md" /><i className={`notification-type type-${item.type}`}><Icon size={12} /></i></span><span className="notification-copy"><span><strong>{item.user.username}</strong> {describe(item)}</span><small>{item.time} ago</small></span></button><div className="notification-action">{item.type === 'follow' ? <button type="button" className={`button button-small ${following.has(item.user.username) ? 'button-secondary' : 'button-primary'}`} onClick={() => toggleFollow(item.user.username)}>{following.has(item.user.username) ? 'Following' : 'Follow back'}</button> : item.post ? <button type="button" className="notification-thumb" onClick={() => open(item)}><MediaThumb image={item.post.image} video={item.post.video} alt="Related post" /></button> : null}</div></div> }) : loading ? <div className="viewer-loading"><span className="loading-spinner" /></div> : <div className="empty-state"><span><Bell size={27} /></span><h2>{filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}</h2><p>You’re all caught up. New likes, comments, and followers will appear here.</p>{filter === 'unread' && <button type="button" className="button button-secondary" onClick={() => setFilter('all')}>View all activity</button>}</div>}</section>
    {nextCursor && <button type="button" className="button button-secondary load-more" onClick={() => load(nextCursor)} disabled={loading}>Load older</button>}
  </div>
}
