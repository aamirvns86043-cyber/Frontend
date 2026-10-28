import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, Heart, MoreHorizontal, Pause, Play, Send, X } from 'lucide-react'
import { Avatar } from './Avatar'
import { Brand } from './Brand'
import { useSocial } from '@/hooks/use-social'
import { api, endpoints, errorMessage } from '@/lib/api'
import type { Conversation } from '@/types/social'

export function StoryViewer() {
  const { stories, storyIndex, closeStory, openStory, openReport, openCreate, refreshStories, me, showToast } = useSocial()
  const [paused, setPaused] = useState(false)
  const [reply, setReply] = useState('')
  const [liked, setLiked] = useState(false)
  const [viewers, setViewers] = useState<number | null>(null)
  const story = storyIndex !== null ? stories[storyIndex] : undefined
  const storyId = story?.id
  const isVideo = story?.kind === 'video'
  const mine = !!story && story.user.id === me?.id

  const next = useCallback(() => {
    if (storyIndex === null) return
    if (storyIndex >= stories.length - 1) closeStory(); else openStory(storyIndex + 1)
  }, [storyIndex, stories.length, closeStory, openStory])
  const previous = useCallback(() => { if (storyIndex !== null && storyIndex > 0) openStory(storyIndex - 1) }, [storyIndex, openStory])

  // reset per-story state, count the view (not for my own stories), load "seen by" for my own
  useEffect(() => {
    if (!storyId) return
    setLiked(false); setReply(''); setViewers(null)
    if (mine) api.get<{ count: number }>(`${endpoints.stories}/${storyId}/viewers`).then(res => setViewers(res.count)).catch(() => {})
    else api.post(`${endpoints.stories}/${storyId}/view`).catch(() => {})
  }, [storyId, mine])

  // images advance after 5s; videos advance when they end
  useEffect(() => {
    if (!storyId || paused || isVideo) return
    const timer = window.setTimeout(next, 5000)
    return () => window.clearTimeout(timer)
  }, [storyId, paused, isVideo, next])

  useEffect(() => {
    if (storyIndex === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeStory()
      if (event.key === 'ArrowRight') next()
      if (event.key === 'ArrowLeft') previous()
      if (event.key === ' ' && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); setPaused(value => !value) }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [storyIndex, closeStory, next, previous])

  if (storyIndex === null || !story) return null

  const group = stories.filter(item => item.user.id === story.user.id)
  const position = group.findIndex(item => item.id === story.id)

  const sendDirect = async (text: string) => {
    const started = await api.post<{ conversation: Conversation }>(endpoints.conversations, { username: story.user.username })
    await api.post(`${endpoints.conversations}/${started.conversation.id}/messages`, { text })
  }
  const submitReply = async (event: React.FormEvent) => {
    event.preventDefault()
    const text = reply.trim()
    if (!text) return
    try { await sendDirect(text); setReply(''); showToast(`Reply sent to ${story.user.username}.`) } catch (reason) { showToast(errorMessage(reason)) }
  }
  const react = async () => {
    if (liked) return
    setLiked(true)
    try { await sendDirect('❤️'); showToast('Reaction sent.') } catch (reason) { setLiked(false); showToast(errorMessage(reason)) }
  }
  const remove = async () => {
    try {
      await api.del(`${endpoints.stories}/${story.id}`)
      closeStory(); await refreshStories(); showToast('Story deleted.')
    } catch (reason) { showToast(errorMessage(reason)) }
  }

  return <div className="story-viewer" role="dialog" aria-modal="true" aria-label={`${story.user.username}'s story`}>
    <div className="story-viewer-top"><button onClick={closeStory} aria-label="Close story and return home"><Brand inverse /></button><button className="story-close" type="button" onClick={closeStory} aria-label="Close story"><X size={25} /></button></div>
    <div className="story-stage">
      <button type="button" className="story-nav story-prev" onClick={previous} disabled={storyIndex <= 0} aria-label="Previous story"><ChevronLeft size={23} /></button>
      <div className="story-frame">
        <div className="story-progress">{group.map((item, index) => <span key={item.id}><i className={index < position ? 'complete' : index === position ? `current ${paused ? 'paused' : ''}` : ''} /></span>)}</div>
        <header className="story-header"><div><Avatar user={story.user} size="sm" /><strong>{story.user.username}</strong><span>{story.time}</span>{story.closeFriends && <span className="close-friends-label">Close friends</span>}</div><div><button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? 'Play story' : 'Pause story'}>{paused ? <Play size={20} /> : <Pause size={20} />}</button><details className="story-menu"><summary aria-label="Story options"><MoreHorizontal size={22} /></summary><div>{mine ? <><button onClick={() => { closeStory(); openCreate('story') }}>Add to story</button><button onClick={remove}>Delete story</button></> : <button onClick={() => { closeStory(); openReport({ type: 'story', target: story.id, label: `story by ${story.user.username}` }) }}>Report</button>}</div></details></div></header>
        {isVideo ? <video key={story.id} className="story-image" src={story.video} autoPlay playsInline controls={false} muted={false} onEnded={next} onClick={() => setPaused(value => !value)} /> : <img key={story.id} className="story-image" src={story.image} alt={`${story.user.name}'s story`} />}
        {mine ? <div className="story-seen"><Eye size={16} />{viewers === null ? '…' : `Seen by ${viewers}`}</div> : <form className="story-reply" onSubmit={submitReply}><input value={reply} onChange={event => setReply(event.target.value.slice(0, 500))} placeholder={`Reply to ${story.user.username}…`} aria-label="Reply to story" /><button type="button" className={liked ? 'liked' : ''} onClick={react} aria-label="React to story"><Heart size={23} fill={liked ? 'currentColor' : 'none'} /></button><button type="submit" aria-label="Send story reply" disabled={!reply.trim()}><Send size={22} /></button></form>}
      </div>
      <button type="button" className="story-nav story-next" onClick={next} aria-label="Next story"><ChevronRight size={23} /></button>
    </div>
  </div>
}
