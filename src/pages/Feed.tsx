import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ImagePlus, Plus } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { PostCard } from '@/components/PostCard'
import { useSocial } from '@/hooks/use-social'
import { api, endpoints, errorMessage } from '@/lib/api'
import type { Post, User } from '@/types/social'

export default function Feed() {
  const { me, stories, openStory, openCreate, viewProfile, following, toggleFollow, feedVersion } = useSocial()
  const [posts, setPosts] = useState<Post[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [discover, setDiscover] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<User[]>([])
  const sentinel = useRef<HTMLDivElement>(null)
  const busy = useRef(false)

  const fetchPage = useCallback(async (from: string | null) => {
    if (busy.current) return
    busy.current = true; setLoading(true); setError('')
    try {
      const res = await api.get<{ posts: Post[]; nextCursor: string | null; discover: boolean }>(`${endpoints.feed}?limit=10${from ? `&cursor=${from}` : ''}`)
      setPosts(previous => from ? [...previous, ...res.posts.filter(post => !previous.some(item => item.id === post.id))] : res.posts)
      setCursor(res.nextCursor); setDiscover(res.discover)
    } catch (reason) { setError(errorMessage(reason)) } finally { busy.current = false; setLoading(false) }
  }, [])

  useEffect(() => { fetchPage(null) }, [fetchPage, feedVersion])
  useEffect(() => {
    api.get<{ users: User[] }>(`${endpoints.suggestions}?limit=5`).then(res => setSuggestions(res.users)).catch(() => {})
  }, [feedVersion])
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting && cursor) fetchPage(cursor) }, { rootMargin: '300px' })
    if (sentinel.current) observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [cursor, fetchPage])

  // one bubble per person: my own first, then everyone else in the order the server sent them
  const groups = useMemo(() => {
    const map = new Map<string, { user: User; indices: number[]; allSeen: boolean }>()
    stories.forEach((story, index) => {
      const group = map.get(story.user.id) ?? { user: story.user, indices: [], allSeen: true }
      group.indices.push(index); group.allSeen = group.allSeen && story.seen
      map.set(story.user.id, group)
    })
    const entryPoint = (indices: number[]) => indices.find(index => !stories[index].seen) ?? indices[0]
    return [...map.values()].map(group => ({ ...group, start: entryPoint(group.indices) }))
  }, [stories])
  if (!me) return null
  const own = groups.find(group => group.user.id === me.id)
  const others = groups.filter(group => group.user.id !== me.id)

  return <div className="feed-layout page-enter">
    <section className="feed-column" aria-label="Home feed">
      <div className="stories-wrap">
        <div className="stories" role="list" aria-label="Stories">
          <button type="button" className="story-item" onClick={() => own ? openStory(own.start) : openCreate('story')} role="listitem">
            <span className={`story-avatar ${own ? '' : 'own-story'}`}><Avatar user={me} size="lg" />{!own && <span className="story-plus"><Plus size={12} strokeWidth={3} /></span>}</span>
            <span>Your story</span>
          </button>
          {own && <button type="button" className="story-item" onClick={() => openCreate('story')} role="listitem"><span className="story-avatar own-story"><span className="avatar avatar-lg add-story-circle"><Plus size={22} /></span></span><span>Add story</span></button>}
          {others.map(group => <button type="button" className="story-item" key={group.user.id} onClick={() => openStory(group.start)} role="listitem">
            <span className="story-avatar"><Avatar user={group.user} size="lg" /></span>
            <span>{group.user.username.split('.')[0]}</span>
          </button>)}
        </div>
      </div>

      <button type="button" className="quick-create" onClick={() => openCreate('post')}>
        <Avatar user={me} size="sm" /><span>Share a moment, {me.name.split(' ')[0]}…</span><ImagePlus size={21} />
      </button>

      {discover && posts.length > 0 && <div className="notice feed-note"><p>You’re not following anyone yet, so here’s what people are sharing. Follow accounts to build your own feed.</p></div>}
      {error && <div className="form-message error" role="alert">{error} <button type="button" className="text-button" onClick={() => fetchPage(null)}>Try again</button></div>}
      <div className="feed-list">{posts.map(post => <PostCard key={post.id} post={post} onDeleted={id => setPosts(previous => previous.filter(item => item.id !== id))} />)}</div>
      <div ref={sentinel} className="feed-sentinel">{loading ? <><span className="loading-spinner" /><p>Loading moments…</p></> : posts.length === 0 && !error ? <><span className="caught-up-icon"><ImagePlus size={20} /></span><h3>Nothing here yet</h3><p>Share your first moment or follow people to fill your feed.</p><button className="text-button" type="button" onClick={() => openCreate('post')}>Create a post</button></> : !cursor && posts.length > 0 ? <><span className="caught-up-icon"><Check size={20} /></span><h3>You’re all caught up</h3><p>New posts from the people you follow will appear here.</p><button className="text-button" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top</button></> : null}</div>
    </section>

    <aside className="feed-right-rail">
      <div className="current-profile"><Avatar user={me} size="md" onClick={() => viewProfile(me)} /><div><button type="button" onClick={() => viewProfile(me)}>{me.username}</button><span>{me.name}</span></div></div>
      {suggestions.length > 0 && <><div className="rail-section-heading"><h2>Suggested for you</h2></div>
      <div className="suggestions">{suggestions.map(user => <div className="suggestion" key={user.id}><Avatar user={user} size="sm" onClick={() => viewProfile(user)} /><div><button type="button" onClick={() => viewProfile(user)}>{user.username}</button><span>{user.name}</span></div><button type="button" className={`text-button ${following.has(user.username) ? 'muted-button' : ''}`} onClick={() => toggleFollow(user.username)}>{following.has(user.username) ? 'Following' : 'Follow'}</button></div>)}</div></>}
      <footer className="rail-footer"><p>© 2026 LUMA SOCIAL</p></footer>
    </aside>
  </div>
}
