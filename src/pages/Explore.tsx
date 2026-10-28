import { useEffect, useState } from 'react'
import { Check, Clapperboard, Compass, Hash, Heart, MessageCircle, Search, UserRound, X } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { MediaThumb } from '@/components/MediaThumb'
import { useSocial } from '@/hooks/use-social'
import { api, endpoints, errorMessage } from '@/lib/api'
import type { GridItem, Reel, User } from '@/types/social'

const categories = ['For you', 'Accounts', 'Reels', 'Tags'] as const
const HISTORY_KEY = 'luma-search-history'
const readHistory = (): string[] => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] } }

export default function Explore() {
  const { viewProfile, following, toggleFollow, openPost, showToast } = useSocial()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [category, setCategory] = useState<typeof categories[number]>('For you')
  const [history, setHistory] = useState<string[]>(readHistory)
  const [grid, setGrid] = useState<GridItem[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [found, setFound] = useState<GridItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { const timer = window.setTimeout(() => setDebounced(query.trim()), 350); return () => window.clearTimeout(timer) }, [query])
  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)) }, [history])

  useEffect(() => {
    let cancelled = false
    const fail = (reason: unknown) => { if (!cancelled) showToast(errorMessage(reason)) }
    setLoading(true)
    const finish = () => { if (!cancelled) setLoading(false) }
    if (category === 'Reels') {
      api.get<{ reels: Reel[] }>(`${endpoints.reels}?limit=18`)
        .then(res => { if (!cancelled) { setGrid(res.reels.map(reel => ({ id: reel.id, type: 'video' as const, image: reel.poster, video: reel.video, likes: reel.likes, commentsCount: reel.comments }))); setHasMore(false); setPage(1) } })
        .catch(fail).finally(finish)
    } else if (!debounced) {
      if (category === 'Accounts') {
        api.get<{ users: User[] }>(`${endpoints.suggestions}?limit=15`).then(res => { if (!cancelled) setUsers(res.users) }).catch(fail).finally(finish)
      } else if (category === 'For you') {
        api.get<{ items: GridItem[]; hasMore: boolean }>(`${endpoints.explore}?page=1&limit=24`)
          .then(res => { if (!cancelled) { setGrid(res.items); setHasMore(res.hasMore); setPage(1) } }).catch(fail).finally(finish)
      } else { setLoading(false) }
    } else {
      const q = category === 'Tags' ? `#${debounced.replace(/^#/, '')}` : debounced
      api.get<{ users: User[]; posts: GridItem[] }>(`${endpoints.search}?q=${encodeURIComponent(q)}`)
        .then(res => { if (!cancelled) { setUsers(res.users); setFound(res.posts) } }).catch(fail).finally(finish)
    }
    return () => { cancelled = true }
  }, [category, debounced, showToast])

  const loadMore = async () => {
    try {
      const res = await api.get<{ items: GridItem[]; hasMore: boolean }>(`${endpoints.explore}?page=${page + 1}&limit=24`)
      setGrid(previous => [...previous, ...res.items.filter(item => !previous.some(p => p.id === item.id))]); setHasMore(res.hasMore); setPage(page + 1)
    } catch (reason) { showToast(errorMessage(reason)) }
  }
  const remember = () => { if (query.trim()) setHistory(items => [query.trim(), ...items.filter(item => item !== query.trim())].slice(0, 5)) }

  const searching = debounced.length > 0 && category !== 'Reels'
  const showUsers = category === 'Accounts' || (searching && category === 'For you')
  const showFoundPosts = searching && (category === 'Tags' || debounced.startsWith('#'))
  const tiles: GridItem[] = category === 'Reels' ? grid : showFoundPosts ? found : !searching && category === 'For you' ? grid : []
  const tilesTitle = category === 'Reels' ? 'Reels worth watching' : showFoundPosts ? `Results for “${debounced}”` : 'Today’s visual edit'
  const showTiles = category === 'Reels' || showFoundPosts || (!searching && category === 'For you')

  return <div className="explore-page page-enter">
    <header className="page-heading explore-heading"><div><p className="eyebrow">DISCOVER SOMETHING NEW</p><h1>Explore</h1></div></header>
    <form className="explore-search" onSubmit={event => { event.preventDefault(); remember(); setDebounced(query.trim()) }}><Search size={21} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people or #hashtags" aria-label="Search" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={18} /></button>}<button type="submit" className="search-submit">Search</button></form>
    <div className="search-categories" role="tablist">{categories.map(item => <button type="button" role="tab" aria-selected={category === item} className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(item)}>{item === 'Accounts' && <UserRound size={15} />}{item === 'Reels' && <Clapperboard size={15} />}{item === 'Tags' && <Hash size={15} />}{item === 'For you' && <Compass size={15} />}{item}</button>)}</div>

    {!query && category === 'For you' && history.length > 0 && <section className="search-history"><div><h2>Recent searches</h2><button type="button" onClick={() => setHistory([])}>Clear all</button></div><div className="history-chips">{history.map(item => <button type="button" key={item} onClick={() => setQuery(item)}><Search size={14} />{item}<span onClick={event => { event.stopPropagation(); setHistory(items => items.filter(value => value !== item)) }} aria-label={`Remove ${item}`}><X size={13} /></span></button>)}</div></section>}
    {category === 'Tags' && !searching && <p className="empty-copy">Type a hashtag, like “travel”, to see posts that use it.</p>}

    {showUsers && (users.length > 0 || loading) && <section className="account-results"><div className="section-title"><h2>{searching ? 'Accounts' : 'Suggested accounts'}</h2><span>{users.length} results</span></div>{users.map(user => <div className="account-result" key={user.id}><Avatar user={user} size="md" onClick={() => viewProfile(user)} /><div><button type="button" onClick={() => viewProfile(user)}>{user.username}{user.verified && <span className="verified"><Check size={10} /></span>}</button><strong>{user.name}</strong><span>{user.bio}</span></div><button type="button" className={`button ${following.has(user.username) ? 'button-secondary' : 'button-primary'} button-small`} onClick={() => toggleFollow(user.username)}>{following.has(user.username) ? 'Following' : 'Follow'}</button></div>)}</section>}
    {showUsers && !loading && users.length === 0 && (searching || category === 'Accounts') && <p className="empty-copy">{searching ? `No accounts found for “${debounced}”.` : 'No suggestions right now.'}</p>}

    {showTiles && <section className="explore-content"><div className="section-title"><h2>{tilesTitle}</h2><span>{tiles.length} posts</span></div>
      {loading && tiles.length === 0 ? <div className="viewer-loading"><span className="loading-spinner" /></div> : tiles.length === 0 ? <p className="empty-copy">{searching ? 'No posts found.' : 'Nothing to show yet. Be the first to share something.'}</p> :
      <div className="explore-grid">{tiles.map((item, index) => <button type="button" className={`explore-tile ${index === 0 || index === 5 ? 'tile-tall' : ''}`} key={item.id} onClick={() => openPost(item.id)} aria-label={`Open post ${index + 1}`}><MediaThumb image={item.image} video={item.video} alt={`Post ${index + 1}`} /><span className="tile-overlay"><span><Heart size={18} fill="currentColor" />{item.likes ?? 0}</span><span><MessageCircle size={18} fill="currentColor" />{item.commentsCount ?? 0}</span></span>{item.type === 'video' && <Clapperboard className="tile-type" size={19} />}</button>)}</div>}
      {category === 'For you' && !searching && hasMore && <button type="button" className="button button-secondary load-more" onClick={loadMore}>Load more discoveries</button>}
    </section>}
  </div>
}
