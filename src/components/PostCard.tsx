import { useState } from 'react'
import { Bookmark, Check, ChevronLeft, ChevronRight, Heart, MapPin, MessageCircle, MoreHorizontal, Send, Smile, Trash2 } from 'lucide-react'
import { Avatar } from './Avatar'
import { useSocial } from '@/hooks/use-social'
import { api, endpoints, errorMessage } from '@/lib/api'
import type { Comment, Post } from '@/types/social'

export function PostCard({ post, onDeleted }: { post: Post; onDeleted?: (id: string) => void }) {
  const { me, following, toggleFollow, viewProfile, openReport, showToast } = useSocial()
  const [data, setData] = useState(post)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[] | null>(null) // newest first, as the API returns them
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingComments, setLoadingComments] = useState(false)
  const [comment, setComment] = useState('')
  const [slide, setSlide] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.caption)
  const images = data.images ?? [data.image]
  const mine = me?.id === data.user.id
  const isFollowing = following.has(data.user.username)
  const postUrl = `${endpoints.posts}/${data.id}`

  const loadComments = async (from: string | null) => {
    setLoadingComments(true)
    try {
      const res = await api.get<{ comments: Comment[]; nextCursor: string | null }>(`${postUrl}/comments?limit=20${from ? `&cursor=${from}` : ''}`)
      setComments(previous => from && previous ? [...previous, ...res.comments] : res.comments)
      setCursor(res.nextCursor)
    } catch (reason) { showToast(errorMessage(reason)) } finally { setLoadingComments(false) }
  }
  const toggleComments = () => {
    const next = !showComments
    setShowComments(next)
    if (next && comments === null) loadComments(null)
  }

  const toggleLike = async () => {
    const was = data.liked
    setData(item => ({ ...item, liked: !was, likes: Math.max(0, item.likes + (was ? -1 : 1)) }))
    try {
      const res = was ? await api.del<{ liked: boolean; likes: number }>(`${postUrl}/like`) : await api.post<{ liked: boolean; likes: number }>(`${postUrl}/like`)
      setData(item => ({ ...item, liked: res.liked, likes: res.likes }))
    } catch (reason) {
      setData(item => ({ ...item, liked: was, likes: Math.max(0, item.likes + (was ? 1 : -1)) }))
      showToast(errorMessage(reason))
    }
  }
  const toggleSave = async () => {
    const was = data.saved
    setData(item => ({ ...item, saved: !was }))
    try {
      if (was) await api.del(`${postUrl}/save`); else await api.post(`${postUrl}/save`)
      showToast(was ? 'Removed from saved.' : 'Saved to your collection.')
    } catch (reason) { setData(item => ({ ...item, saved: was })); showToast(errorMessage(reason)) }
  }

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/home?post=${data.id}`
    try { await navigator.clipboard.writeText(url); showToast('Post link copied.') } catch { showToast('Share link: ' + url) }
  }
  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault()
    const text = comment.trim()
    if (!text) return
    try {
      const res = await api.post<{ comment: Comment; commentsCount: number }>(`${postUrl}/comments`, { text })
      setComment('')
      setData(item => ({ ...item, commentsCount: res.commentsCount }))
      if (comments === null) { setShowComments(true); await loadComments(null) } else { setComments([res.comment, ...comments]); setShowComments(true) }
    } catch (reason) { showToast(errorMessage(reason)) }
  }
  const deleteComment = async (item: Comment) => {
    try {
      await api.del(`${postUrl}/comments/${item.id}`)
      setComments(previous => previous ? previous.filter(c => c.id !== item.id) : previous)
      setData(current => ({ ...current, commentsCount: Math.max(0, current.commentsCount - 1) }))
    } catch (reason) { showToast(errorMessage(reason)) }
  }
  const deletePost = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    try { await api.del(postUrl); showToast('Post deleted.'); onDeleted?.(data.id) } catch (reason) { showToast(errorMessage(reason)) }
  }
  const saveCaption = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const res = await api.patch<{ post: Post }>(postUrl, { caption: draft })
      setData(res.post); setEditing(false); showToast('Caption updated.')
    } catch (reason) { showToast(errorMessage(reason)) }
  }

  return <article className="post-card" id={`post-${data.id}`}>
    <header className="post-header">
      <div className="post-author"><Avatar user={data.user} size="sm" ring onClick={() => viewProfile(data.user)} /><div><div className="author-line"><button type="button" onClick={() => viewProfile(data.user)}>{data.user.username}</button>{data.user.verified && <span className="verified"><Check size={10} /></span>}<span className="post-time">· {data.time}</span></div>{data.location && <span className="post-location"><MapPin size={11} />{data.location}</span>}</div></div>
      <details className="action-menu">
        <summary className="icon-button" aria-label="Post options"><MoreHorizontal size={22} /></summary>
        <div className="action-popover">
          {mine && <button type="button" onClick={() => { setDraft(data.caption); setEditing(true) }}>Edit caption</button>}
          {mine && <button type="button" className="danger-text" onClick={deletePost}><Trash2 size={15} /> Delete post</button>}
          {!mine && <button type="button" onClick={() => toggleFollow(data.user.username)}>{isFollowing ? 'Unfollow' : 'Follow'} {data.user.username}</button>}
          <button type="button" onClick={share}>Copy link</button>
          {!mine && <button type="button" className="danger-text" onClick={() => openReport({ type: 'post', target: data.id, label: `post by ${data.user.username}` })}>Report</button>}
        </div>
      </details>
    </header>

    <div className="post-media" onDoubleClick={() => { if (!data.liked) toggleLike() }}>
      {data.type === 'video' && data.video ? <video src={data.video} poster={data.poster || data.image || undefined} controls playsInline className="active" aria-label={data.caption} /> : images.map((image, index) => <img key={image} src={image} alt={index === 0 ? data.caption : `Post media ${index + 1}`} className={index === slide ? 'active' : ''} loading="lazy" />)}
      {images.length > 1 && data.type !== 'video' && <>
        {slide > 0 && <button type="button" className="carousel-arrow carousel-prev" onClick={() => setSlide(slide - 1)} aria-label="Previous image"><ChevronLeft size={18} /></button>}
        {slide < images.length - 1 && <button type="button" className="carousel-arrow carousel-next" onClick={() => setSlide(slide + 1)} aria-label="Next image"><ChevronRight size={18} /></button>}
        <span className="carousel-count">{slide + 1}/{images.length}</span>
        <div className="carousel-dots">{images.map((_, index) => <span key={index} className={index === slide ? 'active' : ''} />)}</div>
      </>}
    </div>

    <div className="post-content">
      <div className="post-actions">
        <div><button type="button" className={`icon-button ${data.liked ? 'liked' : ''}`} onClick={toggleLike} aria-label={data.liked ? 'Unlike post' : 'Like post'} aria-pressed={data.liked}><Heart size={24} fill={data.liked ? 'currentColor' : 'none'} /></button><button type="button" className="icon-button" onClick={toggleComments} aria-label="Show comments"><MessageCircle size={23} /></button><button type="button" className="icon-button" onClick={share} aria-label="Share post"><Send size={23} /></button></div>
        <button type="button" className={`icon-button ${data.saved ? 'saved' : ''}`} onClick={toggleSave} aria-label={data.saved ? 'Unsave post' : 'Save post'}><Bookmark size={23} fill={data.saved ? 'currentColor' : 'none'} /></button>
      </div>
      <button type="button" className="post-likes" onClick={toggleComments}>{data.likes.toLocaleString()} {data.likes === 1 ? 'like' : 'likes'}</button>
      {editing ? <form className="edit-caption" onSubmit={saveCaption}><textarea value={draft} onChange={event => setDraft(event.target.value.slice(0, 2200))} rows={3} aria-label="Edit caption" /><div><button type="button" className="text-button" onClick={() => setEditing(false)}>Cancel</button><button type="submit" className="text-button">Save</button></div></form> : data.caption && <p className="post-caption"><button type="button" onClick={() => viewProfile(data.user)}>{data.user.username}</button> {data.caption}</p>}
      {data.commentsCount > 0 && <button type="button" className="view-comments" onClick={toggleComments}>{showComments ? 'Hide comments' : `View all ${data.commentsCount} comment${data.commentsCount === 1 ? '' : 's'}`}</button>}
      {showComments && <div className="comments-list">
        {cursor && <button type="button" className="text-button load-older" onClick={() => loadComments(cursor)} disabled={loadingComments}>View older comments</button>}
        {loadingComments && !comments?.length && <span className="loading-spinner" />}
        {comments && [...comments].reverse().map(item => <div className="comment" key={item.id}><Avatar user={item.user} size="xs" /><p><button type="button" onClick={() => viewProfile(item.user)}>{item.user.username}</button>{item.text}<small>{item.time}</small></p>{(item.user.id === me?.id || mine) && <button type="button" className="comment-like comment-delete" aria-label="Delete comment" onClick={() => deleteComment(item)}><Trash2 size={13} /></button>}</div>)}
      </div>}
      <form className="comment-form" onSubmit={submitComment}><button type="button" className="icon-button" onClick={() => setComment(comment + ' ✨')} aria-label="Add emoji"><Smile size={20} /></button><input value={comment} onChange={event => setComment(event.target.value.slice(0, 500))} placeholder="Add a comment…" aria-label="Add a comment" /><button type="submit" className="text-button" disabled={!comment.trim()}>Post</button></form>
    </div>
  </article>
}
