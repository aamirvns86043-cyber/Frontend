import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, FileImage, ImagePlus, MapPin, Smile, Upload, X } from 'lucide-react'
import { Modal } from './Modal'
import { Avatar } from './Avatar'
import { useSocial } from '@/hooks/use-social'
import { api, endpoints, errorMessage } from '@/lib/api'

const MAX_IMAGES = 10

export function CreatePost() {
  const { createMode, closeCreate, notifyFeedChanged, refreshStories, me, showToast } = useSocial()
  const [step, setStep] = useState<'media' | 'details'>('media')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const previewsRef = useRef<string[]>([])
  const [active, setActive] = useState(0)
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState('')
  const [closeFriendsOnly, setCloseFriendsOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => { previewsRef.current = previews }, [previews])
  useEffect(() => () => previewsRef.current.forEach(url => URL.revokeObjectURL(url)), [])
  if (!createMode || !me) return null
  const isStory = createMode === 'story'
  const isVideo = (index: number) => files[index]?.type.startsWith('video/')

  const resetAndClose = () => {
    previews.forEach(url => URL.revokeObjectURL(url))
    setStep('media'); setFiles([]); setPreviews([]); setCaption(''); setLocation(''); setActive(0); setCloseFriendsOnly(false)
    closeCreate()
  }
  const selectFiles = (list: FileList | null) => {
    if (!list?.length) return
    const chosen = Array.from(list).filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'))
    if (!chosen.length) { showToast('Choose image or video files only.'); return }
    const video = chosen.find(file => file.type.startsWith('video/'))
    if (isStory || video) {
      // a story, or a video post, holds exactly one file
      previews.forEach(url => URL.revokeObjectURL(url))
      const one = video ?? chosen[0]
      setFiles([one]); setPreviews([URL.createObjectURL(one)]); setActive(0)
      if (video && !isStory) showToast('Video posts hold one video.')
      return
    }
    if (files.some(file => file.type.startsWith('video/'))) { showToast('Remove the video first to add photos.'); return }
    const room = chosen.slice(0, MAX_IMAGES - files.length)
    if (room.length < chosen.length) showToast(`You can add up to ${MAX_IMAGES} photos.`)
    setFiles(previous => [...previous, ...room]); setPreviews(previous => [...previous, ...room.map(file => URL.createObjectURL(file))])
  }
  const removeActive = () => {
    URL.revokeObjectURL(previews[active])
    const nextFiles = files.filter((_, index) => index !== active)
    setFiles(nextFiles); setPreviews(previews.filter((_, index) => index !== active)); setActive(0)
    if (!nextFiles.length) setStep('media')
  }
  const saveDraft = () => {
    localStorage.setItem('luma-draft', JSON.stringify({ caption, location, savedAt: new Date().toISOString() }))
    showToast('Draft text saved in this browser.')
  }

  const publishPost = async () => {
    if (!files.length) { showToast('Add a photo or video first.'); return }
    setBusy(true)
    try {
      const mediaIds: string[] = []
      for (const file of files) mediaIds.push((await api.upload(file)).id)
      await api.post(endpoints.posts, { mediaIds, caption, location })
      notifyFeedChanged()
      resetAndClose()
      showToast('Your post is live.')
    } catch (reason) { showToast(errorMessage(reason)) } finally { setBusy(false) }
  }
  const publishStory = async () => {
    if (!files.length) { showToast('Choose a photo or video first.'); return }
    setBusy(true)
    try {
      const uploaded = await api.upload(files[0])
      await api.post(endpoints.stories, { mediaId: uploaded.id, closeFriends: closeFriendsOnly })
      await refreshStories()
      resetAndClose()
      showToast('Story shared. It disappears after 24 hours.')
    } catch (reason) { showToast(errorMessage(reason)) } finally { setBusy(false) }
  }

  const input = <input ref={fileInput} type="file" accept="image/*,video/*" multiple={!isStory} hidden onChange={event => { selectFiles(event.target.files); event.target.value = '' }} />

  return <Modal title={isStory ? 'Create story' : step === 'details' ? 'Finish your post' : 'Create new post'} eyebrow="Share with Luma" onClose={resetAndClose} className="create-modal">
    {isStory ? <div className="story-composer">
      {previews.length ? <div className="editor-preview story-media-preview" style={{ aspectRatio: '9 / 16', maxHeight: '55vh' }}>{isVideo(0) ? <video src={previews[0]} controls playsInline /> : <img src={previews[0]} alt="Story preview" />}<button type="button" className="remove-media" onClick={removeActive} aria-label="Remove selected media"><X size={17} /></button></div>
        : <button type="button" className="media-upload-row" onClick={() => fileInput.current?.click()}><ImagePlus size={21} /><span><strong>Add photo or video</strong><small>Choose from your device</small></span><ChevronRight size={18} /></button>}
      {input}
      <label className="terms-check"><input type="checkbox" checked={closeFriendsOnly} onChange={event => setCloseFriendsOnly(event.target.checked)} /><span>Share with Close Friends only</span></label>
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={resetAndClose}>Cancel</button><button type="button" className="button button-primary" disabled={!files.length || busy} onClick={publishStory}>{busy ? 'Sharing…' : 'Share story'}</button></div>
    </div> : <>
      <div className="create-topbar">{step === 'details' && <button type="button" className="text-button with-icon" onClick={() => setStep('media')}><ArrowLeft size={16} />Back</button>}<span>{previews.length ? `${previews.length} item${previews.length > 1 ? 's' : ''} selected` : 'Photos and videos'}</span>{step === 'media' && previews.length > 0 && <button type="button" className="text-button" onClick={() => setStep('details')}>Next <ChevronRight size={15} /></button>}</div>
      <div className={`create-workspace ${step === 'details' ? 'show-details' : ''}`}>
        <div className="create-editor">
          {!previews.length ? <button type="button" className="upload-dropzone" onClick={() => fileInput.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); selectFiles(event.dataTransfer.files) }}><span className="upload-illustration"><FileImage size={35} strokeWidth={1.3} /></span><h3>Bring your moment here</h3><p>Drag photos or videos, or choose from your device.</p><span className="button button-primary"><Upload size={16} />Select media</span><small>JPG, PNG, WEBP, GIF, MP4, MOV · up to {MAX_IMAGES} photos or 1 video</small></button> : <>
            <div className="editor-preview" style={{ aspectRatio: '1 / 1' }}>{isVideo(active) ? <video src={previews[active]} controls playsInline /> : <img src={previews[active]} alt="Selected media preview" />}<button type="button" className="remove-media" onClick={removeActive} aria-label="Remove selected media"><X size={17} /></button></div>
            <div className="editor-toolbar"><div>{!isVideo(0) && files.length < MAX_IMAGES && <button type="button" onClick={() => fileInput.current?.click()}><ImagePlus size={17} />Add</button>}</div><div className="thumbnail-strip">{previews.map((url, index) => <button type="button" key={url} className={index === active ? 'active' : ''} onClick={() => setActive(index)}>{isVideo(index) ? <video src={url} muted /> : <img src={url} alt={`Media ${index + 1}`} />}</button>)}</div></div>
          </>}
          {input}
        </div>
        {step === 'details' && <div className="post-details">
          <div className="details-profile"><Avatar user={me} size="sm" /><div><strong>{me.username}</strong><span>New post</span></div></div>
          <label className="caption-field"><textarea value={caption} onChange={event => setCaption(event.target.value.slice(0, 2200))} placeholder="Write a caption… Add #hashtags." rows={5} /><span>{caption.length}/2,200</span></label>
          <button type="button" className="emoji-caption" onClick={() => setCaption(caption + ' ✨')}><Smile size={18} />Add a little sparkle</button>
          <label className="details-input"><MapPin size={18} /><input value={location} onChange={event => setLocation(event.target.value.slice(0, 100))} placeholder="Add location" /></label>
          <div className="publish-note"><Check size={17} /><p>Your photos and videos are uploaded and saved to your Luma account when you share.</p></div>
        </div>}
      </div>
      <div className="create-footer"><button type="button" className="button button-ghost" onClick={saveDraft}>Save draft</button><div><button type="button" className="button button-secondary" onClick={resetAndClose}>Cancel</button>{step === 'details' && <button type="button" className="button button-primary" disabled={busy} onClick={publishPost}>{busy ? 'Sharing…' : 'Share'}</button>}</div></div>
    </>}
  </Modal>
}
