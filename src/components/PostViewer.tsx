import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { PostCard } from './PostCard'
import { useSocial } from '@/hooks/use-social'
import { api, endpoints, errorMessage } from '@/lib/api'
import type { Post } from '@/types/social'

/** Opens any post (from Explore, Profile, Notifications, Reels, a shared link…) in a dialog. */
export function PostViewer() {
  const { openPostId, closePost, notifyFeedChanged } = useSocial()
  const [post, setPost] = useState<Post | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!openPostId) return
    let cancelled = false
    setPost(null); setError('')
    api.get<{ post: Post }>(`${endpoints.posts}/${openPostId}`)
      .then(res => { if (!cancelled) setPost(res.post) })
      .catch(reason => { if (!cancelled) setError(errorMessage(reason)) })
    return () => { cancelled = true }
  }, [openPostId])

  if (!openPostId) return null
  return <Modal title="Post" eyebrow="Luma" onClose={closePost} className="modal-sm post-viewer">
    {post ? <PostCard key={post.id} post={post} onDeleted={() => { closePost(); notifyFeedChanged() }} /> : error ? <div className="form-message error" role="alert">{error}</div> : <div className="viewer-loading"><span className="loading-spinner" /></div>}
  </Modal>
}
