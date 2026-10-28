import { useEffect, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, Database, Download, LogOut, Moon, Palette, Shield, Sun, Trash2, UserRound, Users } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Modal } from '@/components/Modal'
import { SettingRow, Toggle } from '@/components/Controls'
import { useSocial } from '@/hooks/use-social'
import { api, endpoints, errorMessage } from '@/lib/api'
import type { Me, User } from '@/types/social'

const sections = [
  { id: 'account', label: 'Account & personal info', icon: UserRound, group: 'Your account' },
  { id: 'security', label: 'Password & security', icon: Shield, group: 'Your account' },
  { id: 'story', label: 'Close Friends', icon: Users, group: 'Preferences' },
  { id: 'appearance', label: 'Appearance & playback', icon: Palette, group: 'Display' },
  { id: 'data', label: 'Data & account management', icon: Database, group: 'More' },
] as const
type SectionId = typeof sections[number]['id']

function CloseFriendsEditor({ me }: { me: Me }) {
  const { showToast } = useSocial()
  const [people, setPeople] = useState<User[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [friends, followingList] = await Promise.all([
        api.get<{ users: User[] }>(`${endpoints.me}/close-friends`),
        api.get<{ users: User[] }>(`${endpoints.users}/${me.username}/following?limit=50`),
      ])
      if (cancelled) return
      const merged = new Map<string, User>()
      ;[...friends.users, ...followingList.users].forEach(user => merged.set(user.username, user))
      setPeople([...merged.values()]); setSelected(new Set(friends.users.map(user => user.username)))
    })().catch(reason => showToast(errorMessage(reason))).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [me.username, showToast])

  const save = async () => {
    setSaving(true)
    try { await api.put(`${endpoints.me}/close-friends`, { usernames: [...selected] }); showToast('Close Friends list saved.') } catch (reason) { showToast(errorMessage(reason)) } finally { setSaving(false) }
  }
  return <><section className="close-friends-section"><div><h2>Close Friends</h2><p>Stories marked “Close Friends only” are visible just to these people. Pick from accounts you follow.</p></div>
    <div className="close-friends-list">{people.map(user => <button type="button" key={user.id} onClick={() => setSelected(previous => { const next = new Set(previous); if (next.has(user.username)) next.delete(user.username); else next.add(user.username); return next })}><Avatar user={user} size="sm" /><span><strong>{user.name}</strong><small>@{user.username}</small></span><span className={`select-circle ${selected.has(user.username) ? 'selected' : ''}`}>{selected.has(user.username) && <Check size={13} />}</span></button>)}{!people.length && <p className="empty-copy">{loading ? 'Loading…' : 'Follow some people first, then you can add them here.'}</p>}</div></section>
    <button type="button" className="button button-primary" onClick={save} disabled={saving || loading}>{saving ? 'Saving…' : 'Save Close Friends'}</button></>
}

export default function Settings() {
  const { me, setSession, theme, toggleTheme, updateSettings, logout, showToast, navigate } = useSocial()
  const [active, setActive] = useState<SectionId>('account')
  const [mobileDetail, setMobileDetail] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: me?.name ?? '', username: me?.username ?? '', bio: me?.bio ?? '' })
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  if (!me) return null
  const current = sections.find(section => section.id === active)!
  const selectSection = (id: SectionId) => { setActive(id); setMobileDetail(true) }
  const run = async (task: () => Promise<void>) => { setBusy(true); try { await task() } catch (reason) { showToast(errorMessage(reason)) } finally { setBusy(false) } }

  const saveAccount = (event: React.FormEvent) => { event.preventDefault(); run(async () => {
    const res = await api.patch<{ user: Me }>(endpoints.me, profileForm)
    setSession(res.user); showToast('Account updated.')
  }) }
  const changePassword = (event: React.FormEvent) => { event.preventDefault()
    if (passwords.next.length < 10) { showToast('Use at least 10 characters for the new password.'); return }
    if (passwords.next !== passwords.confirm) { showToast('New passwords do not match.'); return }
    run(async () => { await api.post(`${endpoints.me}/password`, { current: passwords.current, next: passwords.next }); setPasswords({ current: '', next: '', confirm: '' }); showToast('Password changed. Other devices were signed out.') })
  }
  const exportData = () => run(async () => {
    const data = await api.get<unknown>(`${endpoints.me}/export`)
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'luma-data.json'; link.click(); URL.revokeObjectURL(url)
    showToast('Your data was downloaded.')
  })
  const deleteAccount = (event: React.FormEvent) => { event.preventDefault()
    if (deleteText !== 'DELETE') { showToast('Type DELETE to confirm.'); return }
    run(async () => { await api.del(endpoints.me, { password: deletePassword }); setDeleteOpen(false); await logout(); showToast('Your account was deleted.') })
  }
  const autoplay = me.settings.autoplay !== false
  const textSize = typeof me.settings.textSize === 'string' ? me.settings.textSize : 'default'

  const detail = () => {
    switch (active) {
      case 'account': return <>
        <div className="settings-profile-summary"><Avatar user={me} size="lg" /><div><strong>{me.name}</strong><span>@{me.username}</span></div><button type="button" className="button button-secondary button-small" onClick={() => navigate('profile')}>View profile</button></div>
        <form className="settings-form" onSubmit={saveAccount}><div className="form-grid"><label className="field"><span className="field-label">Full name</span><input required maxLength={60} value={profileForm.name} onChange={event => setProfileForm({ ...profileForm, name: event.target.value })} /></label><label className="field"><span className="field-label">Username</span><input required minLength={3} maxLength={30} value={profileForm.username} onChange={event => setProfileForm({ ...profileForm, username: event.target.value.replace(/\s/g, '').toLowerCase() })} /></label><label className="field"><span className="field-label">Email</span><input type="email" value={me.email ?? ''} placeholder="Not set" disabled /></label><label className="field"><span className="field-label">Phone</span><input type="tel" value={me.phone ?? ''} placeholder="Not set" disabled /></label></div><label className="field"><span className="field-label">Bio</span><textarea rows={3} value={profileForm.bio} onChange={event => setProfileForm({ ...profileForm, bio: event.target.value.slice(0, 160) })} /></label><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></form>
        <div className="notice"><Shield size={18} /><p>Your email or phone is the contact you signed up with and can’t be edited here.</p></div>
      </>
      case 'security': return <>
        <form className="settings-form" onSubmit={changePassword}><h2>Change password</h2><label className="field"><span className="field-label">Current password</span><input required type="password" autoComplete="current-password" value={passwords.current} onChange={event => setPasswords({ ...passwords, current: event.target.value })} /></label><label className="field"><span className="field-label">New password</span><input required type="password" autoComplete="new-password" value={passwords.next} onChange={event => setPasswords({ ...passwords, next: event.target.value })} /><small className="field-hint">At least 10 characters.</small></label><label className="field"><span className="field-label">Confirm new password</span><input required type="password" autoComplete="new-password" value={passwords.confirm} onChange={event => setPasswords({ ...passwords, confirm: event.target.value })} /></label><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form>
        <div className="settings-group"><SettingRow icon={LogOut} title="Log out of all devices" description="Ends every session, including this one" onClick={() => run(async () => { await api.post(endpoints.logoutAll); await logout() })} /></div>
      </>
      case 'story': return <CloseFriendsEditor me={me} />
      case 'appearance': return <>
        <h2>Choose your atmosphere</h2><p className="settings-intro">Saved to your account, so it follows you across devices.</p>
        <div className="theme-options"><button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => { if (theme !== 'light') toggleTheme() }}><div className="theme-preview theme-light"><span /><i /><i /></div><span><Sun size={18} />Light</span>{theme === 'light' && <Check size={18} />}</button><button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => { if (theme !== 'dark') toggleTheme() }}><div className="theme-preview theme-dark"><span /><i /><i /></div><span><Moon size={18} />Dark</span>{theme === 'dark' && <Check size={18} />}</button></div>
        <div className="setting-row settings-row-bordered"><span className="setting-copy"><strong>Reduce motion</strong><small>Minimize non-essential transitions and animations</small></span><Toggle checked={me.settings.reduceMotion === true} onChange={value => updateSettings({ reduceMotion: value })} label="Reduce motion" /></div>
        <div className="setting-row settings-row-bordered"><span className="setting-copy"><strong>Autoplay videos in Reels</strong><small>Turn off to save data</small></span><Toggle checked={autoplay} onChange={value => updateSettings({ autoplay: value })} label="Autoplay videos" /></div>
        <div className="settings-form"><label className="field"><span className="field-label">Text size</span><select value={textSize} onChange={event => updateSettings({ textSize: event.target.value })}><option value="small">Small</option><option value="default">Default</option><option value="large">Large</option></select></label></div>
      </>
      case 'data': return <>
        <div className="settings-group"><SettingRow icon={Download} title="Download your data" description="Your profile, posts, comments and who you follow, as JSON" onClick={exportData} /></div>
        <section className="danger-zone"><h2>Delete account</h2><p>This permanently removes your profile, posts, stories, messages and comments. It can’t be undone.</p><button type="button" className="button button-danger" onClick={() => setDeleteOpen(true)}>Delete my account</button></section>
      </>
    }
  }

  return <div className={`settings-page page-enter ${mobileDetail ? 'show-detail' : ''}`}>
    <aside className="settings-nav"><div className="settings-title"><p className="eyebrow">MAKE IT YOURS</p><h1>Settings</h1></div><div className="settings-nav-scroll">{Array.from(new Set(sections.map(section => section.group))).map(group => <section key={group}><h2>{group}</h2>{sections.filter(section => section.group === group).map(section => { const Icon = section.icon; return <button type="button" key={section.id} className={active === section.id ? 'active' : ''} onClick={() => selectSection(section.id)}><Icon size={18} /><span>{section.label}</span><ChevronRight size={15} /></button> })}</section>)}</div></aside>
    <section className="settings-detail"><header><button type="button" className="icon-button settings-back" onClick={() => setMobileDetail(false)} aria-label="Back to settings"><ArrowLeft size={21} /></button><div><p className="eyebrow">{current.group}</p><h1>{current.label}</h1></div></header><div className="settings-detail-body">{detail()}</div></section>

    {deleteOpen && <Modal title="Delete account?" eyebrow="Permanent action" onClose={() => setDeleteOpen(false)} className="modal-sm"><form className="modal-body form-stack" onSubmit={deleteAccount}><div className="notice danger-notice"><Trash2 size={18} /><p>Everything you’ve shared on Luma will be erased immediately.</p></div><label className="field"><span className="field-label">Your password</span><input required type="password" autoComplete="current-password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} /></label><label className="field"><span className="field-label">Type DELETE to continue</span><input value={deleteText} onChange={event => setDeleteText(event.target.value)} autoComplete="off" /></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setDeleteOpen(false)}>Keep account</button><button type="submit" className="button button-danger" disabled={deleteText !== 'DELETE' || !deletePassword || busy}>{busy ? 'Deleting…' : 'Delete account'}</button></div></form></Modal>}
  </div>
}
