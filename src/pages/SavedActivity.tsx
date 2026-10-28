import { useCallback, useEffect, useState } from 'react'
import { Bookmark, Heart, MessageCircle } from 'lucide-react'
import { MediaThumb } from '@/components/MediaThumb'
import { useSocial } from '@/hooks/use-social'
import { api, endpoints, errorMessage } from '@/lib/api'
import type { ActivityItem, Post } from '@/types/social'

export function Saved() {
  const { openPost, showToast } = useSocial()
  const [posts, setPosts] = useState<Post[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async (from: string | null) => {
    setLoading(true)
    try {
      const res = await api.get<{ posts: Post[]; nextCursor: string | null }>(`${endpoints.saved}?limit=18${from ? `&cursor=${from}` : ''}`)
      setPosts(previous => from ? [...previous, ...res.posts] : res.posts); setCursor(res.nextCursor)
    } catch (reason) { showToast(errorMessage(reason)) } finally { setLoading(false) }
  }, [showToast])
  useEffect(() => { load(null) }, [load])
  return <div className="collection-page page-enter"><header className="page-heading"><div><p className="eyebrow">ONLY YOU CAN SEE THIS</p><h1>Saved</h1></div></header>
    {posts.length ? <div className="profile-grid">{posts.map(post => <button type="button" key={post.id} onClick={() => openPost(post.id)}><MediaThumb image={post.image} video={post.video} alt={post.caption || 'Saved post'} /></button>)}</div> : loading ? <div className="viewer-loading"><span className="loading-spinner" /></div> : <div className="empty-state"><span><Bookmark size={28} /></span><h2>Save what inspires you</h2><p>Bookmark posts and they’ll appear here, just for you.</p></div>}
    {cursor && <button type="button" className="button button-secondary load-more" onClick={() => load(cursor)} disabled={loading}>Load more</button>}
  </div>
}

export function Activity() {
  const { openPost, showToast } = useSocial()
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.get<{ items: ActivityItem[] }>(endpoints.activity).then(res => setItems(res.items)).catch(reason => showToast(errorMessage(reason))).finally(() => setLoading(false))
  }, [showToast])
  return <div className="activity-page page-enter"><header className="page-heading"><div><p className="eyebrow">YOUR SPACE, YOUR HISTORY</p><h1>Your activity</h1></div></header>
    <section className="notification-list">{items.length ? items.map(item => <div key={`${item.type}-${item.id}`} className="notification-item"><button type="button" className="notification-main" onClick={() => openPost(item.post.id)}><span className="notification-avatar"><span className="avatar avatar-md activity-icon">{item.type === 'like' ? <Heart size={18} /> : <MessageCircle size={18} />}</span></span><span className="notification-copy"><span>{item.type === 'like' ? 'You liked a post.' : `You commented: “${item.text}”`}</span><small>{item.time} ago</small></span></button><div className="notification-action"><button type="button" className="notification-thumb" onClick={() => openPost(item.post.id)}><MediaThumb image={item.post.image} video={item.post.video} alt="Post" /></button></div></div>) : loading ? <div className="viewer-loading"><span className="loading-spinner" /></div> : <div className="empty-state"><span><Heart size={27} /></span><h2>No activity yet</h2><p>Your recent likes and comments will show up here.</p></div>}</section>
  </div>
}
