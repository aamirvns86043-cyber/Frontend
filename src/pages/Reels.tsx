import { useCallback, useEffect, useRef, useState } from 'react'
import { Bookmark, Check, ChevronDown, Heart, MessageCircle, MoreHorizontal, Music2, Pause, Play, Send, Volume2, VolumeX } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { useSocial } from '@/hooks/use-social'
import { api, endpoints, errorMessage } from '@/lib/api'
import type { Reel } from '@/types/social'

export default function Reels() {
  const { me, viewProfile, following, toggleFollow, openReport, openCreate, openPost, showToast } = useSocial()
  const [reels, setReels] = useState<Reel[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [muted, setMuted] = useState(true)
  const [buffering, setBuffering] = useState(true)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const busy = useRef(false)
  const autoplay = me?.settings.autoplay !== false
  const reel = reels[active]

  const load = useCallback(async (from: string | null) => {
    if (busy.current) return
    busy.current = true; setLoading(true)
    try {
      const res = await api.get<{ reels: Reel[]; nextCursor: string | null }>(`${endpoints.reels}?limit=8${from ? `&cursor=${from}` : ''}`)
      setReels(previous => from ? [...previous, ...res.reels.filter(item => !previous.some(p => p.id === item.id))] : res.reels)
      setCursor(res.nextCursor)
    } catch (reason) { showToast(errorMessage(reason)) } finally { busy.current = false; setLoading(false) }
  }, [showToast])
  useEffect(() => { load(null) }, [load])

  const move = (direction: number) => {
    const next = Math.max(0, Math.min(reels.length - 1, active + direction))
    if (next === active) return
    videoRefs.current[active]?.pause()
    setActive(next); setPlaying(true); setBuffering(true)
    if (next >= reels.length - 2 && cursor) load(cursor)
  }
  const togglePlay = () => {
    const video = videoRefs.current[active]
    if (!video) return
    if (video.paused) { video.play().catch(() => {}); setPlaying(true) } else { video.pause(); setPlaying(false) }
  }
  const patch = (id: string, change: Partial<Reel>) => setReels(items => items.map(item => item.id === id ? { ...item, ...change } : item))
  const like = async (item: Reel) => {
    patch(item.id, { liked: !item.liked, likes: Math.max(0, item.likes + (item.liked ? -1 : 1)) })
    try {
      const res = item.liked ? await api.del<{ liked: boolean; likes: number }>(`${endpoints.posts}/${item.id}/like`) : await api.post<{ liked: boolean; likes: number }>(`${endpoints.posts}/${item.id}/like`)
      patch(item.id, { liked: res.liked, likes: res.likes })
    } catch (reason) { patch(item.id, { liked: item.liked, likes: item.likes }); showToast(errorMessage(reason)) }
  }
  const save = async (item: Reel) => {
    patch(item.id, { saved: !item.saved })
    try { if (item.saved) await api.del(`${endpoints.posts}/${item.id}/save`); else await api.post(`${endpoints.posts}/${item.id}/save`) } catch (reason) { patch(item.id, { saved: item.saved }); showToast(errorMessage(reason)) }
  }
  const share = async (item: Reel) => {
    const url = `${window.location.origin}${window.location.pathname}#/home?post=${item.id}`
    try { await navigator.clipboard.writeText(url); showToast('Reel link copied.') } catch { showToast('Reel link: ' + url) }
  }

  return <div className="reels-page page-enter" onKeyDown={event => { if (event.key === 'ArrowDown') move(1); if (event.key === 'ArrowUp') move(-1) }} tabIndex={0}>
    <div className="reels-topline"><div><p className="eyebrow">SHORT FORM / BIG STORIES</p><h1>Reels</h1></div><button type="button" className="button button-secondary" onClick={() => openCreate('post')}>Upload reel</button></div>
    {!reel ? <div className="empty-state">{loading ? <span className="loading-spinner" /> : <><span><Play size={27} /></span><h2>No reels yet</h2><p>Video posts show up here. Share a video to start the first reel.</p><button type="button" className="button button-secondary" onClick={() => openCreate('post')}>Upload a video</button></>}</div> :
    <div className="reel-stage">
      <div className="reel-phone">
        <video key={reel.id} ref={element => { videoRefs.current[active] = element }} src={reel.video} poster={reel.poster || undefined} autoPlay={autoplay} muted={muted} loop playsInline onCanPlay={() => setBuffering(false)} onPlay={() => setPlaying(true)} onWaiting={() => setBuffering(true)} onClick={togglePlay} aria-label={reel.caption} />
        <div className="reel-shade" />
        {buffering && autoplay && <div className="reel-buffer"><span className="loading-spinner" /><span>Buffering video…</span></div>}
        {(!playing || !autoplay) && !buffering && <button type="button" className="reel-big-play" onClick={togglePlay} aria-label="Play reel"><Play size={32} fill="currentColor" /></button>}
        <div className="reel-header"><span>Reels</span><div><button type="button" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute reel' : 'Mute reel'}>{muted ? <VolumeX size={21} /> : <Volume2 size={21} />}</button><button type="button" onClick={togglePlay} aria-label={playing ? 'Pause reel' : 'Play reel'}>{playing ? <Pause size={21} /> : <Play size={21} />}</button></div></div>
        <div className="reel-caption"><div className="reel-author"><Avatar user={reel.user} size="sm" onClick={() => viewProfile(reel.user)} /><button type="button" onClick={() => viewProfile(reel.user)}>{reel.user.username}</button>{reel.user.verified && <span className="verified"><Check size={10} /></span>}{reel.user.id !== me?.id && <button type="button" className="reel-follow" onClick={() => toggleFollow(reel.user.username)}>{following.has(reel.user.username) ? 'Following' : 'Follow'}</button>}</div><p>{reel.caption}</p><button type="button" className="reel-audio" onClick={() => showToast(`Audio: ${reel.audio}`)}><Music2 size={15} /><span>{reel.audio}</span></button></div>
        <div className="reel-actions"><button type="button" className={reel.liked ? 'liked' : ''} onClick={() => like(reel)}><Heart size={26} fill={reel.liked ? 'currentColor' : 'none'} /><span>{reel.likes.toLocaleString()}</span></button><button type="button" onClick={() => openPost(reel.id)}><MessageCircle size={26} /><span>{reel.comments.toLocaleString()}</span></button><button type="button" onClick={() => share(reel)}><Send size={25} /><span>Share</span></button><button type="button" className={reel.saved ? 'saved' : ''} onClick={() => save(reel)}><Bookmark size={25} fill={reel.saved ? 'currentColor' : 'none'} /><span>Save</span></button>{reel.user.id !== me?.id && <details className="reel-menu"><summary aria-label="Reel options"><MoreHorizontal size={25} /></summary><div><button onClick={() => openReport({ type: 'post', target: reel.id, label: `reel by ${reel.user.username}` })}>Report</button></div></details>}<Avatar user={reel.user} size="xs" /></div>
        <div className="reel-progress"><span style={{ width: `${((active + 1) / reels.length) * 100}%` }} /></div>
      </div>
      <div className="reel-pagination"><span>{String(active + 1).padStart(2, '0')} <i>/ {String(reels.length).padStart(2, '0')}{cursor ? '+' : ''}</i></span><button type="button" onClick={() => move(1)} disabled={active === reels.length - 1} aria-label="Next reel"><ChevronDown size={23} /></button><small>USE THE ARROW BUTTON OR KEYS</small></div>
    </div>}
  </div>
}
