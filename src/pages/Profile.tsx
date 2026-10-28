import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Check, Clapperboard, Grid3X3, MessageCircle, MoreHorizontal, Plus, Search, Settings, Share2 } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { MediaThumb } from '@/components/MediaThumb'
import { Modal } from '@/components/Modal'
import { useSocial } from '@/hooks/use-social'
import { api, endpoints, errorMessage } from '@/lib/api'
import type { Me, Post, Profile as ProfileData, User } from '@/types/social'

type Connection = User & { isFollowing: boolean }

export default function Profile() {
  const { me, setSession, profileUsername, viewProfile, following, toggleFollow, navigate, openCreate, openReport, openPost, openChatWith, showToast } = useSocial()
  const username = profileUsername ?? me?.username ?? ''
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [notFound, setNotFound] = useState('')
  const [tab, setTab] = useState<'posts' | 'reels'>('posts')
  const [posts, setPosts] = useState<Post[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [connections, setConnections] = useState<'followers' | 'following' | null>(null)
  const [people, setPeople] = useState<Connection[]>([])
  const [peopleCursor, setPeopleCursor] = useState<string | null>(null)
  const [peopleSearch, setPeopleSearch] = useState('')
  const [form, setForm] = useState({ name: '', username: '', bio: '' })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const avatarInput = useRef<HTMLInputElement>(null)
  const own = !!me && username === me.username

  const loadProfile = useCallback(async () => {
    if (!username) return
    try {
      const res = await api.get<{ user: ProfileData }>(`${endpoints.users}/${encodeURIComponent(username)}`)
      setProfile(res.user); setNotFound('')
    } catch (reason) { setProfile(null); setNotFound(errorMessage(reason)) }
  }, [username])
  useEffect(() => { setProfile(null); setTab('posts'); loadProfile() }, [loadProfile])

  const loadPosts = useCallback(async (from: string | null) => {
    if (!username) return
    setLoadingPosts(true)
    try {
      const res = await api.get<{ posts: Post[]; nextCursor: string | null }>(`${endpoints.users}/${encodeURIComponent(username)}/posts?limit=12${tab === 'reels' ? '&type=video' : ''}${from ? `&cursor=${from}` : ''}`)
      setPosts(previous => from ? [...previous, ...res.posts] : res.posts); setCursor(res.nextCursor)
    } catch (reason) { showToast(errorMessage(reason)) } finally { setLoadingPosts(false) }
  }, [username, tab, showToast])
  useEffect(() => { setPosts([]); setCursor(null); loadPosts(null) }, [loadPosts])

  const loadPeople = useCallback(async (kind: 'followers' | 'following', from: string | null) => {
    try {
      const res = await api.get<{ users: Connection[]; nextCursor: string | null }>(`${endpoints.users}/${encodeURIComponent(username)}/${kind}?limit=30${from ? `&cursor=${from}` : ''}`)
      setPeople(previous => from ? [...previous, ...res.users] : res.users); setPeopleCursor(res.nextCursor)
    } catch (reason) { showToast(errorMessage(reason)) }
  }, [username, showToast])
  const openConnections = (kind: 'followers' | 'following') => { setConnections(kind); setPeople([]); setPeopleCursor(null); setPeopleSearch(''); loadPeople(kind, null) }
  const shownPeople = useMemo(() => people.filter(user => `${user.name} ${user.username}`.toLowerCase().includes(peopleSearch.toLowerCase())), [people, peopleSearch])

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/profile`
    try { await navigator.clipboard.writeText(url); showToast('Profile link copied.') } catch { showToast('Copy this link: ' + url) }
  }
  const follow = async () => { await toggleFollow(username); loadProfile() }
  const startEdit = () => {
    if (!me) return
    setForm({ name: me.name, username: me.username, bio: me.bio ?? '' }); setAvatarFile(null); setAvatarPreview(''); setEditOpen(true)
  }
  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, string> = { name: form.name, username: form.username, bio: form.bio }
      if (avatarFile) body.avatarMediaId = (await api.upload(avatarFile)).id
      const res = await api.patch<{ user: Me }>(endpoints.me, body)
      setSession(res.user); setEditOpen(false); showToast('Profile updated.')
      if (res.user.username !== username) viewProfile(res.user); else loadProfile()
    } catch (reason) { showToast(errorMessage(reason)) } finally { setSaving(false) }
  }

  if (!me) return null
  if (!profile) return <div className="profile-page page-enter">{notFound ? <div className="empty-state"><h2>Profile unavailable</h2><p>{notFound}</p><button type="button" className="button button-secondary" onClick={() => viewProfile(me)}>Go to my profile</button></div> : <div className="viewer-loading"><span className="loading-spinner" /></div>}</div>
  const isFollowing = following.has(profile.username)

  return <div className="profile-page page-enter">
    <section className="profile-hero">
      <div className="profile-avatar-wrap"><Avatar user={own ? me : profile} size="xl" />{own && <button type="button" onClick={startEdit} aria-label="Change profile photo"><Camera size={17} /></button>}</div>
      <div className="profile-identity"><div className="profile-name-line"><h1>{profile.username}</h1>{profile.verified && <span className="verified verified-large"><Check size={13} /></span>}{!own && <span className="profile-online">{profile.online ? 'Active now' : 'Recently active'}</span>}</div><h2>{profile.name}</h2>{profile.bio && <p>{profile.bio}</p>}{profile.followsYou && !own && <p className="follows-you">Follows you</p>}</div>
      <div className="profile-actions">{own ? <><button type="button" className="button button-secondary" onClick={startEdit}>Edit profile</button><button type="button" className="button button-secondary" onClick={() => openCreate('story')}><Plus size={17} />Add story</button><button type="button" className="button button-secondary" onClick={() => navigate('settings')}><Settings size={17} />Settings</button><button type="button" className="icon-button bordered" onClick={share} aria-label="Share profile"><Share2 size={19} /></button></> : <><button type="button" className={`button ${isFollowing ? 'button-secondary' : 'button-primary'}`} onClick={follow}>{isFollowing ? 'Following' : 'Follow'}</button><button type="button" className="button button-secondary" onClick={() => openChatWith(profile.username)}><MessageCircle size={17} />Message</button><details className="action-menu"><summary className="icon-button bordered" aria-label="Profile options"><MoreHorizontal size={20} /></summary><div className="action-popover"><button onClick={share}>Share profile</button><button className="danger-text" onClick={() => openReport({ type: 'user', target: profile.username, label: profile.username })}>Report</button></div></details></>}</div>
      <div className="profile-stats"><button type="button" onClick={() => setTab('posts')}><strong>{profile.posts.toLocaleString()}</strong><span>posts</span></button><button type="button" onClick={() => openConnections('followers')}><strong>{profile.followers.toLocaleString()}</strong><span>followers</span></button><button type="button" onClick={() => openConnections('following')}><strong>{profile.following.toLocaleString()}</strong><span>following</span></button></div>
    </section>

    <div className="profile-tabs" role="tablist"><button type="button" role="tab" aria-selected={tab === 'posts'} className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}><Grid3X3 size={16} />Posts</button><button type="button" role="tab" aria-selected={tab === 'reels'} className={tab === 'reels' ? 'active' : ''} onClick={() => setTab('reels')}><Clapperboard size={17} />Reels</button></div>
    {posts.length ? <div className="profile-grid">{posts.map(post => <button type="button" key={post.id} onClick={() => openPost(post.id)} aria-label={`Open ${post.type} post`}><MediaThumb image={post.image} video={post.video} alt={post.caption || 'Post'} />{post.type === 'video' && <Clapperboard size={20} />}{post.type === 'carousel' && <span className="grid-stack-icon"><Grid3X3 size={16} /></span>}</button>)}</div> : loadingPosts ? <div className="viewer-loading"><span className="loading-spinner" /></div> : <div className="empty-state"><span>{tab === 'reels' ? <Clapperboard size={27} /> : <Camera size={27} />}</span><h2>{tab === 'reels' ? 'No reels yet' : 'No posts yet'}</h2><p>{own ? 'Share your first moment and it will show up here.' : `${profile.username} hasn’t shared anything yet.`}</p>{own && <button type="button" className="button button-secondary" onClick={() => openCreate('post')}>Create a post</button>}</div>}
    {cursor && <button type="button" className="button button-secondary load-more" onClick={() => loadPosts(cursor)} disabled={loadingPosts}>Load more</button>}

    {editOpen && <Modal title="Edit profile" eyebrow="Your public identity" onClose={() => setEditOpen(false)} className="modal-sm"><form className="modal-body form-stack" onSubmit={saveProfile}><div className="edit-avatar">{avatarPreview ? <span className="avatar avatar-xl"><img src={avatarPreview} alt="New profile" /></span> : <Avatar user={me} size="xl" />}<button type="button" className="button button-secondary button-small" onClick={() => avatarInput.current?.click()}><Camera size={16} />Change photo</button><input ref={avatarInput} hidden type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)) } }} /></div><label className="field"><span className="field-label">Full name</span><input required maxLength={60} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label className="field"><span className="field-label">Username</span><input required minLength={3} maxLength={30} value={form.username} onChange={event => setForm({ ...form, username: event.target.value.replace(/\s/g, '').toLowerCase() })} /></label><label className="field"><span className="field-label">Bio</span><textarea rows={4} value={form.bio} onChange={event => setForm({ ...form, bio: event.target.value.slice(0, 160) })} /><small className="field-hint">{form.bio.length}/160</small></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setEditOpen(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></div></form></Modal>}

    {connections && <Modal title={connections === 'followers' ? 'Followers' : 'Following'} eyebrow={profile.username} onClose={() => setConnections(null)} className="modal-sm"><div className="modal-body"><label className="inbox-search"><Search size={17} /><input value={peopleSearch} onChange={event => setPeopleSearch(event.target.value)} placeholder={`Search ${connections}`} /></label><div className="connection-list">{shownPeople.map(user => <div key={user.id} className="connection-row"><Avatar user={user} size="sm" onClick={() => { setConnections(null); viewProfile(user) }} /><div><button type="button" onClick={() => { setConnections(null); viewProfile(user) }}>{user.username}</button><span>{user.name}</span></div>{user.id !== me.id && <button type="button" className={`button button-small ${following.has(user.username) ? 'button-secondary' : 'button-primary'}`} onClick={async () => { await toggleFollow(user.username); if (own) loadProfile() }}>{following.has(user.username) ? 'Following' : 'Follow'}</button>}</div>)}{!shownPeople.length && <p className="empty-copy">{people.length ? 'No matches.' : connections === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</p>}</div>{peopleCursor && <button type="button" className="button button-secondary load-more" onClick={() => loadPeople(connections, peopleCursor)}>Load more</button>}</div></Modal>}
  </div>
}
