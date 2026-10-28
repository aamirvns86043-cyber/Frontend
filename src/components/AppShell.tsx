import type { ReactNode } from 'react'
import { Bell, Bookmark, Clapperboard, Compass, Home, Menu, MessageCircle, Moon, Plus, Search, Settings, Sun, Activity, LogOut } from 'lucide-react'
import { Brand } from './Brand'
import { Avatar } from './Avatar'
import { useSocial } from '@/hooks/use-social'
import type { Route } from '@/types/social'

export function AppShell({ children }: { children: ReactNode }) {
  const { route, navigate, viewProfile, openCreate, theme, toggleTheme, logout, me, unreadMessages, unreadNotifications } = useSocial()
  if (!me) return null
  const primaryNav: { route: Route; label: string; icon: typeof Home; badge?: number }[] = [
    { route: 'home', label: 'Home', icon: Home },
    { route: 'explore', label: 'Explore', icon: Compass },
    { route: 'reels', label: 'Reels', icon: Clapperboard },
    { route: 'messages', label: 'Messages', icon: MessageCircle, badge: unreadMessages },
    { route: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
  ]
  const navItem = (item: typeof primaryNav[number]) => {
    const Icon = item.icon
    return <button key={item.route} type="button" className={`nav-item ${route === item.route ? 'active' : ''}`} onClick={() => navigate(item.route)} aria-current={route === item.route ? 'page' : undefined}>
      <span className="nav-icon"><Icon size={22} strokeWidth={route === item.route ? 2.4 : 1.8} />{!!item.badge && <span className="nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>}</span><span>{item.label}</span>
    </button>
  }

  return <div className={`app-shell route-${route}`}>
    <aside className="desktop-sidebar">
      <button className="sidebar-brand" type="button" onClick={() => navigate('home')} aria-label="Luma home"><Brand /></button>
      <nav className="sidebar-nav" aria-label="Primary navigation">
        {primaryNav.map(navItem)}
        <button type="button" className="nav-item" onClick={() => openCreate('post')}><span className="nav-icon"><Plus size={23} /></span><span>Create</span></button>
        <button type="button" className={`nav-item ${route === 'profile' ? 'active' : ''}`} onClick={() => viewProfile(me)}><Avatar user={me} size="xs" /><span>Profile</span></button>
      </nav>
      <div className="sidebar-bottom">
        <details className="more-menu">
          <summary className="nav-item"><span className="nav-icon"><Menu size={22} /></span><span>More</span></summary>
          <div className="more-popover">
            <button type="button" onClick={() => navigate('settings')}><Settings size={18} />Settings</button>
            <button type="button" onClick={() => navigate('activity')}><Activity size={18} />Your activity</button>
            <button type="button" onClick={() => navigate('saved')}><Bookmark size={18} />Saved</button>
            <button type="button" onClick={toggleTheme}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}{theme === 'light' ? 'Dark appearance' : 'Light appearance'}</button>
            <button type="button" onClick={() => { logout() }}><LogOut size={18} />Log out</button>
          </div>
        </details>
      </div>
    </aside>

    <header className="mobile-header">
      <button type="button" className="mobile-brand" onClick={() => navigate('home')} aria-label="Luma home"><Brand /></button>
      <div className="mobile-header-actions">
        <button className="icon-button mobile-search" type="button" onClick={() => navigate('explore')} aria-label="Search"><Search size={21} /></button>
        <button className="icon-button" type="button" onClick={() => navigate('notifications')} aria-label="Notifications"><Bell size={22} />{unreadNotifications > 0 && <span className="header-dot" />}</button>
        <button className="icon-button" type="button" onClick={() => navigate('messages')} aria-label="Messages"><MessageCircle size={22} />{unreadMessages > 0 && <span className="header-badge">{unreadMessages > 99 ? '99+' : unreadMessages}</span>}</button>
      </div>
    </header>

    <main className="app-main">{children}</main>

    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <button type="button" className={route === 'home' ? 'active' : ''} onClick={() => navigate('home')} aria-label="Home"><Home size={23} /></button>
      <button type="button" className={route === 'explore' ? 'active' : ''} onClick={() => navigate('explore')} aria-label="Search and explore"><Search size={23} /></button>
      <button type="button" className="mobile-create" onClick={() => openCreate('post')} aria-label="Create post"><Plus size={24} /></button>
      <button type="button" className={route === 'reels' ? 'active' : ''} onClick={() => navigate('reels')} aria-label="Reels"><Clapperboard size={23} /></button>
      <button type="button" className={route === 'profile' ? 'active' : ''} onClick={() => viewProfile(me)} aria-label="Profile"><Avatar user={me} size="xs" /></button>
    </nav>
  </div>
}
