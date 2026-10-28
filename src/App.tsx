import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Brand } from '@/components/Brand'
import { CreatePost } from '@/components/CreatePost'
import { PostViewer } from '@/components/PostViewer'
import { ReportDialog } from '@/components/ReportDialog'
import { StoryViewer } from '@/components/StoryViewer'
import { SocialProvider, useSocial } from '@/hooks/use-social'
import Feed from '@/pages/Feed'
import Explore from '@/pages/Explore'
import Reels from '@/pages/Reels'
import Messages from '@/pages/Messages'
import Notifications from '@/pages/Notifications'
import Profile from '@/pages/Profile'
import Settings from '@/pages/Settings'
import Auth from '@/pages/Auth'
import { Activity, Saved } from '@/pages/SavedActivity'
import './App.css'
import './extra.css'

function AppContent() {
  const { route, toast, me, authReady } = useSocial()
  const toastView = toast && <div className="toast" role="status"><CheckCircle2 size={18} /><span>{toast}</span></div>
  if (!authReady) return null // the splash screen covers this moment
  if (!me) return <><Auth />{toastView}</>
  const page = () => {
    switch (route) {
      case 'explore': return <Explore />
      case 'reels': return <Reels />
      case 'messages': return <Messages />
      case 'notifications': return <Notifications />
      case 'profile': return <Profile />
      case 'settings': return <Settings />
      case 'saved': return <Saved />
      case 'activity': return <Activity />
      default: return <Feed />
    }
  }
  return <><AppShell>{page()}</AppShell><StoryViewer /><CreatePost /><PostViewer /><ReportDialog />{toastView}</>
}

export default function App() {
  const [splash, setSplash] = useState(true)
  useEffect(() => { const timer = window.setTimeout(() => setSplash(false), 900); return () => window.clearTimeout(timer) }, [])
  return <SocialProvider>{splash && <div className="splash-screen" aria-label="Loading Luma"><div className="splash-center"><Brand inverse /><p>Keep the moments that move you.</p><span className="splash-loader"><i /></span></div><div className="splash-foot"><span>SOCIAL / AT YOUR PACE</span><span>LUMA © 2026</span></div></div>}<AppContent /></SocialProvider>
}
