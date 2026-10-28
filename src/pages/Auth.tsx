import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Eye, EyeOff, Lock, Mail, Moon, Phone, Shield, Sun, UserRound } from 'lucide-react'
import { Brand } from '@/components/Brand'
import { useSocial } from '@/hooks/use-social'
import { ApiError, api, endpoints, errorMessage } from '@/lib/api'
import type { Me } from '@/types/social'

type AuthView = 'login' | 'signup' | 'verify' | 'forgot' | 'reset' | 'photo'
const emptyOtp = () => ['', '', '', '', '', '']
const looksLikeContact = (value: string) => value.includes('@') || /^\+?[\d\s\-().]{7,}$/.test(value.trim())

export default function Auth() {
  const { navigate, setSession, theme, toggleTheme, showToast } = useSocial()
  const [view, setView] = useState<AuthView>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [login, setLogin] = useState({ identity: '', password: '' })
  const [signup, setSignup] = useState({ name: '', username: '', contact: '', password: '' })
  const [contact, setContact] = useState('') // where the code was / will be sent
  const [purpose, setPurpose] = useState<'signup' | 'reset'>('signup')
  const [otp, setOtp] = useState(emptyOtp)
  const [resetToken, setResetToken] = useState('')
  const [reset, setReset] = useState({ password: '', confirm: '' })
  const [usernameNote, setUsernameNote] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photo, setPhoto] = useState('')
  const [pendingUser, setPendingUser] = useState<Me | null>(null)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const photoRef = useRef<HTMLInputElement>(null)
  const target = contact.trim()

  const runRequest = async (callback: () => Promise<void>) => {
    setError(''); setBusy(true)
    try { await callback() } catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }
  const enterApp = (user: Me) => { setSession(user); navigate('home') }

  const submitLogin = (event: React.FormEvent) => {
    event.preventDefault()
    runRequest(async () => {
      try {
        const res = await api.post<{ user: Me }>(endpoints.login, login)
        enterApp(res.user)
      } catch (reason) {
        if (reason instanceof ApiError && reason.code === 'NOT_VERIFIED') {
          // the server already sent a fresh code to the account's email/phone
          setContact(looksLikeContact(login.identity) ? login.identity.trim() : '')
          setPurpose('signup'); setOtp(emptyOtp()); setView('verify'); setError(reason.message)
          return
        }
        throw reason
      }
    })
  }
  const submitSignup = (event: React.FormEvent) => {
    event.preventDefault()
    if (signup.password.length < 10) { setError('Use at least 10 characters for your password.'); return }
    runRequest(async () => {
      const res = await api.post<{ requiresVerification: boolean; contact?: string; user?: Me }>(endpoints.signup, signup)
      if (res.requiresVerification) {
        setContact(res.contact ?? signup.contact.trim()); setPurpose('signup'); setOtp(emptyOtp()); setView('verify')
      } else if (res.user) { setPendingUser(res.user); setView('photo') }
    })
  }
  const checkUsername = () => {
    if (signup.username.length < 3) { setUsernameNote('Use at least 3 characters.'); return }
    setUsernameNote('Checking…')
    api.get<{ available: boolean; reason?: string }>(`${endpoints.usernameAvailability}?username=${encodeURIComponent(signup.username)}`)
      .then(result => setUsernameNote(result.available ? 'Username is available.' : result.reason ?? 'That username is already taken.'))
      .catch(() => setUsernameNote(''))
  }
  const updateOtp = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]; next[index] = digit; setOtp(next)
    if (digit && index < 5) otpRefs.current[index + 1]?.focus()
  }
  const verify = (event: React.FormEvent) => {
    event.preventDefault()
    if (!target) { setError('Enter the email or phone the code was sent to.'); return }
    if (otp.some(value => !value)) { setError('Enter all six digits.'); return }
    runRequest(async () => {
      if (purpose === 'signup') {
        const res = await api.post<{ user: Me }>(endpoints.verifyOtp, { contact: target, code: otp.join(''), purpose })
        setPendingUser(res.user); setView('photo')
      } else {
        const res = await api.post<{ resetToken: string }>(endpoints.verifyOtp, { contact: target, code: otp.join(''), purpose })
        setResetToken(res.resetToken); setView('reset')
      }
    })
  }
  const resend = () => {
    if (!target) { setError('Enter your email or phone first.'); return }
    runRequest(async () => { await api.post(endpoints.requestOtp, { contact: target, purpose }); showToast('If that account exists, a new code is on its way.') })
  }
  const requestReset = (event: React.FormEvent) => {
    event.preventDefault()
    runRequest(async () => {
      await api.post(endpoints.requestOtp, { contact: target, purpose: 'reset' })
      setPurpose('reset'); setOtp(emptyOtp()); setView('verify')
    })
  }
  const submitReset = (event: React.FormEvent) => {
    event.preventDefault()
    if (reset.password.length < 10) { setError('Use at least 10 characters.'); return }
    if (reset.password !== reset.confirm) { setError('Passwords do not match.'); return }
    runRequest(async () => {
      await api.post(endpoints.resetPassword, { resetToken, password: reset.password })
      setReset({ password: '', confirm: '' }); setResetToken(''); setView('login')
      showToast('Password updated. Log in with your new password.')
    })
  }
  const finishPhoto = () => runRequest(async () => {
    let user = pendingUser
    if (photoFile) {
      const uploaded = await api.upload(photoFile)
      user = (await api.patch<{ user: Me }>(endpoints.me, { avatarMediaId: uploaded.id })).user
    }
    if (!user) user = (await api.get<{ user: Me | null }>(endpoints.session)).user
    if (!user) throw new Error('Please log in again.')
    enterApp(user)
  })
  const skipPhoto = () => runRequest(async () => {
    const user = pendingUser ?? (await api.get<{ user: Me | null }>(endpoints.session)).user
    if (!user) throw new Error('Please log in again.')
    enterApp(user)
  })

  const title = view === 'login' ? 'Welcome back.' : view === 'signup' ? 'Create your space.' : view === 'verify' ? 'Check your inbox.' : view === 'forgot' ? 'Reset your password.' : view === 'reset' ? 'Choose a new password.' : 'Put a face to the name.'
  const subtitle = view === 'login' ? 'Good to see you again. Your people and moments are waiting.' : view === 'signup' ? 'A thoughtful corner of the internet, made for your everyday.' : view === 'verify' ? 'Enter the six-digit verification code to continue.' : view === 'forgot' ? 'Enter your email and we’ll send you a reset code.' : view === 'reset' ? 'Use a strong password you don’t use anywhere else.' : 'Add a profile photo so friends can recognize you.'
  const goBack = () => { setView(view === 'verify' ? (purpose === 'signup' ? 'signup' : 'forgot') : 'login'); setError('') }

  return <div className="auth-page">
    <section className="auth-visual"><img src="/media/portrait-coast.webp" alt="A person enjoying a quiet coastal sunset" /><div className="auth-visual-shade" /><div className="auth-visual-top"><Brand inverse /><span>SOCIAL, AT YOUR PACE</span></div><div className="auth-quote"><p>“A place for the moments<br />you <em>actually</em> want to keep.”</p><div><span className="quote-line" /><span>Made for real life, not endless noise.</span></div></div><div className="auth-image-meta"><span>51.5072° N</span><span>LUMA / 001</span></div></section>
    <section className="auth-form-side"><div className="auth-form-top"><span /><button type="button" className="icon-button" onClick={toggleTheme} aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</button></div>
      <div className="auth-form-wrap">
        {view !== 'login' && view !== 'photo' && <button type="button" className="auth-back" onClick={goBack}><ArrowLeft size={17} />Back</button>}
        <div className="auth-heading"><p className="eyebrow">{view === 'login' ? 'YOUR MOMENTS, YOUR PEOPLE' : view === 'photo' ? 'ONE LAST TOUCH' : 'JOIN LUMA'}</p><h1>{title}</h1><p>{subtitle}</p></div>
        {error && <div className="form-message error" role="alert">{error}</div>}

        {view === 'login' && <form className="auth-form" onSubmit={submitLogin}><label className="field"><span className="field-label">Username, email, or phone</span><div className="input-with-icon"><UserRound size={18} /><input required autoComplete="username" value={login.identity} onChange={event => setLogin({ ...login, identity: event.target.value })} placeholder="you@example.com" /></div></label><label className="field"><span className="field-label">Password <button type="button" onClick={() => { setView('forgot'); setError('') }}>Forgot password?</button></span><div className="input-with-icon"><Lock size={18} /><input required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={login.password} onChange={event => setLogin({ ...login, password: event.target.value })} placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label><button type="submit" className="button button-primary auth-submit" disabled={busy}>{busy ? <span className="loading-spinner" /> : 'Log in'}<ArrowRight size={18} /></button><p className="auth-switch">New to Luma? <button type="button" onClick={() => { setView('signup'); setError('') }}>Create an account</button></p></form>}

        {view === 'signup' && <form className="auth-form" onSubmit={submitSignup}><label className="field"><span className="field-label">Full name</span><input required autoComplete="name" value={signup.name} onChange={event => setSignup({ ...signup, name: event.target.value })} placeholder="Your full name" /></label><label className="field"><span className="field-label">Username</span><input required autoComplete="username" value={signup.username} onChange={event => { setSignup({ ...signup, username: event.target.value.replace(/\s/g, '').toLowerCase() }); setUsernameNote('') }} onBlur={checkUsername} placeholder="Choose something unique" /><small className="field-hint">{usernameNote}</small></label><label className="field"><span className="field-label">Email or phone</span><div className="input-with-icon"><Mail size={18} /><input required autoComplete="email" value={signup.contact} onChange={event => setSignup({ ...signup, contact: event.target.value })} placeholder="you@example.com" /></div></label><label className="field"><span className="field-label">Password</span><div className="input-with-icon"><Lock size={18} /><input required type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={signup.password} onChange={event => setSignup({ ...signup, password: event.target.value })} placeholder="At least 10 characters" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label><label className="terms-check"><input required type="checkbox" /><span>I agree to the Terms and Privacy Policy.</span></label><button type="submit" className="button button-primary auth-submit" disabled={busy}>{busy ? <span className="loading-spinner" /> : 'Create account'}<ArrowRight size={18} /></button><p className="auth-switch">Already have an account? <button type="button" onClick={() => { setView('login'); setError('') }}>Log in</button></p></form>}

        {view === 'verify' && <form className="auth-form" onSubmit={verify}>{target ? <div className="contact-verification"><Mail size={21} /><div><strong>{purpose === 'reset' ? 'Password reset code' : 'Verification required'}</strong><span>{target}</span></div><button type="button" onClick={goBack}>Edit</button></div> : <label className="field"><span className="field-label">Email or phone the code was sent to</span><div className="input-with-icon"><Mail size={18} /><input value={contact} onChange={event => setContact(event.target.value)} placeholder="you@example.com" /></div></label>}<div className="otp-fields" onPaste={event => { const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split(''); if (digits.length) { event.preventDefault(); setOtp(Array.from({ length: 6 }, (_, index) => digits[index] ?? '')); otpRefs.current[Math.min(digits.length, 5)]?.focus() } }}>{otp.map((value, index) => <input key={index} ref={element => { otpRefs.current[index] = element }} value={value} onChange={event => updateOtp(index, event.target.value)} onKeyDown={event => { if (event.key === 'Backspace' && !value && index > 0) otpRefs.current[index - 1]?.focus() }} inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} aria-label={`Digit ${index + 1}`} />)}</div><button type="submit" className="button button-primary auth-submit" disabled={busy}>{busy ? <span className="loading-spinner" /> : 'Verify code'}<ArrowRight size={18} /></button><button type="button" className="text-button" onClick={resend} disabled={busy}>Resend code</button></form>}

        {view === 'forgot' && <form className="auth-form" onSubmit={requestReset}><label className="field"><span className="field-label">Email or phone</span><div className="input-with-icon"><Phone size={18} /><input required value={contact} onChange={event => setContact(event.target.value)} placeholder="Where should we contact you?" /></div></label><div className="notice"><Shield size={18} /><p>We’ll send a six-digit code. It expires in 10 minutes and works once.</p></div><button type="submit" className="button button-primary auth-submit" disabled={busy}>{busy ? <span className="loading-spinner" /> : 'Send reset code'}<ArrowRight size={18} /></button></form>}

        {view === 'reset' && <form className="auth-form" onSubmit={submitReset}><label className="field"><span className="field-label">New password</span><input required type="password" autoComplete="new-password" value={reset.password} onChange={event => setReset({ ...reset, password: event.target.value })} /></label><label className="field"><span className="field-label">Confirm new password</span><input required type="password" autoComplete="new-password" value={reset.confirm} onChange={event => setReset({ ...reset, confirm: event.target.value })} /></label><button type="submit" className="button button-primary auth-submit" disabled={busy}>{busy ? <span className="loading-spinner" /> : 'Update password'}<ArrowRight size={18} /></button></form>}

        {view === 'photo' && <div className="auth-form"><div className="photo-setup"><button type="button" className="photo-setup-preview" onClick={() => photoRef.current?.click()} aria-label="Choose profile photo">{photo ? <img src={photo} alt="Profile preview" /> : <><Camera size={28} /><span>Add photo</span></>}</button><input ref={photoRef} hidden type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) { setPhotoFile(file); setPhoto(URL.createObjectURL(file)) } }} /><p>Choose a clear photo of yourself, or skip for now.</p></div><button type="button" className="button button-primary auth-submit" disabled={busy} onClick={finishPhoto}>{busy ? <span className="loading-spinner" /> : photoFile ? 'Save photo and continue' : 'Continue'}<ArrowRight size={18} /></button><button type="button" className="text-button" disabled={busy} onClick={skipPhoto}>Skip for now</button></div>}

        <div className="auth-security-note"><Lock size={13} /><span>Secure session · No auth secrets stored in your browser</span></div>
      </div>
      <div className="auth-footer"><span>© 2026 Luma</span></div>
    </section>
  </div>
}
